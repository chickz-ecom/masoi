import { PrismaClient } from '@prisma/client';

export function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } }, log: ['warn', 'error'] });
}

export type { PrismaClient };
