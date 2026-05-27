// Node 18+ (native fetch)

const TECH_DICTIONARY = {
  // Node / JS web
  express: 'Express.js',
  fastify: 'Fastify',
  koa: 'Koa',
  '@nestjs/core': 'NestJS',
  next: 'Next.js',
  nuxt: 'Nuxt',
  react: 'React',
  'react-dom': 'React',
  'react-native': 'React Native',
  vue: 'Vue',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  remix: 'Remix',
  astro: 'Astro',
  vite: 'Vite',
  webpack: 'Webpack',
  tailwindcss: 'Tailwind CSS',
  'styled-components': 'styled-components',
  redux: 'Redux',
  zustand: 'Zustand',
  'react-query': 'React Query',
  '@tanstack/react-query': 'React Query',
  'socket.io': 'WebSockets',

  // Databases / ORMs
  mongoose: 'MongoDB (Mongoose)',
  mongodb: 'MongoDB',
  prisma: 'Prisma ORM',
  '@prisma/client': 'Prisma ORM',
  sequelize: 'Sequelize',
  typeorm: 'TypeORM',
  pg: 'PostgreSQL',
  mysql: 'MySQL',
  mysql2: 'MySQL',
  redis: 'Redis',
  ioredis: 'Redis',

  // Auth
  jsonwebtoken: 'JWT Authentication',
  passport: 'Passport.js',
  bcrypt: 'bcrypt',
  bcryptjs: 'bcrypt',

  // Python web / data / ML
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  numpy: 'NumPy',
  pandas: 'Pandas',
  'scikit-learn': 'scikit-learn',
  tensorflow: 'TensorFlow',
  torch: 'PyTorch',
  pytorch: 'PyTorch',
  transformers: 'Hugging Face Transformers',
  langchain: 'LangChain',
  openai: 'OpenAI SDK',

  // Java / JVM
  'spring-boot-starter-web': 'Spring Boot',
  'spring-boot-starter-data-jpa': 'Spring Data JPA',
  hibernate: 'Hibernate',

  // DevOps / infra
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  terraform: 'Terraform',

  // Mobile
  flutter: 'Flutter',
  expo: 'Expo'
};

const SEMANTIC_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\(.*\))?:/i;

async function fetchDeepGitHubData(username, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // --- GraphQL: pinned repos ---
  const query = `
    query($username: String!) {
      user(login: $username) {
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              description
              stargazerCount
              url
              updatedAt
              defaultBranchRef { name }
              primaryLanguage { name }
              languages(first: 6, orderBy: {field: SIZE, direction: DESC}) {
                edges { size, node { name } }
              }
            }
          }
        }
      }
    }
  `;

  const gqlRes = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: { username } })
  });
  const gqlData = await gqlRes.json();
  if (gqlData.errors) {
    throw new Error('GraphQL failed: ' + JSON.stringify(gqlData.errors));
  }

  const pinned = gqlData?.data?.user?.pinnedItems?.nodes || [];

  const restHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json'
  };

  const enriched = await Promise.all(
    pinned.map(async (repo) => {
      const repoFull = `${username}/${repo.name}`;
      const branch =
        repo?.defaultBranchRef?.name || 'main'; // fallback

      let architectureTags = [];
      let semanticCommitRatio = 0;
      let readmeScore = 0;
      let prCount = 0;
      let totalCommits = 0;

      // --- A) package.json parsing ---
      try {
        const pkgRes = await fetch(
          `https://api.github.com/repos/${repoFull}/contents/package.json?ref=${branch}`,
          { headers: restHeaders }
        );
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          const content = Buffer.from(pkgData.content, 'base64').toString(
            'utf-8'
          );
          const pkg = JSON.parse(content);
          const deps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {})
          };

          for (const dep in deps) {
            if (TECH_DICTIONARY[dep]) {
              architectureTags.push(TECH_DICTIONARY[dep]);
            }
          }
        }
      } catch {}
      
if (architectureTags.length === 0 && repo.primaryLanguage) {
  architectureTags.push(repo.primaryLanguage.name);
}

// Optional smart detection
if (repo.description?.toLowerCase().includes("api")) {
  architectureTags.push("API Development");
}

      // --- B) commits + semantic ---
      let semanticCount = 0;
let meaningfulCount = 0;
let poorCount = 0;

 semanticCommitRatio = 0;
let meaningfulCommitRatio = 0;
let poorCommitRatio = 0;
let commitQualityScore = 0;

try {
  const commitsRes = await fetch(
    `https://api.github.com/repos/${repoFull}/commits?per_page=100&sha=${branch}`,
    { headers: restHeaders }
  );

  if (commitsRes.ok) {
    const commits = await commitsRes.json();
    totalCommits = commits.length;

    commits.forEach((c) => {
      const msg = (c?.commit?.message || '').toLowerCase().trim();

      if (SEMANTIC_REGEX.test(msg)) {
        semanticCount++;
      } 
      else if (msg.length > 12 && !msg.includes("update") && !msg.includes("changes")) {
        meaningfulCount++;
      } 
      else {
        poorCount++;
      }
    });

    const total = commits.length || 1;

    semanticCommitRatio = Math.round((semanticCount / total) * 100);
    meaningfulCommitRatio = Math.round((meaningfulCount / total) * 100);
    poorCommitRatio = Math.round((poorCount / total) * 100);

    commitQualityScore = Math.round(
      ((semanticCount * 1) + (meaningfulCount * 0.7)) / total * 100
    );
  }

} catch {}

      // --- C) PR count ---
      try {
        const pullsRes = await fetch(
          `https://api.github.com/repos/${repoFull}/pulls?state=all&per_page=50`,
          { headers: restHeaders }
        );
        if (pullsRes.ok) {
          const pulls = await pullsRes.json();
          prCount = pulls.length;
        }
      } catch {}

      // --- D) README grading ---
      try {
        const readmeRes = await fetch(
          `https://api.github.com/repos/${repoFull}/readme`,
          { headers: restHeaders }
        );
        if (readmeRes.ok) {
          const readme = await readmeRes.json();
          const content = Buffer.from(readme.content, 'base64').toString(
            'utf-8'
          );
          const lower = content.toLowerCase();

          if (lower.includes('setup') || lower.includes('installation'))
            readmeScore += 20;
          if (lower.includes('features') || lower.includes('architecture'))
            readmeScore += 20;
          if (content.includes('```')) readmeScore += 20;
          if (content.includes('![')) readmeScore += 20;
        }
      } catch {}

      // --- E) size via languages ---
      let totalBytes = 0;
      if (repo.languages?.edges) {
        totalBytes = repo.languages.edges.reduce(
          (sum, e) => sum + e.size,
          0
        );
      }

      return {
        name: repo.name,
        description: repo.description,
        stars: repo.stargazerCount || 0,
        url: repo.url,
        updatedAt: repo.updatedAt,
        primaryLanguage: repo.primaryLanguage?.name || 'Unknown',
        totalBytes,
        sizeKB: Math.round(totalBytes / 1024),
        architectureTags: [...new Set(architectureTags)],
        // semanticCommitRatio,
        commitQualityScore,
semanticCommitRatio,
meaningfulCommitRatio,
poorCommitRatio,
        totalCommits,
        prCount,
        readmeScore: Math.min(readmeScore, 100)
      };
    })
  );

  return { pinnedRepos: enriched };
}

module.exports = { fetchDeepGitHubData };