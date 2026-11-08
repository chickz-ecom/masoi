import type { Ballot } from './types';

export interface TallyResult {
  tally: Record<string, number>;
  /** Candidates with the highest count (empty if no valid votes). */
  leaders: string[];
  topCount: number;
}

/**
 * Count valid ballots. A ballot is valid when its target is in `validTargets`.
 * Abstentions (null) and invalid targets count for nobody.
 */
export function tallyVotes(ballots: Record<string, Ballot>, validTargets: ReadonlySet<string>): TallyResult {
  const tally: Record<string, number> = {};
  for (const ballot of Object.values(ballots)) {
    if (ballot.targetId && validTargets.has(ballot.targetId)) {
      tally[ballot.targetId] = (tally[ballot.targetId] ?? 0) + 1;
    }
  }
  let topCount = 0;
  for (const n of Object.values(tally)) topCount = Math.max(topCount, n);
  const leaders = topCount > 0 ? Object.keys(tally).filter((id) => tally[id] === topCount) : [];
  return { tally, leaders, topCount };
}

/** Plurality of wolf choices. Returns all tied leaders; null-choices (no kill) count as a distinct option. */
export function tallyWolfVotes(votes: Record<string, string | null>): { leaders: (string | null)[]; top: number } {
  const counts = new Map<string | null, number>();
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  let top = 0;
  for (const n of counts.values()) top = Math.max(top, n);
  const leaders = top > 0 ? [...counts.entries()].filter(([, n]) => n === top).map(([t]) => t) : [];
  return { leaders, top };
}
