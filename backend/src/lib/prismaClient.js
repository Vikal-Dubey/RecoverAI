import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000, // give Neon cold-start up to 20s to wake up
  max: 5,                          // small pool is fine for a solo dev/demo app
  idleTimeoutMillis: 30000,
});

export const prisma = new PrismaClient({ adapter });