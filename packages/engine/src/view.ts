import { voteTargets } from './flow';
import { isWolf } from './internal';
import {
  cupidTargets,
  guardTargets,
  hunterTargets,
  seerTargets,
  currentStepActors,
  whiteWolfTargets,
  witchCanHeal,
  witchPoisonTargets,
  wolfTargets,
} from './night';
import { ROLES } from './roles';
import type {
  Ballot,
  DeathCause,
  Deck,
  GameState,
  GameStatus,
  Mode,
  NightState,
  NightStepId,
  PendingOutcome,
  PhaseType,
  PlayerState,
  Reaction,
  RoleId,
  RoleRuntimeState,
  RuleConfig,
  SeerResult,
  Team,
  TimelineEntry,
  TimerConfig,
  VoteRecord,
  Winner,
} from './types';

export type Viewer = { kind: 'player'; playerId: string } | { kind: 'moderator' } | { kind: 'spectator' };

export type ActionPrompt =
  | { kind: 'ACK_ROLE' }
  | { kind: 'CUPID_LINK'; targets: string[] }
  | { kind: 'GUARD_PROTECT'; targets: string[]; lastTargetId: string | null }
  | { kind: 'WOLF_VOTE'; targets: string[]; current: string | null | undefined }
  | { kind: 'WHITE_WOLF_KILL'; targets: string[] }
  | { kind: 'SEER_CHECK'; targets: string[] }
  | {
      kind: 'WITCH_ACT';
      attackedId: string | null;
      canHeal: boolean;
      poisonTargets: string[];
      canUseBoth: boolean;
    }
  | { kind: 'HUNTER_SHOOT'; targets: string[] }
  | { kind: 'SKIP_DISCUSSION'; skipped: boolean }
  | { kind: 'VOTE'; targets: string[]; current: Ballot | null; canChange: boolean };

export interface PhaseView {
  id: number;
  type: PhaseType;
  step: NightStepId | null;
  startedAt: number;
  endsAt: number | null;
  locked: boolean;
  round: 1 | 2 | null;
  candidates: string[] | null;
  hunterId: string | null;
  hunterTargetId: string | null;
  hunterResolved: boolean | null;
  confirmed: boolean | null;
  tally: Record<string, number> | null;
  eliminatedId: string | null;
  /** Deaths announced during this phase (dawn, vote result, hunter shot). */
  announcedDeaths: { playerId: string; role: RoleId | null }[];
  /** Public progress (role acks, discussion skips, locked votes). Never for night steps. */
  progress: { done: number; total: number } | null;
  awaitingModerator: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  alive: boolean;
  role: RoleId | null;
  deathCauses: DeathCause[] | null;
  diedAt: { night: number; day: number } | null;
  isMe: boolean;
  isTeammate: boolean;
  isLover: boolean;
}

export interface MyView {
  playerId: string;
  role: RoleId;
  team: Team;
  alive: boolean;
  teammates: string[];
  lover: { playerId: string; role: RoleId } | null;
  seerResults: SeerResult[];
  potions: { heal: boolean; poison: boolean } | null;
  prompt: ActionPrompt | null;
  submitted: boolean;
  /** True when this player is dead and the room does not allow dead players to spectate. */
  restricted: boolean;
}

export interface ModeratorView {
  roles: Record<string, RoleId>;
  night: NightState | null;
  fakeStep: boolean;
  actionStatus: { playerId: string; role: RoleId; done: boolean; detail: string | null }[];
  pendingOutcome: PendingOutcome | null;
  ballots: Record<string, Ballot> | null;
  pendingReactions: Reaction[];
  roleState: RoleRuntimeState;
  canAdvance: boolean;
  needsConfirmation: boolean;
}

export interface GameView {
  gameId: string;
  mode: Mode;
  status: GameStatus;
  viewer: Viewer['kind'];
  phase: PhaseView;
  paused: { by: 'moderator' | 'system'; at: number } | null;
  nightNumber: number;
  dayNumber: number;
  deck: Deck;
  rules: RuleConfig;
  timers: TimerConfig;
  players: PlayerView[];
  me: MyView | null;
  wolfVotes: Record<string, string | null> | null;
  voteHistory: VoteRecord[];
  timeline: TimelineEntry[];
  moderator: ModeratorView | null;
  winner: Winner | null;
  winnerIds: string[];
}

function canSeeRole(state: GameState, viewer: Viewer, viewerPlayer: PlayerState | undefined, target: PlayerState): boolean {
  if (viewer.kind === 'moderator') return true;
  if (state.phase.type === 'GAME_OVER') return true;
  if (!target.alive && state.config.rules.revealRoleOnDeath) return true;
  if (!viewerPlayer) return false;
  if (viewerPlayer.id === target.id) return true;
  if (!viewerPlayer.alive && state.config.rules.deadSeeAllRoles) return true;
  if (isWolf(viewerPlayer) && isWolf(target) && state.config.rules.wolvesKnowEachOther) return true;
  if (viewerPlayer.loverId === target.id) return true;
  return false;
}

function phaseProgress(state: GameState): PhaseView['progress'] {
  const phase = state.phase;
  const alive = state.players.filter((p) => p.alive);
  switch (phase.type) {
    case 'ROLE_REVEAL':
      return { done: phase.acks.length, total: state.players.length };
    case 'DAY_DISCUSSION':
      return { done: phase.skipVotes.length, total: alive.length };
    case 'VOTING':
      return { done: alive.filter((p) => phase.ballots[p.id]?.locked).length, total: alive.length };
    default:
      return null;
  }
}

function buildPhaseView(state: GameState): PhaseView {
  const phase = state.phase;
  const reveal = state.config.rules.revealRoleOnDeath || phase.type === 'GAME_OVER';
  const announcedDeaths = state.players
    .filter((p) => p.death?.phaseId === phase.id && phase.type !== 'GAME_OVER')
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ playerId: p.id, role: reveal ? p.role : null }));
  const awaitingModerator =
    state.mode === 'HUMAN' &&
    state.status === 'RUNNING' &&
    ((phase.type === 'DAWN' && !phase.confirmed) ||
      (phase.type === 'VOTE_RESULT' && !phase.confirmed) ||
      (phase.locked && phase.endsAt === null));
  return {
    id: phase.id,
    type: phase.type,
    step: phase.type === 'NIGHT' ? phase.step : null,
    startedAt: phase.startedAt,
    endsAt: phase.endsAt,
    locked: phase.locked,
    round: phase.type === 'VOTING' || phase.type === 'VOTE_RESULT' ? phase.round : null,
    candidates: phase.type === 'VOTING' ? phase.candidates : null,
    hunterId: phase.type === 'HUNTER_SHOT' ? phase.hunterId : null,
    hunterTargetId: phase.type === 'HUNTER_SHOT' ? phase.targetId : null,
    hunterResolved: phase.type === 'HUNTER_SHOT' ? phase.resolved : null,
    confirmed: phase.type === 'DAWN' || phase.type === 'VOTE_RESULT' ? phase.confirmed : null,
    tally: phase.type === 'VOTE_RESULT' ? phase.tally : null,
    eliminatedId: phase.type === 'VOTE_RESULT' && phase.confirmed ? phase.eliminatedId : null,
    announcedDeaths,
    progress: phaseProgress(state),
    awaitingModerator,
  };
}

function buildPrompt(state: GameState, me: PlayerState): { prompt: ActionPrompt | null; submitted: boolean } {
  const phase = state.phase;
  if (state.status !== 'RUNNING' || state.paused) return { prompt: null, submitted: false };
  switch (phase.type) {
    case 'ROLE_REVEAL': {
      const acked = phase.acks.includes(me.id);
      return { prompt: acked ? null : { kind: 'ACK_ROLE' }, submitted: acked };
    }
    case 'NIGHT': {
      if (phase.locked || !me.alive) return { prompt: null, submitted: false };
      const isActor = currentStepActors(state).some((a) => a.id === me.id);
      if (!isActor) return { prompt: null, submitted: false };
      const night = state.night as NightState;
      const submitted =
        phase.step === 'WEREWOLVES' ? me.id in night.wolfVotes : phase.acted.includes(me.id);
      if (phase.step !== 'WEREWOLVES' && submitted) return { prompt: null, submitted: true };
      switch (phase.step) {
        case 'CUPID':
          return { prompt: { kind: 'CUPID_LINK', targets: cupidTargets(state) }, submitted };
        case 'GUARD':
          return {
            prompt: {
              kind: 'GUARD_PROTECT',
              targets: guardTargets(state, me.id),
              lastTargetId:
                state.roles.guardLast && state.roles.guardLast.night === state.nightNumber - 1
                  ? state.roles.guardLast.targetId
                  : null,
            },
            submitted,
          };
        case 'WEREWOLVES':
          return {
            prompt: { kind: 'WOLF_VOTE', targets: wolfTargets(state), current: night.wolfVotes[me.id] },
            submitted,
          };
        case 'WHITE_WOLF':
          return { prompt: { kind: 'WHITE_WOLF_KILL', targets: whiteWolfTargets(state, me.id) }, submitted };
        case 'SEER':
          return { prompt: { kind: 'SEER_CHECK', targets: seerTargets(state, me.id) }, submitted };
        case 'WITCH':
          return {
            prompt: {
              kind: 'WITCH_ACT',
              attackedId: night.wolfTarget,
              canHeal: witchCanHeal(state, me.id),
              poisonTargets: witchPoisonTargets(state, me.id),
              canUseBoth: state.config.rules.witchBothPotionsSameNight,
            },
            submitted,
          };
      }
      return { prompt: null, submitted };
    }
    case 'HUNTER_SHOT': {
      if (phase.hunterId !== me.id || phase.resolved || phase.locked) {
        return { prompt: null, submitted: phase.hunterId === me.id && phase.resolved };
      }
      return { prompt: { kind: 'HUNTER_SHOOT', targets: hunterTargets(state, me.id) }, submitted: false };
    }
    case 'DAY_DISCUSSION': {
      if (!me.alive || phase.locked || !state.config.rules.allowSkipDiscussion) {
        return { prompt: null, submitted: false };
      }
      const skipped = phase.skipVotes.includes(me.id);
      return { prompt: { kind: 'SKIP_DISCUSSION', skipped }, submitted: skipped };
    }
    case 'VOTING': {
      if (!me.alive || phase.locked) return { prompt: null, submitted: Boolean(phase.ballots[me.id]) };
      const ballot = phase.ballots[me.id] ?? null;
      return {
        prompt: {
          kind: 'VOTE',
          targets: voteTargets({ state }, me.id),
          current: ballot,
          canChange: state.config.rules.allowVoteChange,
        },
        submitted: Boolean(ballot?.locked),
      };
    }
    default:
      return { prompt: null, submitted: false };
  }
}

function buildModeratorView(state: GameState): ModeratorView {
  const phase = state.phase;
  let actionStatus: ModeratorView['actionStatus'] = [];
  const name = (id: string | null | undefined) =>
    id ? (state.players.find((p) => p.id === id)?.name ?? id) : null;
  if (phase.type === 'NIGHT') {
    const night = state.night as NightState;
    actionStatus = currentStepActors(state).map((p) => {
      const done = phase.step === 'WEREWOLVES' ? p.id in night.wolfVotes : phase.acted.includes(p.id);
      const detail = phase.step === 'WEREWOLVES' && p.id in night.wolfVotes ? (name(night.wolfVotes[p.id]) ?? 'Không giết') : null;
      return { playerId: p.id, role: p.role, done, detail };
    });
  } else if (phase.type === 'ROLE_REVEAL') {
    actionStatus = state.players.map((p) => ({ playerId: p.id, role: p.role, done: phase.acks.includes(p.id), detail: null }));
  } else if (phase.type === 'DAY_DISCUSSION') {
    actionStatus = state.players
      .filter((p) => p.alive)
      .map((p) => ({ playerId: p.id, role: p.role, done: phase.skipVotes.includes(p.id), detail: null }));
  } else if (phase.type === 'VOTING') {
    actionStatus = state.players
      .filter((p) => p.alive)
      .map((p) => {
        const b = phase.ballots[p.id];
        return {
          playerId: p.id,
          role: p.role,
          done: Boolean(b?.locked),
          detail: b ? (b.targetId ? name(b.targetId) : 'Phiếu trắng') : null,
        };
      });
  } else if (phase.type === 'HUNTER_SHOT') {
    const hunter = state.players.find((p) => p.id === phase.hunterId);
    if (hunter) {
      actionStatus = [
        {
          playerId: hunter.id,
          role: hunter.role,
          done: phase.resolved,
          detail: phase.resolved ? (name(phase.targetId) ?? 'Không bắn') : null,
        },
      ];
    }
  }
  const needsConfirmation =
    (phase.type === 'DAWN' || phase.type === 'VOTE_RESULT') && !phase.confirmed && state.status === 'RUNNING';
  return {
    roles: Object.fromEntries(state.players.map((p) => [p.id, p.role])),
    night: state.night,
    fakeStep: phase.type === 'NIGHT' ? phase.fake : false,
    actionStatus,
    pendingOutcome: state.pendingOutcome,
    ballots: phase.type === 'VOTING' ? phase.ballots : null,
    pendingReactions: state.pendingReactions,
    roleState: state.roles,
    canAdvance: state.status === 'RUNNING' && !state.paused && !needsConfirmation,
    needsConfirmation,
  };
}

/**
 * Project the authoritative state into what a specific viewer is allowed to know.
 * This is the ONLY way state leaves the server.
 */
export function projectView(state: GameState, viewer: Viewer): GameView {
  const gameOver = state.phase.type === 'GAME_OVER';
  const isModerator = viewer.kind === 'moderator';
  const viewerPlayer = viewer.kind === 'player' ? state.players.find((p) => p.id === viewer.playerId) : undefined;

  const players: PlayerView[] = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const showRole = canSeeRole(state, viewer, viewerPlayer, p);
      return {
        id: p.id,
        name: p.name,
        seat: p.seat,
        alive: p.alive,
        role: showRole ? p.role : null,
        deathCauses: (isModerator || gameOver) && p.death ? p.death.causes : null,
        diedAt: p.death ? { night: p.death.night, day: p.death.day } : null,
        isMe: viewerPlayer?.id === p.id,
        isTeammate:
          Boolean(viewerPlayer) &&
          viewerPlayer?.id !== p.id &&
          state.config.rules.wolvesKnowEachOther &&
          isWolf(viewerPlayer as PlayerState) &&
          isWolf(p),
        isLover: Boolean(viewerPlayer && viewerPlayer.loverId === p.id),
      };
    });

  let me: MyView | null = null;
  if (viewerPlayer) {
    const { prompt, submitted } = buildPrompt(state, viewerPlayer);
    const def = ROLES[viewerPlayer.role];
    const lover = viewerPlayer.loverId ? state.players.find((p) => p.id === viewerPlayer.loverId) : undefined;
    me = {
      playerId: viewerPlayer.id,
      role: viewerPlayer.role,
      team: def.team,
      alive: viewerPlayer.alive,
      teammates: players.filter((p) => p.isTeammate).map((p) => p.id),
      lover: lover ? { playerId: lover.id, role: lover.role } : null,
      seerResults: viewerPlayer.role === 'seer' ? state.roles.seerResults : [],
      potions:
        viewerPlayer.role === 'witch'
          ? { heal: !state.roles.witch.healUsed, poison: !state.roles.witch.poisonUsed }
          : null,
      prompt,
      submitted,
      restricted: !viewerPlayer.alive && !state.config.rules.deadCanSpectate && !gameOver,
    };
  }

  const viewerIsActiveWolf =
    viewerPlayer && viewerPlayer.alive && isWolf(viewerPlayer) && state.phase.type === 'NIGHT';
  const wolfVotes =
    (isModerator || viewerIsActiveWolf) && state.night && state.phase.type === 'NIGHT' && state.phase.step === 'WEREWOLVES'
      ? { ...state.night.wolfVotes }
      : null;

  const revealBallots = state.config.rules.revealVotes || isModerator || gameOver;
  const voteHistory = state.voteHistory.map((r) => (revealBallots ? r : { ...r, ballots: {} }));
  const timeline = state.timeline.filter((e) => !e.secret || isModerator || gameOver);

  return {
    gameId: state.gameId,
    mode: state.mode,
    status: state.status,
    viewer: viewer.kind,
    phase: buildPhaseView(state),
    paused: state.paused ? { by: state.paused.by, at: state.paused.at } : null,
    nightNumber: state.nightNumber,
    dayNumber: state.dayNumber,
    deck: state.config.deck,
    rules: state.config.rules,
    timers: state.config.timers,
    players,
    me,
    wolfVotes,
    voteHistory,
    timeline,
    moderator: isModerator ? buildModeratorView(state) : null,
    winner: state.winner,
    winnerIds: state.winnerIds,
  };
}
