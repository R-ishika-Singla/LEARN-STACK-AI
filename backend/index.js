import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js'; // Humari naye route file

// Environment variables configure karna
dotenv.config();

const app = express();

// Middlewares setup
app.use(cors());          // Taaki frontend bina nakhre ke request bhej sake
app.use(express.json());  // Taaki server JSON data ko samajh sake (req.body)

// Routes mapping
app.use('/api/auth', authRoutes); // Saare auth ke raste ab /api/auth/register ya /api/auth/login ban gaye

app.get('/', (req, res) => {
    res.send('LearnStack Server properly running with Auth Router!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Bhai server ${PORT} port par mast chal raha hai!`);
});