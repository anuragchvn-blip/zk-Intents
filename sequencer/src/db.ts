import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to find .env file
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: process.env.DATABASE_URL ? {
      db: {
        url: process.env.DATABASE_URL,
      },
    } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
