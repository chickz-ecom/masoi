import { type Tx, sortIdsBySeat } from './internal';
import type { DeathCause, ProposedDeath } from './types';

/** Causes that let the Hunter shoot (unless also poisoned). */
const HUNTER_TRIGGER_CAUSES: DeathCause[] = ['WOLVES', 'VOTE'];

export function hunterCanShoot(causes: DeathCause[]): boolean {
  if (causes.includes('POISON')) return false;
  return causes.some((c) => HUNTER_TRIGGER_CAUSES.includes(c));
}

/**
 * Apply a set of deaths, including chain reactions (lovers die of heartbreak).
 * Queues Hunter reactions. Returns every player id that died, sorted by seat.
 * Does NOT check win conditions — callers must resolve pendingReactions first.
 */
export function applyDeaths(tx: Tx, deaths: ProposedDeath[]): string[] {
  const died: string[] = [];
  const queue: ProposedDeath[] = deaths.map((d) => ({ playerId: d.playerId, causes: [...new Set(d.causes)] }));

  while (queue.length > 0) {
    const next = queue.shift() as ProposedDeath;
    const player = tx.state.players.find((p) => p.id === next.playerId);
    if (!player || !player.alive) continue;

    player.alive = false;
    player.death = {
      causes: next.causes,
      phaseId: tx.state.phase.id,
      night: tx.state.nightNumber,
      day: tx.state.dayNumber,
    };
    died.push(player.id);
    tx.touch();

    if (player.role === 'hunter' && hunterCanShoot(next.causes)) {
      tx.state.pendingReactions.push({ kind: 'HUNTER_SHOT', hunterId: player.id });
    }

    if (player.loverId) {
      const lover = tx.state.players.find((p) => p.id === player.loverId);
      if (lover && lover.alive) queue.push({ playerId: lover.id, causes: ['HEARTBREAK'] });
    }
  }
  return sortIdsBySeat(tx.state, died);
}

/** Public announcement entries for deaths (role only when revealRoleOnDeath). */
export function publicDeathList(tx: Tx, ids: string[]): { playerId: string; role: string | null }[] {
  const reveal = tx.state.config.rules.revealRoleOnDeath;
  return ids.map((id) => ({ playerId: id, role: reveal ? tx.player(id).role : null }));
}
