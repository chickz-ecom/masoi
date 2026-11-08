import type { GameConfig, RuleConfig, TimerConfig } from './types';

export const RULESET_ID = 'classic-v1';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

export const DEFAULT_RULES: RuleConfig = {
  wolvesKnowEachOther: true,
  wolvesCanTargetWolves: false,
  wolfTiePolicy: 'random',
  guardCanSelfProtect: true,
  guardSameTargetConsecutive: false,
  witchCanSelfHeal: true,
  witchBothPotionsSameNight: false,
  revealRoleOnDeath: true,
  revealVotes: true,
  allowSelfVote: false,
  allowVoteChange: true,
  runoffOnTie: true,
  allowSkipDiscussion: true,
  enableAdvancedRoles: false,
  deadCanSpectate: true,
  deadSeeAllRoles: false,
  onAllDisconnected: 'pause',
  abandonAfterMinutes: 10,
};

export const DEFAULT_TIMERS: TimerConfig = {
  roleReveal: 15,
  cupid: 30,
  guard: 25,
  werewolves: 45,
  whiteWolf: 25,
  seer: 25,
  witch: 30,
  fakeStepMin: 6,
  fakeStepMax: 12,
  dawn: 8,
  hunter: 25,
  discussion: 180,
  voting: 60,
  runoff: 45,
  voteResult: 8,
};

/** Inclusive [min, max] bounds for each timer, in seconds. */
export const TIMER_LIMITS: Record<keyof TimerConfig, readonly [number, number]> = {
  roleReveal: [5, 60],
  cupid: [10, 120],
  guard: [10, 120],
  werewolves: [15, 180],
  whiteWolf: [10, 120],
  seer: [10, 120],
  witch: [10, 120],
  fakeStepMin: [2, 30],
  fakeStepMax: [2, 60],
  dawn: [3, 30],
  hunter: [10, 120],
  discussion: [30, 900],
  voting: [15, 300],
  runoff: [15, 300],
  voteResult: [3, 30],
};

export function defaultConfig(deck: GameConfig['deck'] = {}): GameConfig {
  return { rules: { ...DEFAULT_RULES }, timers: { ...DEFAULT_TIMERS }, deck: { ...deck } };
}

/** Clamp timers into allowed bounds and keep fakeStepMin <= fakeStepMax. */
export function normalizeTimers(input: Partial<TimerConfig>): TimerConfig {
  const out = { ...DEFAULT_TIMERS };
  for (const key of Object.keys(DEFAULT_TIMERS) as (keyof TimerConfig)[]) {
    const raw = input[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const [min, max] = TIMER_LIMITS[key];
      out[key] = Math.min(max, Math.max(min, Math.round(raw)));
    }
  }
  if (out.fakeStepMin > out.fakeStepMax) out.fakeStepMax = out.fakeStepMin;
  return out;
}

export function normalizeRules(input: Partial<RuleConfig>): RuleConfig {
  const out: RuleConfig = { ...DEFAULT_RULES };
  for (const key of Object.keys(DEFAULT_RULES) as (keyof RuleConfig)[]) {
    const raw = input[key];
    if (raw === undefined) continue;
    const def = DEFAULT_RULES[key];
    if (typeof def === typeof raw) {
      (out as unknown as Record<string, unknown>)[key] = raw;
    }
  }
  if (out.wolfTiePolicy !== 'random' && out.wolfTiePolicy !== 'no_kill') out.wolfTiePolicy = 'random';
  if (out.onAllDisconnected !== 'pause' && out.onAllDisconnected !== 'end') out.onAllDisconnected = 'pause';
  out.abandonAfterMinutes = Math.min(120, Math.max(1, Math.round(out.abandonAfterMinutes)));
  return out;
}
