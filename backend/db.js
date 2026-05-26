import 'dotenv/config'; 
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error("check env file cant load .");
}

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
});

export default prisma;