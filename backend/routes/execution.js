const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authMiddleware');
const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const router = express.Router();
const prisma = new PrismaClient({});

async function getQuestionsData() {
  const filePath = path.join(__dirname, '../leetcode_questions.json');
  try {
    const fileData = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error('Error reading questions JSON:', error);
    return [];
  }
}

// Map Monaco language strings to Judge0 language IDs
const LANGUAGE_MAPPING = {
  'javascript': 63, // Node.js
  'python': 71,     // Python 3
  'cpp': 54,        // C++
  'java': 62        // Java
};

router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { code, language, input, problemId } = req.body;
    const userId = req.user.id;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    const languageId = LANGUAGE_MAPPING[language.toLowerCase()];
    if (!languageId) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    const judge0Url = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';

    // --- MODE 1: Competitive Auto-Grading (Test Cases) ---
    if (problemId) {
      const allQuestions = await getQuestionsData();
      const question = allQuestions.find(q => String(q.id) === String(problemId));
      
      if (!question) {
        return res.status(404).json({ error: "Question not found in question bank." });
      }

      const testCases = question.testCases?.sample || [];
      if (testCases.length === 0) {
        return res.status(400).json({ error: "No test cases available for this question." });
      }

      let passedCount = 0;
      let results = [];
      let firstCompileError = null;
      let firstStderr = null;
      let time = 0;
      let memory = 0;

      for (let i = 0; i < testCases.length; i++) {
        const judgeResponse = await axios.post(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
          source_code: code,
          language_id: languageId,
          stdin: testCases[i].input,
          expected_output: testCases[i].expectedOutput
        });

        const judgeData = judgeResponse.data;
        time = Math.max(time, parseFloat(judgeData.time) || 0);
        memory = Math.max(memory, parseFloat(judgeData.memory) || 0);

        if (judgeData.status?.id === 3) passedCount++;
        
        results.push({ 
            testCaseIndex: i + 1, 
            status: judgeData.status?.description,
            output: judgeData.stdout,
            expected: testCases[i].expectedOutput
        });

        if (judgeData.status?.id === 11) {
            firstCompileError = judgeData.compile_output;
            break; 
        }
        if (judgeData.status?.id >= 6 && judgeData.status?.id <= 12 && judgeData.status?.id !== 11) {
            firstStderr = judgeData.stderr;
        }
      }

      const overallStatus = passedCount === testCases.length ? 'Accepted' : 'Failed Test Cases';

      const submission = await prisma.submission.create({
        data: {
          userId,
          problemId: String(problemId),
          codeSnippet: code,
          language: language,
          status: overallStatus,
          executionTime: time,
          memory: memory,
        }
      });

      return res.json({
        submissionId: submission.id,
        status: overallStatus,
        passedCount,
        totalCases: testCases.length,
        details: results,
        compileOutput: firstCompileError,
        stderr: firstStderr,
        time,
        memory
      });
    }

    // --- MODE 2: Manual Sandbox Execution ---
    const judgeResponse = await axios.post(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
      source_code: code,
      language_id: languageId,
      stdin: input || ''
    });

    const result = judgeResponse.data;
    const statusStr = result.status.id === 3 ? 'Accepted' : result.status.description;

    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId: null,
        codeSnippet: code,
        language: language,
        status: statusStr,
        executionTime: result.time ? parseFloat(result.time) : null,
        memory: result.memory ? parseFloat(result.memory) : null,
      }
    });

    res.json({
      submissionId: submission.id,
      status: statusStr,
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compile_output,
      time: result.time,
      memory: result.memory
    });

  } catch (error) {
    console.error('Execution Error:', error);
    res.status(500).json({ error: 'Failed to execute code' });
  }
});

router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const questions = await getQuestionsData();
    const lightweightQuestions = questions.map(q => ({
      id: q.id,
      title: q.title,
      difficulty: q.difficulty,
      topics: q.topics
    }));
    res.json(lightweightQuestions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

router.post('/import-codeforces', authenticateToken, async (req, res) => {
  const { url } = req.body;
  const match = url.match(/(?:contest|problem)\/(\d+)\/(?:problem\/)?([A-Z0-9]+)/i);
  if (!match) return res.status(400).json({ error: "Invalid Codeforces URL" });

  const contestId = match[1];
  const problemIndex = match[2];

  let browser;
  try {
    console.log(`Spinning up browser for ${url}...`);
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
    });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.problem-statement', { timeout: 15000 });

    const problemData = await page.evaluate(() => {
      const rawTitle = document.querySelector('.problem-statement .header .title')?.innerText || '';
      const title = rawTitle.replace(/^[A-Z][0-9]*\.\s*/, ''); 

      let descriptionHtml = '';
      const descElements = document.querySelectorAll('.problem-statement > div:not(.header):not(.sample-tests)');
      descElements.forEach(el => descriptionHtml += el.innerHTML + '<br><br>');

      const inputs = Array.from(document.querySelectorAll('.sample-tests .input pre')).map(el => el.innerText.trim());
      const outputs = Array.from(document.querySelectorAll('.sample-tests .output pre')).map(el => el.innerText.trim());

      return { title, descriptionHtml, inputs, outputs };
    });
    
    await browser.close();

    const newProblem = {
      id: `${contestId}${problemIndex}`,
      source: "Codeforces",
      url: url,
      title: problemData.title,
      difficulty: "Unrated",
      topics: ["Codeforces"],
      description: problemData.descriptionHtml.trim(),
      testCases: {
        sample: problemData.inputs.map((inp, idx) => ({ input: inp, expectedOutput: problemData.outputs[idx], isSample: true })),
        hidden: []
      }
    };

    const allQuestions = await getQuestionsData();
    if (!allQuestions.find(q => q.id === newProblem.id)) {
      allQuestions.push(newProblem);
      const filePath = path.join(__dirname, '../leetcode_questions.json');
      await fs.writeFile(filePath, JSON.stringify(allQuestions, null, 4), 'utf-8');
    }

    res.json({ message: "Import successful", problem: newProblem });

  } catch (error) {
    if (browser) await browser.close();
    console.error("Scraping error:", error.message);
    res.status(500).json({ error: "Failed to scrape Codeforces. Cloudflare might be blocking the server." });
  }
});

module.exports = router;