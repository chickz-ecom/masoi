import { ROLE_LIST } from '@masoi/engine';
import type { Prisma, PrismaClient } from '@prisma/client';

/** Keep RoleDefinition rows in sync with the engine's role registry (idempotent). */
export async function ensureRoleDefinitions(prisma: PrismaClient): Promise<void> {
  for (const r of ROLE_LIST) {
    const data = {
      name: r.name,
      nameEn: r.nameEn,
      team: r.team,
      description: r.description,
      ability: r.ability,
      advanced: r.advanced,
      maxCount: r.maxCount,
      config: {
        isWolf: r.isWolf,
        nightStep: r.nightStep,
        resolutionPriority: r.resolutionPriority,
        usage: r.usage,
        targetRules: r.targetRules,
        visibility: r.visibility,
        winCondition: r.winCondition,
      } as Prisma.InputJsonValue,
    };
    await prisma.roleDefinition.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
  }
}
