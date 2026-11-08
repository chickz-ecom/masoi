/**
 * Core domain types for the Werewolf engine.
 * The engine is pure: no I/O, no clock, no global randomness. Everything is passed in.
 */

export const ROLE_IDS = [
  'villager',
  'werewolf',
  'seer',
  'guardian',
  'witch',
  'hunter',
  'cupid',
  'elder',
  'white_wolf',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export type Team = 'village' | 'werewolf' | 'special';
export type Mode = 'AUTO' | 'HUMAN';

export const NIGHT_STEPS = ['CUPID', 'GUARD', 'WEREWOLVES', 'WHITE_WOLF', 'SEER', 'WITCH'] as const;
export type NightStepId = (typeof NIGHT_STEPS)[number];

export type DeathCause = 'WOLVES' | 'POISON' | 'VOTE' | 'HUNTER' | 'HEARTBREAK' | 'WHITE_WOLF' | 'MODERATOR';
export type Winner = 'VILLAGE' | 'WEREWOLF' | 'LOVERS' | 'WHITE_WOLF' | 'DRAW';
export type GameStatus = 'RUNNING' | 'ENDED' | 'ABORTED';

export type Deck = Partial<Record<RoleId, number>>;

export interface RuleConfig {
  wolvesKnowEachOther: boolean;
  wolvesCanTargetWolves: boolean;
  wolfTiePolicy: 'random' | 'no_kill';
  guardCanSelfProtect: boolean;
  guardSameTargetConsecutive: boolean;
  witchCanSelfHeal: boolean;
  witchBothPotionsSameNight: boolean;
  revealRoleOnDeath: boolean;
  revealVotes: boolean;
  allowSelfVote: boolean;
  allowVoteChange: boolean;
  runoffOnTie: boolean;
  allowSkipDiscussion: boolean;
  enableAdvancedRoles: boolean;
  deadCanSpectate: boolean;
  deadSeeAllRoles: boolean;
  onAllDisconnected: 'pause' | 'end';
  abandonAfterMinutes: number;
}

/** All durations in seconds. */
export interface TimerConfig {
  roleReveal: number;
  cupid: number;
  guard: number;
  werewolves: number;
  whiteWolf: number;
  seer: number;
  witch: number;
  fakeStepMin: number;
  fakeStepMax: number;
  dawn: number;
  hunter: number;
  discussion: number;
  voting: number;
  runoff: number;
  voteResult: number;
}

export interface GameConfig {
  rules: RuleConfig;
  timers: TimerConfig;
  deck: Deck;
}

export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export interface DeathInfo {
  causes: DeathCause[];
  phaseId: number;
  night: number;
  day: number;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  role: RoleId;
  alive: boolean;
  death: DeathInfo | null;
  loverId: string | null;
}

export interface Ballot {
  targetId: string | null; // null = abstain (phiếu trắng)
  locked: boolean;
}

interface PhaseBase {
  id: number;
  startedAt: number;
  endsAt: number | null;
  locked: boolean;
}

export type Phase =
  | (PhaseBase & { type: 'ROLE_REVEAL'; acks: string[] })
  | (PhaseBase & { type: 'NIGHT'; night: number; step: NightStepId; fake: boolean; actors: string[]; acted: string[] })
  | (PhaseBase & { type: 'DAWN'; confirmed: boolean })
  | (PhaseBase & {
      type: 'HUNTER_SHOT';
      hunterId: string;
      returnTo: 'DAY_DISCUSSION' | 'NIGHT';
      resolved: boolean;
      targetId: string | null;
    })
  | (PhaseBase & { type: 'DAY_DISCUSSION'; skipVotes: string[] })
  | (PhaseBase & { type: 'VOTING'; round: 1 | 2; candidates: string[] | null; ballots: Record<string, Ballot> })
  | (PhaseBase & {
      type: 'VOTE_RESULT';
      round: 1 | 2;
      confirmed: boolean;
      tally: Record<string, number>;
      eliminatedId: string | null;
    })
  | (PhaseBase & { type: 'GAME_OVER' });

export type PhaseType = Phase['type'];

export interface NightState {
  number: number;
  steps: NightStepId[];
  cupidLink: [string, string] | null;
  guardTarget: string | null;
  wolfVotes: Record<string, string | null>;
  wolfTarget: string | null;
  whiteWolfTarget: string | null;
  seerTarget: string | null;
  witchHeal: boolean;
  witchPoisonTarget: string | null;
}

export interface NightOutcomeDetails {
  wolfTarget: string | null;
  guardTarget: string | null;
  healed: boolean;
  poisonTarget: string | null;
  whiteWolfTarget: string | null;
  elderShielded: boolean;
}

export interface ProposedDeath {
  playerId: string;
  causes: DeathCause[];
}

export type PendingOutcome =
  | { kind: 'NIGHT'; deaths: ProposedDeath[]; details: NightOutcomeDetails }
  | { kind: 'VOTE'; eliminatedId: string | null; tally: Record<string, number>; round: 1 | 2 };

export type Reaction = { kind: 'HUNTER_SHOT'; hunterId: string };

export interface SeerResult {
  night: number;
  targetId: string;
  isWolf: boolean;
}

export interface RoleRuntimeState {
  guardLast: { targetId: string; night: number } | null;
  witch: { healUsed: boolean; poisonUsed: boolean };
  elderLivesLost: number;
  seerResults: SeerResult[];
  lovers: [string, string] | null;
}

export interface VoteRecord {
  day: number;
  round: 1 | 2;
  ballots: Record<string, Ballot>;
  tally: Record<string, number>;
  eliminatedId: string | null;
  outcome: 'ELIMINATED' | 'TIE_RUNOFF' | 'TIE_NO_ELIMINATION' | 'NO_VOTES';
}

export type TimelineKind =
  | 'GAME_STARTED'
  | 'NIGHT_STARTED'
  | 'GUARD_PROTECTED'
  | 'WOLVES_TARGETED'
  | 'WHITE_WOLF_TARGETED'
  | 'SEER_CHECKED'
  | 'WITCH_HEALED'
  | 'WITCH_POISONED'
  | 'LOVERS_LINKED'
  | 'ELDER_SHIELDED'
  | 'NIGHT_DEATHS'
  | 'HUNTER_SHOT'
  | 'DAY_STARTED'
  | 'VOTE_CLOSED'
  | 'PLAYER_ELIMINATED'
  | 'MODERATOR_OVERRIDE'
  | 'PAUSED'
  | 'RESUMED'
  | 'GAME_ENDED';

export interface TimelineEntry {
  at: number;
  phaseId: number;
  night: number;
  day: number;
  kind: TimelineKind;
  /** secret entries are only shown to the moderator during the game, and to everyone at game over. */
  secret: boolean;
  data: Record<string, unknown>;
}

export interface PauseState {
  at: number;
  by: 'moderator' | 'system';
  remainingMs: number | null;
  abandonAt: number | null;
}

export interface GameState {
  schemaVersion: 1;
  gameId: string;
  mode: Mode;
  status: GameStatus;
  config: GameConfig;
  players: PlayerState[];
  phase: Phase;
  phaseSeq: number;
  nightNumber: number;
  dayNumber: number;
  night: NightState | null;
  roles: RoleRuntimeState;
  pendingOutcome: PendingOutcome | null;
  pendingReactions: Reaction[];
  paused: PauseState | null;
  winner: Winner | null;
  winnerIds: string[];
  voteHistory: VoteRecord[];
  timeline: TimelineEntry[];
  startedAt: number;
  endedAt: number | null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type Actor = { kind: 'player'; playerId: string } | { kind: 'moderator' } | { kind: 'system' };

export type NightAction =
  | { kind: 'CUPID_LINK'; targetIds: [string, string] }
  | { kind: 'GUARD_PROTECT'; targetId: string | null }
  | { kind: 'WOLF_VOTE'; targetId: string | null }
  | { kind: 'WHITE_WOLF_KILL'; targetId: string | null }
  | { kind: 'SEER_CHECK'; targetId: string }
  | { kind: 'WITCH_ACT'; heal: boolean; poisonTargetId: string | null };

export type Command =
  | { type: 'TICK'; phaseId: number }
  | { type: 'ACK_ROLE'; phaseId: number }
  | { type: 'NIGHT_ACTION'; phaseId: number; action: NightAction }
  | { type: 'HUNTER_SHOOT'; phaseId: number; targetId: string | null }
  | { type: 'SKIP_DISCUSSION'; phaseId: number }
  | { type: 'VOTE'; phaseId: number; targetId: string | null; lock: boolean }
  | { type: 'MOD_NEXT' }
  | { type: 'MOD_PAUSE' }
  | { type: 'MOD_RESUME' }
  | { type: 'MOD_ADJUST_TIMER'; deltaSeconds: number }
  | { type: 'MOD_LOCK' }
  | { type: 'MOD_REOPEN'; seconds: number }
  | { type: 'MOD_CONFIRM'; override?: { deaths: string[] } | { eliminatedId: string | null } }
  | { type: 'MOD_END'; winner: Winner | null; reason?: string }
  | { type: 'SYS_PAUSE'; reason: string }
  | { type: 'SYS_RESUME' }
  | { type: 'SYS_ABORT'; reason: string };

export type CommandType = Command['type'];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type Visibility = { scope: 'public' } | { scope: 'players'; playerIds: string[] } | { scope: 'moderator' };

export type EngineEventType =
  | 'GAME_STARTED'
  | 'ROLE_ASSIGNED'
  | 'PHASE_CHANGED'
  | 'ROLE_ACTION_REQUESTED'
  | 'ROLE_ACTION_SUBMITTED'
  | 'SEER_RESULT'
  | 'WOLF_VOTES_UPDATED'
  | 'LOVERS_LINKED'
  | 'NIGHT_RESULT'
  | 'NIGHT_SUMMARY'
  | 'HUNTER_SHOT'
  | 'DISCUSSION_SKIP_UPDATED'
  | 'VOTE_SUBMITTED'
  | 'VOTING_ENDED'
  | 'PLAYER_ELIMINATED'
  | 'GAME_ENDED'
  | 'GAME_PAUSED'
  | 'GAME_RESUMED'
  | 'TIMER_ADJUSTED'
  | 'TIMER_EXPIRED'
  | 'AWAITING_MODERATOR'
  | 'MODERATOR_OVERRIDE';

export interface EngineEvent {
  type: EngineEventType;
  visibility: Visibility;
  payload: Record<string, unknown>;
}

export type EngineErrorCode =
  | 'GAME_OVER'
  | 'GAME_PAUSED'
  | 'STALE_PHASE'
  | 'WRONG_PHASE'
  | 'WRONG_STEP'
  | 'NOT_ALLOWED'
  | 'NOT_PARTICIPANT'
  | 'PLAYER_DEAD'
  | 'INVALID_TARGET'
  | 'ALREADY_ACTED'
  | 'PHASE_LOCKED'
  | 'NO_POTION'
  | 'NEEDS_CONFIRMATION'
  | 'ALREADY_CONFIRMED'
  | 'INVALID_OVERRIDE'
  | 'NOT_PAUSED'
  | 'ALREADY_PAUSED'
  | 'INVALID_COMMAND'
  | 'INVALID_SETUP';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ApplyResult =
  | { ok: true; state: GameState; events: EngineEvent[]; changed: boolean }
  | { ok: false; error: EngineError };

export interface EngineContext {
  now: number;
  rng: Rng;
}
