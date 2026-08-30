import { prisma } from '../src/lib/prismaClient.js';

console.log('Warming up database connection...');
await prisma.customer.count();
console.log('✅ Database is warm and ready.');
process.exit(0);