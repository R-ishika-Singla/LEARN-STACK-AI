const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authMiddleware');
const aiService = require('../services/aiService');
const { fetchDeepGitHubData } = require('../services/githubDeepAnalysis');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient({});

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

    console.log(`   ← [GH:${label}] HTTP ${res.status}  (${took}ms)  rate ${remaining}/${limit}` +
      (reset ? `  resets@${new Date(Number(reset) * 1000).toISOString()}` : ''));

    if ([502, 503, 504].includes(res.status) && attempt <= retries) {
      console.warn(`   ⟳ [GH:${label}] transient ${res.status}, retrying…`);
      await sleepMs(700 * attempt);
      continue;
    }

    if (res.status === 403 && remaining === '0') {
      const waitSec = reset ? Math.max(1, Number(reset) - Math.floor(Date.now() / 1000)) : 60;
      console.warn(`   ⏳ [GH:${label}] rate-limited, would need to wait ${waitSec}s — aborting this call`);
    }

    let bodyText = '';
    try { bodyText = await res.text(); } catch { /* ignore */ }

    let data = null;
    if (bodyText) {
      try { data = JSON.parse(bodyText); } catch { data = bodyText; }
    }

    if (!res.ok) {
      const snippet = typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
      console.error(`    [GH:${label}] body: ${snippet}`);
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
  if (!username) {
    console.log('   ⚠ fetchGithubStats called with empty username — skipping');
    return null;
  }

  const token = process.env.GITHUB_TOKEN;
  console.log('\n────────── GitHub deep fetch ──────────');
  console.log('   Username   :', username);
  console.log('   Token      :', maskToken(token));
  console.log('   Mode       :', token ? 'AUTHENTICATED (5000 req/hr)' : 'ANONYMOUS (60 req/hr) ⚠');

  // Pre-flight: validate the token, if we have one.
  if (token) {
    const probe = await ghCall('https://api.github.com/user', { token, label: 'token-probe', retries: 0 });
    if (!probe.ok) {
      if (probe.status === 401) {
        console.error('    GITHUB_TOKEN is invalid or expired (401 from /user).');
        console.error('      → Generate a new PAT at https://github.com/settings/tokens (classic; "public_repo" scope is enough)');
        console.error('      → Set it in backend/.env as GITHUB_TOKEN=ghp_xxx and restart the server.');
        console.error('      → Falling through to anonymous mode — limited to 60 requests/hour.');
      } else {
        console.warn(`    Token probe returned ${probe.status}; continuing anyway`);
      }
    } else {
      console.log('    Token valid. Acting as:', probe.data?.login);
    }
  } else {
    console.warn('   No GITHUB_TOKEN set in backend/.env — using anonymous quota (60/hr).');
  }

  // STEP 1 — profile
  console.log('\n   STEP 1/4: fetch profile');
  const profile = await ghCall(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    token, label: 'profile'
  });
  if (!profile.ok) {
    if (profile.status === 404) {
      console.error(`    GitHub user "${username}" does not exist.`);
    } else if (profile.status === 401) {
      console.error('    401 on /users/:name — token is being rejected by GitHub.');
    }
    console.error('    Aborting GitHub fetch — no profile.');
    return null;
  }
  console.log('    Profile OK:', {
    login: profile.data.login,
    followers: profile.data.followers,
    publicRepos: profile.data.public_repos,
    createdAt: profile.data.created_at
  });
  await sleepMs(250);

  // STEP 2 — repos page 1
  console.log('\n   STEP 2/4: fetch repos (page 1)');
  const repos1 = await ghCall(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&page=1`,
    { token, label: 'repos-p1' }
  );
  if (!repos1.ok) {
    console.error('    Repos page 1 failed — aborting GitHub fetch.');
    return null;
  }
  const page1 = Array.isArray(repos1.data) ? repos1.data : [];
  console.log(`    Page 1: ${page1.length} repos`);

  // STEP 3 — repos page 2 (only if needed)
  let page2 = [];
  if (page1.length === 100) {
    await sleepMs(250);
    console.log('\n   STEP 3/4: fetch repos (page 2)');
    const repos2 = await ghCall(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&page=2`,
      { token, label: 'repos-p2' }
    );
    if (repos2.ok && Array.isArray(repos2.data)) {
      page2 = repos2.data;
      console.log(`    Page 2: ${page2.length} repos`);
    } else {
      console.warn('    Page 2 failed or empty — continuing with page 1 only');
    }
  } else {
    console.log('\n   STEP 3/4: skipped (page 1 had <100 results)');
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

  const totalStars = allRepos.reduce((s, r) => s + (r.stars || 0), 0);
  const totalForks = allRepos.reduce((s, r) => s + (r.forks || 0), 0);
  console.log('\n    Repos summary:');
  console.log('      total :', allRepos.length);
  console.log('      stars :', totalStars);
  console.log('      forks :', totalForks);
  if (allRepos.length > 0) {
    console.log('      top 3 :', allRepos.slice(0, 3).map(r => `${r.name}(★${r.stars})`).join(', '));
  }

  // STEP 4 — deep / pinned analysis (must not be fatal)
  console.log('\n   STEP 4/4: deep analysis (pinned repos)');
  let pinnedRepos = [];
  if (token) {
    await sleepMs(400);
    try {
      const deep = await fetchDeepGitHubData(username, token);
      pinnedRepos = deep?.pinnedRepos || [];
      console.log(`    Pinned repos enriched: ${pinnedRepos.length}`);
      if (pinnedRepos.length > 0) {
        pinnedRepos.forEach((p, i) => {
          console.log(`      ${i + 1}. ${p.name}  commits=${p.totalCommits}  prs=${p.prCount}  readme=${p.readmeScore}  tags=[${(p.architectureTags || []).join(', ')}]`);
        });
      }
    } catch (deepErr) {
      console.warn('    Deep analysis failed (continuing without pinned data):', deepErr.message);
    }
  } else {
    console.log('    Skipping deep analysis — no token (anonymous GraphQL is not allowed).');
  }

  console.log('────────── GitHub fetch DONE ──────────\n');

  return {
    followers: profile.data.followers,
    publicRepos: profile.data.public_repos,
    allRepos,
    pinnedRepos
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
            userContestRanking(username: $username) {
                rating
            }
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
    console.error('Codeforces API error:', err.message);
    return null;
  }
}

function calculateScores(gh, cf, lc) {
    const totalStars = gh?.allRepos?.reduce((s, r) => s + r.stars, 0) || 0;
    const githubScore = Math.min(100, totalStars * 1.5 + (gh?.allRepos?.length || 0) * 2);

    const totalSolved = lc?.stats?.find(s => s.difficulty === 'All')?.count || 0;
    const dsaScore = Math.min(100, totalSolved * 0.4 + (cf?.rating || 0) / 15);

    const totalCommits = gh?.pinnedRepos?.reduce((s, r) => s + r.totalCommits, 0) || 0;
    const activeRepos = gh?.pinnedRepos?.filter(r => r.totalCommits > 10).length || 0;
    const consistencyScore = Math.min(100, activeRepos * 15);

    const projectQuality = (gh?.pinnedRepos?.reduce((s, r) => {
            return s + (r.readmeScore * 0.3) + (r.commitQualityScore * 0.4) + (r.totalCommits * 0.2) + ((r.architectureTags?.length || 0) * 5);
    }, 0) || 0) / (gh?.pinnedRepos?.length || 1);

    let overall = 0.3 * githubScore + 0.25 * dsaScore + 0.25 * projectQuality + 0.2 * consistencyScore;
    const contributionBoost = totalCommits > 50 ? 10 : 0;
    overall += contributionBoost;

    return {
        overall: Math.round(overall),
        github: Math.round(githubScore),
        dsa: Math.round(dsaScore),
        projectQuality: Math.round(projectQuality),
        consistency: Math.round(consistencyScore)
    };
}

// Check linking status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const linkedAccounts = await prisma.linkedAccount.findUnique({
      where: { userId: req.user.id }
    });
    
    if (!linkedAccounts) {
      return res.json({ linked: false });
    }
    
    res.json({ linked: true, accounts: linkedAccounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Link new accounts
router.post('/link', authenticateToken, async (req, res) => {
  try {
    const { githubHandle, leetcodeHandle, codeforcesHandle } = req.body;
    
    if (!githubHandle && !leetcodeHandle && !codeforcesHandle) {
      return res.status(400).json({ error: 'At least one handle is required' });
    }

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

// Get cached AI summary and profile stats
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

    // Mitigate Rate Limiting by fetching sequentially with delays
    let githubData = null, leetcodeData = null, codeforcesData = null;
    
    if (linkedAccounts.githubHandle) {
        githubData = await fetchGithubStats(linkedAccounts.githubHandle);
        await sleep(1500);
    }
    if (linkedAccounts.codeforcesHandle) {
        codeforcesData = await fetchCodeforcesStats(linkedAccounts.codeforcesHandle);
        await sleep(1500);
    }
    if (linkedAccounts.leetcodeHandle) {
        leetcodeData = await fetchLeetcodeStats(linkedAccounts.leetcodeHandle);
    }

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

    const prompt = `You are a strict and highly analytical senior software engineer, hiring evaluator, and career mentor.
Your task is to evaluate a developer using multi-source data and produce a brutally honest, structured, and actionable assessment.
STRICT RULES: Be highly specific and data-driven. Output ONLY valid JSON.

INPUT DATA:
GitHub: Total Repositories: ${githubData?.allRepos?.length || 0}, Total Stars: ${stars}, Total Forks: ${forks}, Languages Used: ${topLanguages}
Scores: Overall: ${scores.overall}, GitHub: ${scores.github}, DSA: ${scores.dsa}, Project Quality: ${scores.projectQuality}, Consistency: ${scores.consistency}
DSA: Total Solved: ${lcAll}, Easy: ${lcEasy}, Medium: ${lcMedium}, Hard: ${lcHard}, Current Rating (Codeforces): ${codeforcesData?.rating || 0}

OUTPUT FORMAT (STRICT JSON — no markdown, no extra text):
{
  "developerPersona": { "title": "", "summary": "" },
  "overallScore": 0,
  "scoreBreakdown": { "github": 0, "dsa": 0, "projectQuality": 0, "consistency": 0, "problemSolving": 0 },
  "strengths": ["", "", ""],
  "weaknesses": ["", "", "", ""],
  "careerLevel": { "level": "Beginner | Intermediate | Advanced", "reason": "" },
  "actionPlan": ["", "", "", ""],
  "interviewReadiness": { "status": "Ready | Not Ready", "reason": "" }
}`;

    const aiOutputString = await aiService.generateSummaryWithRotation(prompt);
    
    // Clean markdown blocks
    const cleanedOutput = aiOutputString.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // We will save this HUGE JSON payload exactly as text in summaryText!
    const aiSummary = await prisma.aISummary.upsert({
      where: { userId },
      update: { 
        summaryText: cleanedOutput, 
        technicalStrengths: "Detailed AI Report Generated", // Legacy field, kept for Prisma schema compatibility
        lastGeneratedAt: new Date()
      },
      create: { 
        userId, 
        summaryText: cleanedOutput, 
        technicalStrengths: "Detailed AI Report Generated" 
      }
    });

    res.json({ message: 'Profile synced and Deep AI Evaluation generated!', aiSummary });

  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ error: 'Failed to sync profile and generate summary' });
  }
});

// Fetch all candidates (For RECRUITER role only)
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

// Analyze candidate profile from handles (For RECRUITER role)
router.post('/candidate-profile', authenticateToken, async (req, res) => {
  console.log('Incoming POST /candidate-profile request');
  console.log('User:', req.user?.email, 'Role:', req.user?.role);

  if (req.user.role !== 'RECRUITER') {
    console.error(' Access denied - not a recruiter');
    return res.status(403).json({ error: 'Access denied - only recruiters can analyze candidates' });
  }

  try {
    const { githubHandle, leetcodeHandle, codeforcesHandle } = req.body;
    console.log('Recruiter analyzing candidate:', { githubHandle, leetcodeHandle, codeforcesHandle });

    if (!githubHandle && !leetcodeHandle && !codeforcesHandle) {
      return res.status(400).json({ error: 'At least one handle is required' });
    }

    // Fetch data from all platforms
    let githubData = null, leetcodeData = null, codeforcesData = null;

    if (githubHandle) {
      console.log('Fetching GitHub for:', githubHandle);
      githubData = await fetchGithubStats(githubHandle);
      await sleep(1000);
    }

    if (codeforcesHandle) {
      console.log('Fetching Codeforces for:', codeforcesHandle);
      codeforcesData = await fetchCodeforcesStats(codeforcesHandle);
      await sleep(1000);
    }

    if (leetcodeHandle) {
      console.log(' Fetching LeetCode for:', leetcodeHandle);
      leetcodeData = await fetchLeetcodeStats(leetcodeHandle);
    }

    // Calculate scores using backend logic
    const scores = calculateScores(githubData || {}, codeforcesData || {}, leetcodeData || {});

    console.log(' Scores calculated:', scores);

    // Determine career level
    let careerLevel = 'Beginner';
    if (scores.overall >= 80) careerLevel = 'Advanced';
    else if (scores.overall >= 60) careerLevel = 'Intermediate';

    // ==================== ENHANCED ANALYSIS ====================

    // GitHub Analysis
    const totalRepos = githubData?.allRepos?.length || 0;
    const followers = githubData?.followers || 0;
    const totalStars = githubData?.allRepos?.reduce((s, r) => s + r.stars, 0) || 0;
    const totalForks = githubData?.allRepos?.reduce((s, r) => s + r.forks, 0) || 0;

    // ─── Technology stack analysis ───────────────────────────────────────
    // 1) Languages (count repos per language)
    const languages = {};
    (githubData?.allRepos || []).forEach(repo => {
      if (repo.primaryLanguage) {
        languages[repo.primaryLanguage] = (languages[repo.primaryLanguage] || 0) + 1;
      }
    });
    const sortedLanguages = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    const topLanguages = sortedLanguages
      .slice(0, 3)
      .map(([lang, count]) => `${lang} (${count} repos)`)
      .join(', ');

    // 2) Frameworks / libs (from pinned-repo package.json analysis)
    const frameworkTags = new Set();
    (githubData?.pinnedRepos || []).forEach(p => {
      (p.architectureTags || []).forEach(t => frameworkTags.add(t));
    });

    // 3) Flat techStack = languages + frameworks (deduped)
    const techStack = [
      ...sortedLanguages.map(([lang]) => lang),
      ...Array.from(frameworkTags)
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // 4) Domain tags — coarse buckets a recruiter actually filters on.
    const DOMAIN_MAP = {
      Web: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'Next.js', 'Vue', 'Angular',
        'Svelte', 'Remix', 'Astro', 'Nuxt', 'Tailwind CSS', 'styled-components',
        'Express.js', 'Fastify', 'Koa', 'NestJS', 'Django', 'Flask', 'FastAPI',
        'Spring Boot', 'Ruby', 'PHP'],
      Mobile: ['Swift', 'Kotlin', 'Java', 'Dart', 'React Native', 'Flutter', 'Expo', 'Objective-C'],
      'Data / ML': ['Python', 'R', 'Jupyter Notebook', 'NumPy', 'Pandas', 'scikit-learn',
        'TensorFlow', 'PyTorch', 'Hugging Face Transformers', 'LangChain', 'OpenAI SDK'],
      DevOps: ['Docker', 'Kubernetes', 'Terraform', 'Shell', 'HCL', 'Dockerfile'],
      Systems: ['C', 'C++', 'Rust', 'Go', 'Zig', 'Assembly'],
      Database: ['SQL', 'PLpgSQL', 'MongoDB', 'MongoDB (Mongoose)', 'PostgreSQL', 'MySQL',
        'Redis', 'Prisma ORM', 'Sequelize', 'TypeORM', 'Spring Data JPA', 'Hibernate'],
      Blockchain: ['Solidity', 'Vyper'],
      GameDev: ['C#', 'GDScript', 'Lua']
    };
    const domainTags = Object.entries(DOMAIN_MAP)
      .filter(([, members]) => techStack.some(t => members.includes(t)))
      .map(([domain]) => domain);

    console.log(' Tech stack:');
    console.log('   languages    :', sortedLanguages.map(([l, c]) => `${l}×${c}`).join(', ') || '(none)');
    console.log('   frameworks   :', Array.from(frameworkTags).join(', ') || '(none)');
    console.log('   techStack    :', techStack.join(', ') || '(none)');
    console.log('   domainTags   :', domainTags.join(', ') || '(none)');

    // Recent activity (repos updated in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentRepos = (githubData?.allRepos || []).filter(r => new Date(r.updatedAt) > thirtyDaysAgo).length;

    // GitHub description
    const githubAnalysis = {
      projectCount: totalRepos,
      totalStars,
      totalForks,
      followers,
      recentActivity: recentRepos,
      topLanguages: topLanguages || 'N/A',
      languages: sortedLanguages.map(([name, count]) => ({ name, count })),
      frameworks: Array.from(frameworkTags),
      techStack,
      domainTags,
      description: `Developer with ${totalRepos} public repositories, ${totalStars} total stars, and ${followers} followers. ` +
        `Recently active in: ${topLanguages || 'various projects'}. ` +
        (recentRepos > 0 ? `${recentRepos} repos updated in last 30 days.` : 'Currently inactive.')
    };

    // LeetCode Analysis
    const lcStats = leetcodeData?.stats || [];
    const easyCount = lcStats.find(s => s.difficulty === 'Easy')?.count || 0;
    const mediumCount = lcStats.find(s => s.difficulty === 'Medium')?.count || 0;
    const hardCount = lcStats.find(s => s.difficulty === 'Hard')?.count || 0;
    const totalSolved = lcStats.find(s => s.difficulty === 'All')?.count || 0;

    // LeetCode level assessment
    let leetcodeLevel = 'Beginner';
    if (totalSolved >= 200) leetcodeLevel = 'Advanced';
    else if (totalSolved >= 100) leetcodeLevel = 'Intermediate';
    else if (totalSolved >= 50) leetcodeLevel = 'Beginner+';

    // Problem distribution insight
    const problemBreakdown = `Easy: ${easyCount}, Medium: ${mediumCount}, Hard: ${hardCount}`;
    const mediumHardRatio = totalSolved > 0 ? ((mediumCount + hardCount) / totalSolved * 100).toFixed(1) : 0;

    // Whichever bucket holds the largest share of solved problems is the
    // candidate's "dominant" difficulty — used by recruiter filter.
    let dominantDifficulty = 'None';
    if (totalSolved > 0) {
      const buckets = [
        ['Easy', easyCount],
        ['Medium', mediumCount],
        ['Hard', hardCount]
      ].sort((a, b) => b[1] - a[1]);
      dominantDifficulty = buckets[0][0];
    }

    const leetcodeAnalysis = {
      totalSolved,
      easyCount,
      mediumCount,
      hardCount,
      level: leetcodeLevel,
      dominantDifficulty,
      problemBreakdown,
      mediumHardPercentage: `${mediumHardRatio}%`,
      contestRating: leetcodeData?.contestRating || 0,
      description: `Solved ${totalSolved} problems (${problemBreakdown}). ` +
        `${mediumHardRatio}% are medium/hard problems. ` +
        (leetcodeData?.contestRating > 0 ? `Contest rating: ${leetcodeData.contestRating}.` : 'No contest participation.')
    };

    // Codeforces Analysis (Optional)
    const codeforcesAnalysis = codeforcesData ? {
      rating: codeforcesData.rating || 0,
      rank: codeforcesData.rank || 'Unranked',
      problemsSolved: codeforcesData.solvedList?.length || 0,
      description: codeforcesData.rating > 0
        ? `Codeforces rating: ${codeforcesData.rating} (${codeforcesData.rank}). ` +
          `Solved ${codeforcesData.solvedList?.length || 0} problems. ` +
          `Struggle metric (avg attempts): ${codeforcesData.struggleMetric || 'N/A'}.`
        : 'No Codeforces data available.'
    } : null;

    // ==================== ENHANCED STRENGTHS & WEAKNESSES ====================

    const strengths = [];
    const weaknesses = [];

    // GitHub strengths/weaknesses
    if (scores.github > 70) strengths.push(`Strong GitHub presence (${totalStars} stars)`);
    if (scores.github > 80) strengths.push(`Experienced developer with ${totalRepos} projects`);
    if (totalStars > 100) strengths.push('Popular open-source projects');
    if (recentRepos > totalRepos / 2) strengths.push('Active contributor (recently updated projects)');
    if (followers > 50) strengths.push(`Well-known in community (${followers} followers)`);

    if (scores.github < 50) weaknesses.push('Limited GitHub activity or few repositories');
    if (totalStars < 5) weaknesses.push('Projects lack significant community interest');
    if (recentRepos === 0) weaknesses.push('No recent GitHub activity');

    // LeetCode strengths/weaknesses
    if (scores.dsa > 70) strengths.push(`Excellent DSA fundamentals (${totalSolved} problems)`);
    if (hardCount > mediumCount) strengths.push('Strong in complex problem-solving');
    if (mediumHardRatio > 60) strengths.push('Focus on challenging problems (>60% medium/hard)');
    if (leetcodeData?.contestRating > 1500) strengths.push(`High contest rating (${leetcodeData.contestRating})`);

    if (scores.dsa < 50) weaknesses.push('DSA skills need improvement');
    if (totalSolved < 50) weaknesses.push('Limited LeetCode practice');
    if (mediumHardRatio < 30) weaknesses.push('Mostly solving easy problems');

    // Codeforces strengths/weaknesses
    if (codeforcesAnalysis) {
      if (codeforcesData.rating > 1600) strengths.push(`Competitive programming expertise (${codeforcesData.rating} rating)`);
      if (codeforcesData.rating < 800 && codeforcesData.rating > 0) weaknesses.push('Beginner-level competitive programming skills');
    }

    // Consistency strengths/weaknesses
    if (scores.consistency > 70) strengths.push('Consistent contributor across multiple projects');
    if (scores.consistency < 40) weaknesses.push('Inconsistent project maintenance');

    const candidateProfile = {
      githubHandle,
      leetcodeHandle,
      codeforcesHandle,
      name: githubHandle || leetcodeHandle || codeforcesHandle || 'Developer',
      email: `${githubHandle || leetcodeHandle}@example.com`,
      overallScore: Math.round(scores.overall),
      github: Math.round(scores.github),
      dsa: Math.round(scores.dsa),
      projectQuality: Math.round(scores.projectQuality),
      consistency: Math.round(scores.consistency),
      careerLevel,
      dateAdded: new Date().toLocaleDateString(),

      // ── Top-level filter fields ──────────────────────────────────────
      techStack,                                       // e.g. ["TypeScript", "React", "Next.js"]
      domainTags,                                      // e.g. ["Web", "Database"]
      leetcodeTotalSolved: totalSolved,
      leetcodeEasy: easyCount,
      leetcodeMedium: mediumCount,
      leetcodeHard: hardCount,
      leetcodeDominantDifficulty: dominantDifficulty,  // "Easy" | "Medium" | "Hard" | "None"

      // Detailed analysis data
      githubAnalysis,
      leetcodeAnalysis,
      codeforcesAnalysis,

      // Summary
      strengths: [...new Set(strengths)].slice(0, 5), // Deduplicate and limit to 5
      weaknesses: [...new Set(weaknesses)].slice(0, 4), // Deduplicate and limit to 4

      // Summary description
      summary: `${careerLevel}-level developer with ${totalRepos} GitHub repos ` +
        `(${totalStars} stars) and ${totalSolved} LeetCode problems solved. ` +
        (codeforcesAnalysis?.rating > 0 ? `Codeforces rating: ${codeforcesAnalysis.rating}. ` : '') +
        `Tech stack: ${topLanguages || 'Diverse'}. ` +
        `${strengths.length > 0 ? `Key strengths: ${strengths[0]}. ` : ''}` +
        `${weaknesses.length > 0 ? `Areas for improvement: ${weaknesses[0]}.` : ''}`
    };

    console.log('Candidate profile complete:', candidateProfile);
    res.json(candidateProfile);

  } catch (error) {
    console.error(' Error analyzing candidate profile:', error);
    res.status(500).json({ error: 'Failed to analyze candidate profile: ' + error.message });
  }
});

// Bulk Upload Endpoint
router.post('/bulk-upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log(' Bulk upload initiated');
    console.log('File details:', req.file?.originalname, 'Size:', req.file?.size);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let candidates = [];

    if (ext === '.csv') {
      // Parse CSV
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Skip header (first line)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        // Proper CSV parsing handling quoted fields
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length < 2) continue; // Skip invalid rows

        candidates.push({
          name: values[0],
          email: values[1],
          githubHandle: values[2] || '',
          leetcodeHandle: values[3] || '',
          codeforcesHandle: values[4] || ''
        });
      }
    } else {
      // Parse Excel (.xlsx or .xls)
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON with proper encoding
      const data = XLSX.utils.sheet_to_json(sheet);

      console.log(' Excel sheet parsed, rows found:', data.length);
      console.log('Sample row keys:', Object.keys(data[0] || {}));

      candidates = data.map(row => ({
        name: row['Full Name'] || row['Name'] || '',
        email: row['Email'] || row['email'] || '',
        githubHandle: row['Github'] || row['GitHub'] || row['github'] || '',
        leetcodeHandle: row['Leetcode'] || row['LeetCode'] || row['leetcode'] || '',
        codeforcesHandle: row['Codeforces'] || row['codeforces'] || ''
      })).filter(c => c.name || c.email); // Only keep rows with name or email
    }

    console.log(' Total valid candidates parsed:', candidates.length);
    console.log('Sample candidates:', candidates.slice(0, 3).map(c => ({ name: c.name, email: c.email })));

    // Validation: Remove empty names/emails
    const validCandidates = candidates.filter(c => {
      if (!c.name && !c.email) {
        console.warn(' Skipping row with no name or email:', c);
        return false;
      }
      if (!c.email) {
        c.email = `${(c.name || 'user').toLowerCase().replace(/\s/g, '_')}@candidates.dev`;
        console.log(' Generated email for', c.name, '→', c.email);
      }
      return true;
    });

    console.log(' Valid candidates after filtering:', validCandidates.length);

    // Clean up uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('File cleanup error:', err);
    });

    res.json({
      success: true,
      totalRows: candidates.length,
      validCandidates: validCandidates.length,
      candidates: validCandidates,
      message: `Successfully parsed ${validCandidates.length} candidates`
    });

  } catch (error) {
    console.error(' Bulk upload error:', error);
    // Clean up file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => { if (err) console.error('Cleanup:', err); });
    }
    res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});

module.exports = router;
