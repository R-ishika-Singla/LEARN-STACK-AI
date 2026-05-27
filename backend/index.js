const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
    console.log(' CORS request from origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(' CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

console.log('CORS enabled for:', ['http://localhost:5173', 'http://localhost:3000']);
console.log(' Using port 5001 for non-Mac systems');

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the DevSphere API Gateway' });
})

const http = require('http');
const initSocket = require('./services/socketService');

const authRoutes = require('./routes/auth');
const executionRoutes = require('./routes/execution');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/auth', authRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/analytics', analyticsRoutes);

const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` API endpoints:`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Analytics: http://localhost:${PORT}/api/analytics`);
  console.log(`   - Execution: http://localhost:${PORT}/api/execution`);
});
