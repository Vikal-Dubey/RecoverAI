import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  max: 5,
  idleTimeoutMillis: 120000, // don't close connections just because Gemini took a while to respond
});

export const prisma = new PrismaClient({ adapter });