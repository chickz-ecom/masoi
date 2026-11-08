import { PrismaClient } from '@prisma/client';
import { ensureRoleDefinitions } from '../src/rooms/roleDefinitions';

const prisma = new PrismaClient();
ensureRoleDefinitions(prisma)
  // eslint-disable-next-line no-console
  .then(() => console.log('Role definitions seeded.'))
  .finally(() => prisma.$disconnect());
