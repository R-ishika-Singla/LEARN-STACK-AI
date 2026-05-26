import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js'; 
import executionRoutes from './routes/execution.js';

dotenv.config();

const app = express();

app.use(cors());          
app.use(express.json());  

app.use('/api/auth', authRoutes); 
app.use('/api/execution', executionRoutes);
app.get('/', (req, res) => {
    res.send(' Server properly running with Auth Router!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Bhai server ${PORT} port par mast chal raha hai!`);
});