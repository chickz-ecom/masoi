import { RULESET_ID } from './config';
import { deckToList, validateDeck } from './deck';
import {
  advance,
  afterHunterShot,
  applyNightOutcome,
  applyVoteElimination,
  endGame,
  onAllDone,
  phaseSummary,
  resolveHunterShot,
  voteTargets,
} from './flow';
import { EngineFailure, Tx, alivePlayers, fail, isWolf } from './internal';
import { applyNightAction, hunterTargets, isStepComplete } from './night';
import { shuffle } from './rng';
import type {
  Actor,
  ApplyResult,
  Command,
  EngineContext,
  EngineEvent,
  GameConfig,
  GameState,
  Mode,
  ProposedDeath,
  Rng,
} from './types';

export interface CreateGameInput {
  gameId: string;
  mode: Mode;
  config: GameConfig;
  players: { id: string; name: string; seat: number }[];
  now: number;
  rng: Rng;
}

/** Create a new game: validates the deck, assigns roles secretly and enters ROLE_REVEAL. */
export function createGame(input: CreateGameInput): { state: GameState; events: EngineEvent[] } {
  const { config, players, now, rng } = input;
  const issues = validateDeck(config.deck, players.length, config.rules);
  if (issues.length > 0) {
    throw new EngineFailure('INVALID_SETUP', issues.map((i) => i.message).join(' '));
  }
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) throw new EngineFailure('INVALID_SETUP', 'Trùng người chơi.');

  const roles = shuffle(deckToList(config.deck), rng);
  const state: GameState = {
    schemaVersion: 1,
    gameId: input.gameId,
    mode: input.mode,
    status: 'RUNNING',
    config: structuredClone(config),
    players: [...players]
      .sort((a, b) => a.seat - b.seat)
      .map((p, i) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        role: roles[i] as GameState['players'][number]['role'],
        alive: true,
        death: null,
        loverId: null,
      })),
    phase: {
      type: 'ROLE_REVEAL',
      id: 1,
      startedAt: now,
      endsAt: now + config.timers.roleReveal * 1000,
      locked: false,
      acks: [],
    },
    phaseSeq: 1,
    nightNumber: 0,
    dayNumber: 0,
    night: null,
    roles: {
      guardLast: null,
      witch: { healUsed: false, poisonUsed: false },
      elderLivesLost: 0,
      seerResults: [],
      lovers: null,
    },
    pendingOutcome: null,
    pendingReactions: [],
    paused: null,
    winner: null,
    winnerIds: [],
    voteHistory: [],
    timeline: [],
    startedAt: now,
    endedAt: null,
  };

  const tx = new Tx(state, now, rng);
  tx.emitPublic('GAME_STARTED', {
    gameId: state.gameId,
    mode: state.mode,
    ruleset: RULESET_ID,
    players: state.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat })),
    deck: config.deck,
  });
  const wolves = state.players.filter(isWolf).map((p) => p.id);
  for (const p of state.players) {
    const teammates = isWolf(p) && config.rules.wolvesKnowEachOther ? wolves.filter((id) => id !== p.id) : [];
    tx.emitTo([p.id], 'ROLE_ASSIGNED', { role: p.role, teammates });
  }
  tx.emitPublic('PHASE_CHANGED', phaseSummary(state.phase, 0, 0));
  tx.log('GAME_STARTED', false, { players: state.players.length, deck: config.deck });
  return { state: tx.state, events: tx.events };
}

/** The next moment the server must send a TICK for this game, or null. */
export function nextDeadline(state: GameState): number | null {
  if (state.status !== 'RUNNING') return null;
  if (state.paused) return state.paused.abandonAt;
  return state.phase.endsAt;
}

/**
 * Apply one command. Pure: the input state is never mutated.
 * Errors are returned (not thrown) for expected rule violations.
 */
export function applyCommand(state: GameState, actor: Actor, command: Command, ctx: EngineContext): ApplyResult {
  const tx = new Tx(structuredClone(state), ctx.now, ctx.rng);
  try {
    handle(tx, actor, command);
  } catch (err) {
    if (err instanceof EngineFailure) return { ok: false, error: err.toError() };
    throw err;
  }
  return { ok: true, state: tx.state, events: tx.events, changed: tx.changed };
}

function requirePlayer(tx: Tx, actor: Actor): string {
  if (actor.kind !== 'player') fail('NOT_ALLOWED', 'Chỉ người chơi mới thực hiện được hành động này.');
  if (!tx.state.players.some((p) => p.id === actor.playerId)) {
    fail('NOT_PARTICIPANT', 'Bạn không tham gia trận này.');
  }
  return actor.playerId;
}

function requireModerator(tx: Tx, actor: Actor): void {
  if (actor.kind !== 'moderator' || tx.state.mode !== 'HUMAN') {
    fail('NOT_ALLOWED', 'Chỉ quản trò mới có quyền này.');
  }
}

function requireSystem(actor: Actor): void {
  if (actor.kind !== 'system') fail('NOT_ALLOWED', 'Lệnh hệ thống.');
}

function requirePhaseId(tx: Tx, phaseId: number): void {
  if (phaseId !== tx.state.phase.id) fail('STALE_PHASE', 'Giai đoạn đã thay đổi, hành động không còn hiệu lực.');
}

function requireNotPaused(tx: Tx): void {
  if (tx.state.paused) fail('GAME_PAUSED', 'Trận đấu đang tạm dừng.');
}

function handle(tx: Tx, actor: Actor, command: Command): void {
  const s = tx.state;

  if (command.type === 'TICK') {
    requireSystem(actor);
    handleTick(tx, command.phaseId);
    return;
  }
  if (s.status !== 'RUNNING') fail('GAME_OVER', 'Trận đấu đã kết thúc.');

  switch (command.type) {
    // ----------------------------------------------------------------- players
    case 'ACK_ROLE': {
      const pid = requirePlayer(tx, actor);
      requireNotPaused(tx);
      requirePhaseId(tx, command.phaseId);
      const phase = s.phase;
      if (phase.type !== 'ROLE_REVEAL') fail('WRONG_PHASE', 'Không phải lúc xem vai.');
      if (phase.acks.includes(pid)) return;
      phase.acks.push(pid);
      tx.touch();
      if (s.players.every((p) => phase.acks.includes(p.id)) && !phase.locked) onAllDone(tx, 'ALL_ACKED');
      return;
    }
    case 'NIGHT_ACTION': {
      const pid = requirePlayer(tx, actor);
      requireNotPaused(tx);
      requirePhaseId(tx, command.phaseId);
      if (s.phase.type !== 'NIGHT') fail('WRONG_PHASE', 'Không phải ban đêm.');
      applyNightAction(tx, pid, command.action);
      if (isStepComplete(s)) onAllDone(tx, 'STEP_COMPLETE');
      return;
    }
    case 'HUNTER_SHOOT': {
      const pid = requirePlayer(tx, actor);
      requireNotPaused(tx);
      requirePhaseId(tx, command.phaseId);
      const phase = s.phase;
      if (phase.type !== 'HUNTER_SHOT') fail('WRONG_PHASE', 'Không phải lượt Thợ Săn.');
      if (phase.hunterId !== pid) fail('NOT_ALLOWED', 'Bạn không phải Thợ Săn đang ngắm bắn.');
      if (phase.resolved) fail('ALREADY_ACTED', 'Bạn đã bắn.');
      if (phase.locked) fail('PHASE_LOCKED', 'Đã hết thời gian.');
      if (command.targetId !== null && !hunterTargets(s, pid).includes(command.targetId)) {
        fail('INVALID_TARGET', 'Mục tiêu không hợp lệ.');
      }
      resolveHunterShot(tx, command.targetId);
      afterHunterShot(tx);
      return;
    }
    case 'SKIP_DISCUSSION': {
      const pid = requirePlayer(tx, actor);
      requireNotPaused(tx);
      requirePhaseId(tx, command.phaseId);
      const phase = s.phase;
      if (phase.type !== 'DAY_DISCUSSION') fail('WRONG_PHASE', 'Không phải lúc thảo luận.');
      if (!s.config.rules.allowSkipDiscussion) fail('NOT_ALLOWED', 'Luật chơi không cho phép bỏ qua thảo luận.');
      if (!tx.player(pid).alive) fail('PLAYER_DEAD', 'Người chết không thể bỏ phiếu bỏ qua.');
      if (phase.locked) fail('PHASE_LOCKED', 'Giai đoạn đã khóa.');
      if (phase.skipVotes.includes(pid)) return;
      phase.skipVotes.push(pid);
      const alive = alivePlayers(s);
      tx.emitPublic('DISCUSSION_SKIP_UPDATED', { count: phase.skipVotes.length, total: alive.length });
      if (alive.every((p) => phase.skipVotes.includes(p.id))) onAllDone(tx, 'ALL_SKIPPED');
      return;
    }
    case 'VOTE': {
      const pid = requirePlayer(tx, actor);
      requireNotPaused(tx);
      requirePhaseId(tx, command.phaseId);
      const phase = s.phase;
      if (phase.type !== 'VOTING') fail('WRONG_PHASE', 'Không phải lúc bỏ phiếu.');
      if (phase.locked) fail('PHASE_LOCKED', 'Đã đóng bỏ phiếu.');
      if (!tx.player(pid).alive) fail('PLAYER_DEAD', 'Người chết không thể bỏ phiếu.');
      if (command.targetId !== null && !voteTargets(tx, pid).includes(command.targetId)) {
        fail('INVALID_TARGET', 'Không thể bỏ phiếu cho người này.');
      }
      const existing = phase.ballots[pid];
      const canChange = s.config.rules.allowVoteChange;
      if (existing && (existing.locked || !canChange)) fail('ALREADY_ACTED', 'Phiếu của bạn đã được khóa.');
      phase.ballots[pid] = { targetId: command.targetId, locked: command.lock || !canChange };
      const alive = alivePlayers(s);
      const lockedCount = alive.filter((p) => phase.ballots[p.id]?.locked).length;
      const votedCount = alive.filter((p) => phase.ballots[p.id]).length;
      tx.emitPublic('VOTE_SUBMITTED', { lockedCount, votedCount, total: alive.length });
      tx.emitTo([pid], 'ROLE_ACTION_SUBMITTED', { step: 'VOTE', kind: 'VOTE', ...phase.ballots[pid] });
      tx.emitModerator('VOTE_SUBMITTED', { voterId: pid, ...phase.ballots[pid] });
      if (lockedCount === alive.length) onAllDone(tx, 'ALL_VOTED');
      return;
    }

    // --------------------------------------------------------------- moderator
    case 'MOD_NEXT': {
      requireModerator(tx, actor);
      requireNotPaused(tx);
      advance(tx);
      return;
    }
    case 'MOD_PAUSE': {
      requireModerator(tx, actor);
      pause(tx, 'moderator', 'moderator');
      return;
    }
    case 'MOD_RESUME': {
      requireModerator(tx, actor);
      resume(tx);
      return;
    }
    case 'MOD_ADJUST_TIMER': {
      requireModerator(tx, actor);
      requireNotPaused(tx);
      const phase = s.phase;
      if (phase.endsAt === null) fail('NOT_ALLOWED', 'Không có đồng hồ đang chạy.');
      const delta = Math.max(-600, Math.min(600, Math.round(command.deltaSeconds)));
      phase.endsAt = Math.max(tx.now + 5000, phase.endsAt + delta * 1000);
      tx.emitPublic('TIMER_ADJUSTED', { phaseId: phase.id, endsAt: phase.endsAt, locked: phase.locked });
      return;
    }
    case 'MOD_LOCK': {
      requireModerator(tx, actor);
      const phase = s.phase;
      if (!['ROLE_REVEAL', 'NIGHT', 'HUNTER_SHOT', 'DAY_DISCUSSION', 'VOTING'].includes(phase.type)) {
        fail('NOT_ALLOWED', 'Không thể khóa giai đoạn này.');
      }
      if (phase.locked) return;
      phase.locked = true;
      phase.endsAt = null;
      tx.emitPublic('TIMER_ADJUSTED', { phaseId: phase.id, endsAt: null, locked: true });
      return;
    }
    case 'MOD_REOPEN': {
      requireModerator(tx, actor);
      requireNotPaused(tx);
      const phase = s.phase;
      const reopenable =
        phase.type === 'NIGHT' || phase.type === 'VOTING' || (phase.type === 'HUNTER_SHOT' && !phase.resolved);
      if (!reopenable || !phase.locked) fail('NOT_ALLOWED', 'Không thể mở lại giai đoạn này.');
      const seconds = Math.max(5, Math.min(600, Math.round(command.seconds)));
      phase.locked = false;
      phase.endsAt = tx.now + seconds * 1000;
      tx.emitPublic('TIMER_ADJUSTED', { phaseId: phase.id, endsAt: phase.endsAt, locked: false });
      return;
    }
    case 'MOD_CONFIRM': {
      requireModerator(tx, actor);
      requireNotPaused(tx);
      confirm(tx, command.override);
      return;
    }
    case 'MOD_END': {
      requireModerator(tx, actor);
      tx.log('MODERATOR_OVERRIDE', true, { action: 'END_GAME', winner: command.winner, reason: command.reason });
      endGame(tx, command.winner, command.reason ?? 'MODERATOR_ENDED');
      return;
    }

    // ------------------------------------------------------------------ system
    case 'SYS_PAUSE': {
      requireSystem(actor);
      if (s.paused) {
        if (s.paused.abandonAt === null) {
          s.paused.abandonAt = tx.now + s.config.rules.abandonAfterMinutes * 60_000;
          tx.touch();
        }
        return;
      }
      pause(tx, 'system', command.reason);
      return;
    }
    case 'SYS_RESUME': {
      requireSystem(actor);
      if (!s.paused) return;
      if (s.paused.by !== 'system') {
        // Moderator paused manually; only clear the abandonment deadline.
        if (s.paused.abandonAt !== null) {
          s.paused.abandonAt = null;
          tx.touch();
        }
        return;
      }
      resume(tx);
      return;
    }
    case 'SYS_ABORT': {
      requireSystem(actor);
      endGame(tx, null, command.reason);
      return;
    }
    default: {
      const never: never = command;
      fail('INVALID_COMMAND', `Lệnh không hợp lệ: ${JSON.stringify(never)}`);
    }
  }
}

function handleTick(tx: Tx, phaseId: number): void {
  const s = tx.state;
  if (s.status !== 'RUNNING') return;
  if (s.paused) {
    if (s.paused.abandonAt !== null && tx.now >= s.paused.abandonAt) endGame(tx, null, 'ABANDONED');
    return;
  }
  const phase = s.phase;
  if (phaseId !== phase.id) return; // stale timer → no-op (idempotent)
  if (phase.endsAt === null || tx.now < phase.endsAt) return;

  if (s.mode === 'AUTO') {
    advance(tx);
    return;
  }
  // HUMAN: timers only lock actions; the moderator decides when to move on.
  phase.locked = true;
  phase.endsAt = null;
  tx.emitPublic('TIMER_ADJUSTED', { phaseId: phase.id, endsAt: null, locked: true });
  tx.emitModerator('TIMER_EXPIRED', { phaseId: phase.id, type: phase.type });
}

function pause(tx: Tx, by: 'moderator' | 'system', reason: string): void {
  const s = tx.state;
  if (s.paused) fail('ALREADY_PAUSED', 'Trận đấu đã tạm dừng.');
  const phase = s.phase;
  s.paused = {
    at: tx.now,
    by,
    remainingMs: phase.endsAt === null ? null : Math.max(0, phase.endsAt - tx.now),
    abandonAt: by === 'system' ? tx.now + s.config.rules.abandonAfterMinutes * 60_000 : null,
  };
  phase.endsAt = null;
  tx.emitPublic('GAME_PAUSED', { by, reason });
  tx.log('PAUSED', false, { by, reason });
}

function resume(tx: Tx): void {
  const s = tx.state;
  if (!s.paused) fail('NOT_PAUSED', 'Trận đấu không tạm dừng.');
  const remaining = s.paused.remainingMs;
  s.phase.endsAt = remaining === null ? null : tx.now + Math.max(remaining, 3000);
  s.paused = null;
  tx.emitPublic('GAME_RESUMED', { phaseId: s.phase.id, endsAt: s.phase.endsAt });
  tx.log('RESUMED', false, {});
}

function confirm(tx: Tx, override: { deaths: string[] } | { eliminatedId: string | null } | undefined): void {
  const s = tx.state;
  const phase = s.phase;
  const pending = s.pendingOutcome;
  const aliveIds = new Set(alivePlayers(s).map((p) => p.id));

  if (phase.type === 'DAWN') {
    if (phase.confirmed || !pending || pending.kind !== 'NIGHT') fail('ALREADY_CONFIRMED', 'Kết quả đã được công bố.');
    let deaths: ProposedDeath[] = pending.deaths;
    let details = pending.details;
    if (override) {
      if (!('deaths' in override)) fail('INVALID_OVERRIDE', 'Dữ liệu điều chỉnh không hợp lệ.');
      const ids = [...new Set(override.deaths)];
      if (ids.length !== override.deaths.length || ids.some((id) => !aliveIds.has(id))) {
        fail('INVALID_OVERRIDE', 'Danh sách người chết không hợp lệ.');
      }
      const proposed = new Map(pending.deaths.map((d) => [d.playerId, d.causes] as const));
      deaths = ids.map((id) => ({ playerId: id, causes: proposed.get(id) ?? ['MODERATOR'] }));
      details = {
        ...details,
        elderShielded: details.elderShielded && !ids.includes(details.wolfTarget ?? ''),
      };
      tx.emitModerator('MODERATOR_OVERRIDE', { kind: 'NIGHT', before: pending.deaths, after: deaths });
      tx.log('MODERATOR_OVERRIDE', true, { kind: 'NIGHT', before: pending.deaths, after: deaths });
    }
    applyNightOutcome(tx, deaths, details);
    return;
  }

  if (phase.type === 'VOTE_RESULT') {
    if (phase.confirmed || !pending || pending.kind !== 'VOTE') fail('ALREADY_CONFIRMED', 'Kết quả đã được công bố.');
    let eliminatedId = pending.eliminatedId;
    if (override) {
      if (!('eliminatedId' in override)) fail('INVALID_OVERRIDE', 'Dữ liệu điều chỉnh không hợp lệ.');
      if (override.eliminatedId !== null && !aliveIds.has(override.eliminatedId)) {
        fail('INVALID_OVERRIDE', 'Người bị loại không hợp lệ.');
      }
      if (override.eliminatedId !== pending.eliminatedId) {
        tx.emitModerator('MODERATOR_OVERRIDE', {
          kind: 'VOTE',
          before: pending.eliminatedId,
          after: override.eliminatedId,
        });
        tx.log('MODERATOR_OVERRIDE', true, { kind: 'VOTE', before: pending.eliminatedId, after: override.eliminatedId });
      }
      eliminatedId = override.eliminatedId;
    }
    applyVoteElimination(tx, eliminatedId);
    return;
  }
  fail('WRONG_PHASE', 'Không có kết quả nào cần xác nhận.');
}

