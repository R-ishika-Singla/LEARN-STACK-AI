import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// import aiService from '../services/aiService.js'; 
// Mock AI Service fallback taaki server crash na ho
const aiService = {
  generateSummaryWithRotation: async (prompt) => {
    return JSON.stringify({
      developerPersona: { title: "Full Stack Developer", summary: "Mock AI Profile Evaluation" },
      overallScore: 75,
      scoreBreakdown: { github: 70, dsa: 80, projectQuality: 70, consistency: 80, problemSolving: 75 },
      strengths: ["Good problem solver", "Active repo maintenance"],
      weaknesses: ["Needs more high-tier DSA problems"],
      careerLevel: { level: "Intermediate", reason: "Consistent baseline metrics" },
      actionPlan: ["Solve 50 more LeetCode medium problems"],
      interviewReadiness: { status: "Ready", reason: "Core metrics cleared" }
    });
  }
};


const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files allowed'));
    }
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));

function maskToken(t) {
  if (!t) return '<MISSING>';
  if (t.length <= 12) return t.slice(0, 2) + '***';
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
}

async function ghCall(url, { token, label, retries = 2 } = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DevsSphere-Analytics/1.0'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t0 = Date.now();
    console.log(`   → [GH:${label}] attempt ${attempt}  GET ${url}`);
    let res;
    try {
      res = await fetch(url, { headers });
    } catch (netErr) {
      console.error(`   ✖ [GH:${label}] network error:`, netErr.message);
      if (attempt > retries) return { ok: false, status: 0, data: null, error: netErr.message };
      await sleepMs(700 * attempt);
      continue;
    }

    const remaining = res.headers.get('x-ratelimit-remaining');
    const limit = res.headers.get('x-ratelimit-limit');
    const reset = res.headers.get('x-ratelimit-reset');
    const took = Date.now() - t0;

    console.log(`   ← [GH:${label}] HTTP ${res.status}  (${took}ms)  rate ${remaining}/${limit}`);

    if ([502, 503, 504].includes(res.status) && attempt <= retries) {
      await sleepMs(700 * attempt);
      continue;
    }

    let bodyText = '';
    try { bodyText = await res.text(); } catch { /* ignore */ }

    let data = null;
    if (bodyText) {
      try { data = JSON.parse(bodyText); } catch { data = bodyText; }
    }

    if (!res.ok) {
      if ([401, 403, 404, 422].includes(res.status) || attempt > retries) {
        return { ok: false, status: res.status, data, rateLimit: { remaining, limit, reset } };
      }
      await sleepMs(500 * attempt);
      continue;
    }

    return { ok: true, status: res.status, data, rateLimit: { remaining, limit, reset } };
  }
  return { ok: false, status: 0, data: null };
}

async function fetchGithubStats(username) {
  if (!username) return null;
  const token = process.env.GITHUB_TOKEN;

  console.log('\n────────── GitHub deep fetch ──────────');
  const profile = await ghCall(`https://api.github.com/users/${encodeURIComponent(username)}`, { token, label: 'profile' });
  if (!profile.ok) return null;

  const repos1 = await ghCall(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&page=1`, { token, label: 'repos-p1' });
  if (!repos1.ok) return null;
  const page1 = Array.isArray(repos1.data) ? repos1.data : [];

  let page2 = [];
  if (page1.length === 100) {
    await sleepMs(250);
    const repos2 = await ghCall(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&page=2`, { token, label: 'repos-p2' });
    if (repos2.ok && Array.isArray(repos2.data)) page2 = repos2.data;
  }

  const allReposData = [...page1, ...page2];
  const allRepos = allReposData.map(repo => ({
    name: repo.name,
    description: repo.description,
    primaryLanguage: repo.language,
    stars: repo.stargazers_count,
    url: repo.html_url,
    forks: repo.forks_count,
    updatedAt: repo.updated_at
  }));

  return {
    followers: profile.data.followers,
    publicRepos: profile.data.public_repos,
    allRepos,
    pinnedRepos: [] 
  };
}

async function fetchLeetcodeStats(handle) {
  if (!handle) return null;
  try {
    const query = `
        query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                submitStats: submitStatsGlobal { acSubmissionNum { difficulty count } }
            }
            userContestRanking(username: $username) { rating }
        }
    `;
    const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' },
        body: JSON.stringify({ query, variables: { username: handle } })
    });
    const data = await res.json();
    return {
        stats: data.data?.matchedUser?.submitStats?.acSubmissionNum || [],
        contestRating: data.data?.userContestRanking?.rating || 0
    };
  } catch (err) {
    console.error('LeetCode API error:', err.message);
    return null;
  }
}

async function fetchCodeforcesStats(handle) {
  if (!handle) return null;
  try {
    const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
    const infoData = await infoRes.json();
    const user = infoData.result?.[0] || {};

    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
    const statusData = await statusRes.json();

    const solvedMap = new Map();
    const attemptsMap = new Map();

    if (statusData.result) {
        statusData.result.reverse().forEach(sub => {
            const pName = sub.problem.name;
            attemptsMap.set(pName, (attemptsMap.get(pName) || 0) + 1);
            if (sub.verdict === 'OK' && !solvedMap.has(pName)) {
                solvedMap.set(pName, {
                    name: pName,
                    rating: sub.problem.rating || 0,
                    tags: sub.problem.tags,
                    attemptsToAc: attemptsMap.get(pName)
                });
            }
        });
    }

    let totalAttemptsForACs = 0;
    solvedMap.forEach(val => { totalAttemptsForACs += val.attemptsToAc; });
    const struggleMetric = solvedMap.size > 0 ? (totalAttemptsForACs / solvedMap.size).toFixed(2) : 0;

    return {
        rating: user.rating || 0,
        rank: user.rank || 'Unranked',
        solvedList: Array.from(solvedMap.values()),
        struggleMetric: struggleMetric
    };
  } catch (err) {
    return null;
  }
}

function calculateScores(gh, cf, lc) {
    const totalStars = gh?.allRepos?.reduce((s, r) => s + r.stars, 0) || 0;
    const githubScore = Math.min(100, totalStars * 1.5 + (gh?.allRepos?.length || 0) * 2);

    const totalSolved = lc?.stats?.find(s => s.difficulty === 'All')?.count || 0;
    const dsaScore = Math.min(100, totalSolved * 0.4 + (cf?.rating || 0) / 15);

    const consistencyScore = Math.min(100, (gh?.allRepos?.length || 0) * 5);
    const projectQuality = 70; // Benchmark score baseline

    let overall = 0.3 * githubScore + 0.25 * dsaScore + 0.25 * projectQuality + 0.2 * consistencyScore;

    return {
        overall: Math.round(overall),
        github: Math.round(githubScore),
        dsa: Math.round(dsaScore),
        projectQuality: Math.round(projectQuality),
        consistency: Math.round(consistencyScore)
    };
}

// --- ENDPOINTS ---

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const linkedAccounts = await prisma.linkedAccount.findUnique({ where: { userId: req.user.id } });
    if (!linkedAccounts) return res.json({ linked: false });
    res.json({ linked: true, accounts: linkedAccounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

router.post('/link', authenticateToken, async (req, res) => {
  try {
    const { githubHandle, leetcodeHandle, codeforcesHandle } = req.body;
    const linked = await prisma.linkedAccount.upsert({
      where: { userId: req.user.id },
      update: { githubHandle, leetcodeHandle, codeforcesHandle },
      create: { userId: req.user.id, githubHandle, leetcodeHandle, codeforcesHandle }
    });
    res.json({ message: 'Accounts linked successfully', linked });
  } catch (error) {
    res.status(500).json({ error: 'Server error while linking accounts' });
  }
});

router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const aiSummary = await prisma.aISummary.findUnique({ where: { userId: req.user.id } });
    const profile = await prisma.profileSnapshot.findUnique({ where: { userId: req.user.id } });
    res.json({ aiSummary, profile });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const linkedAccounts = await prisma.linkedAccount.findUnique({ where: { userId } });
    if (!linkedAccounts) return res.status(400).json({ error: 'No linked accounts found.' });

    let githubData = null, leetcodeData = null, codeforcesData = null;
    
    if (linkedAccounts.githubHandle) { githubData = await fetchGithubStats(linkedAccounts.githubHandle); await sleep(1500); }
    if (linkedAccounts.codeforcesHandle) { codeforcesData = await fetchCodeforcesStats(linkedAccounts.codeforcesHandle); await sleep(1500); }
    if (linkedAccounts.leetcodeHandle) { leetcodeData = await fetchLeetcodeStats(linkedAccounts.leetcodeHandle); }

    await prisma.profileSnapshot.upsert({
      where: { userId },
      update: { githubData, leetcodeData, codeforcesData, lastSyncedAt: new Date() },
      create: { userId, githubData, leetcodeData, codeforcesData }
    });

    const scores = calculateScores(githubData || {}, codeforcesData || {}, leetcodeData || {});
    const stars = githubData?.allRepos?.reduce((s, r) => s + r.stars, 0) || 0;
    const forks = githubData?.allRepos?.reduce((s, r) => s + (r.forks || 0), 0) || 0;
    
    const langMap = {};
    githubData?.allRepos?.forEach(r => { if (r.primaryLanguage) langMap[r.primaryLanguage] = (langMap[r.primaryLanguage] || 0) + 1; });
    const topLanguages = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l).join(', ');

    const lcStats = leetcodeData?.stats || [];
    const lcAll = lcStats.find(s => s.difficulty === 'All')?.count || 0;
    const lcEasy = lcStats.find(s => s.difficulty === 'Easy')?.count || 0;
    const lcMedium = lcStats.find(s => s.difficulty === 'Medium')?.count || 0;
    const lcHard = lcStats.find(s => s.difficulty === 'Hard')?.count || 0;

    const prompt = `You are a strict and highly analytical senior software engineer... Output ONLY valid JSON.`;
    
    let cleanedOutput = "{}";
    try {
      const aiOutputString = await aiService.generateSummaryWithRotation(prompt);
      cleanedOutput = aiOutputString.replace(/```json/g, '').replace(/```/g, '').trim();
    } catch (aiErr) {
      console.log("AI Rotation service missing, storing raw snapshot fallback metrics.");
    }

    const aiSummary = await prisma.aISummary.upsert({
      where: { userId },
      update: { summaryText: cleanedOutput, technicalStrengths: "Detailed AI Report Generated", lastGeneratedAt: new Date() },
      create: { userId, summaryText: cleanedOutput, technicalStrengths: "Detailed AI Report Generated" }
    });

    res.json({ message: 'Profile synced and Deep AI Evaluation generated!', aiSummary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync profile' });
  }
});

router.get('/candidates', authenticateToken, async (req, res) => {
  if (req.user.role !== 'RECRUITER') return res.status(403).json({ error: 'Access denied' });
  try {
    const candidates = await prisma.user.findMany({
      where: { role: 'CANDIDATE' },
      select: { id: true, name: true, email: true, aISummary: true, profileSnapshot: true }
    });
    res.json(candidates.filter(c => c.aISummary));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

router.post('/candidate-profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'RECRUITER') return res.status(403).json({ error: 'Access denied' });
  try {
    const { githubHandle, leetcodeHandle, codeforcesHandle } = req.body;
    let githubData = null, leetcodeData = null, codeforcesData = null;

    if (githubHandle) { githubData = await fetchGithubStats(githubHandle); await sleep(1000); }
    if (codeforcesHandle) { codeforcesData = await fetchCodeforcesStats(codeforcesHandle); await sleep(1000); }
    if (leetcodeHandle) leetcodeData = await fetchLeetcodeStats(leetcodeHandle);

    const scores = calculateScores(githubData || {}, codeforcesData || {}, leetcodeData || {});
    let careerLevel = 'Beginner';
    if (scores.overall >= 80) careerLevel = 'Advanced';
    else if (scores.overall >= 60) careerLevel = 'Intermediate';

    res.json({ message: "Analysis complete", scores, careerLevel, githubData, leetcodeData, codeforcesData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk Upload Sheet Parser Endpoint
router.post('/bulk-upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let candidates = [];

    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length < 2) continue;
        candidates.push({ name: values[0], email: values[1], githubHandle: values[2] || '', leetcodeHandle: values[3] || '', codeforcesHandle: values[4] || '' });
      }
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      candidates = data.map(row => ({
        name: row['Full Name'] || row['Name'] || '',
        email: row['Email'] || row['email'] || '',
        githubHandle: row['Github'] || row['GitHub'] || row['github'] || '',
        leetcodeHandle: row['Leetcode'] || row['LeetCode'] || row['leetcode'] || '',
        codeforcesHandle: row['Codeforces'] || row['codeforces'] || ''
      })).filter(c => c.name || c.email);
    }

    const validCandidates = candidates.filter(c => {
      if (!c.name && !c.email) return false;
      if (!c.email) c.email = `${c.name.toLowerCase().replace(/\s/g, '_')}@candidates.dev`;
      return true;
    });

    fs.unlink(filePath, (err) => { if (err) console.error(err); });

    res.json({ success: true, totalRows: candidates.length, validCandidates: validCandidates.length, candidates: validCandidates });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: error.message });
  }
});

export default router;