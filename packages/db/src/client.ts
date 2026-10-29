import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

/** Prisma 7 talks to Postgres through a driver adapter (node-postgres). */
export function createDb(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error('Missing required env var DATABASE_URL');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
