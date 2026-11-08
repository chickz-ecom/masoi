import { applyDeaths, publicDeathList } from './deaths';
import { type Tx, alivePlayers, fail, sortIdsBySeat } from './internal';
import {
  finalizeWolfTarget,
  hunterTargets,
  newNightState,
  planNightSteps,
  resolveNight,
  stepActors,
} from './night';
import type { NightOutcomeDetails, NightStepId, Phase, ProposedDeath, TimerConfig, Winner } from './types';
import { tallyVotes } from './voting';
import { checkWinner, winnerIds } from './win';

const STEP_TIMER: Record<NightStepId, keyof TimerConfig> = {
  CUPID: 'cupid',
  GUARD: 'guard',
  WEREWOLVES: 'werewolves',
  WHITE_WOLF: 'whiteWolf',
  SEER: 'seer',
  WITCH: 'witch',
};

/** Public, non-sensitive summary of a phase (used in PHASE_CHANGED). */
export function phaseSummary(phase: Phase, nightNumber: number, dayNumber: number): Record<string, unknown> {
  return {
    phaseId: phase.id,
    type: phase.type,
    step: phase.type === 'NIGHT' ? phase.step : null,
    night: nightNumber,
    day: dayNumber,
    endsAt: phase.endsAt,
    round: phase.type === 'VOTING' || phase.type === 'VOTE_RESULT' ? phase.round : null,
    candidates: phase.type === 'VOTING' ? phase.candidates : null,
    hunterId: phase.type === 'HUNTER_SHOT' ? phase.hunterId : null,
  };
}

type PhaseBody = Phase extends infer P
  ? P extends Phase
    ? Omit<P, 'id' | 'startedAt' | 'endsAt' | 'locked'>
    : never
  : never;

function setPhase(tx: Tx, body: PhaseBody, durationSec: number | null): void {
  const s = tx.state;
  s.phaseSeq += 1;
  s.phase = {
    ...body,
    id: s.phaseSeq,
    startedAt: tx.now,
    endsAt: durationSec === null ? null : tx.now + Math.round(durationSec * 1000),
    locked: false,
  } as Phase;
  tx.emitPublic('PHASE_CHANGED', phaseSummary(s.phase, s.nightNumber, s.dayNumber));
}

/** Tell the moderator that the phase is ready to advance (HUMAN mode). */
function awaitModerator(tx: Tx, reason: string): void {
  tx.emitModerator('AWAITING_MODERATOR', { reason, phaseId: tx.state.phase.id });
}

// ---------------------------------------------------------------------------
// Night
// ---------------------------------------------------------------------------

export function enterNight(tx: Tx): void {
  const s = tx.state;
  s.nightNumber += 1;
  s.night = newNightState(s.nightNumber, planNightSteps(s, s.nightNumber));
  tx.log('NIGHT_STARTED', false, { night: s.nightNumber });
  enterNightStep(tx, s.night.steps[0] as NightStepId);
}

function enterNightStep(tx: Tx, step: NightStepId): void {
  const s = tx.state;
  const actors = stepActors(s, step);
  const fake = actors.length === 0;
  const { fakeStepMin, fakeStepMax } = s.config.timers;
  const duration = fake
    ? fakeStepMin + tx.rng.int(Math.max(1, fakeStepMax - fakeStepMin + 1))
    : s.config.timers[STEP_TIMER[step]];
  setPhase(
    tx,
    { type: 'NIGHT', night: s.nightNumber, step, fake, actors: actors.map((a) => a.id), acted: [] },
    duration,
  );
  tx.emitTo(
    actors.map((a) => a.id),
    'ROLE_ACTION_REQUESTED',
    { step, phaseId: s.phase.id },
  );
}

export function finishNightStep(tx: Tx): void {
  const s = tx.state;
  const phase = s.phase;
  if (phase.type !== 'NIGHT' || !s.night) fail('WRONG_PHASE', 'Không phải ban đêm.');
  if (phase.step === 'WEREWOLVES') finalizeWolfTarget(tx);
  const idx = s.night.steps.indexOf(phase.step);
  const next = s.night.steps[idx + 1];
  if (next) enterNightStep(tx, next);
  else endNight(tx);
}

function endNight(tx: Tx): void {
  const s = tx.state;
  const outcome = resolveNight(s);
  s.dayNumber = s.nightNumber;
  if (s.mode === 'AUTO') {
    setPhase(tx, { type: 'DAWN', confirmed: true }, s.config.timers.dawn);
    applyNightOutcome(tx, outcome.deaths, outcome.details);
  } else {
    s.pendingOutcome = { kind: 'NIGHT', deaths: outcome.deaths, details: outcome.details };
    setPhase(tx, { type: 'DAWN', confirmed: false }, null);
    tx.emitModerator('NIGHT_SUMMARY', { deaths: outcome.deaths, details: outcome.details });
    awaitModerator(tx, 'CONFIRM_NIGHT');
  }
}

export function applyNightOutcome(tx: Tx, deaths: ProposedDeath[], details: NightOutcomeDetails): void {
  const s = tx.state;
  if (details.elderShielded) {
    s.roles.elderLivesLost += 1;
    tx.log('ELDER_SHIELDED', true, { elderId: details.wolfTarget });
  }
  const died = applyDeaths(tx, deaths);
  const announced = publicDeathList(tx, died);
  if (s.phase.type === 'DAWN') s.phase.confirmed = true;
  s.pendingOutcome = null;
  tx.emitPublic('NIGHT_RESULT', { night: s.nightNumber, deaths: announced });
  tx.log('NIGHT_DEATHS', false, { night: s.nightNumber, deaths: announced });
  tx.log('DAY_STARTED', false, { day: s.dayNumber });
}

// ---------------------------------------------------------------------------
// After deaths: reactions → win check → next phase
// ---------------------------------------------------------------------------

export function continueAfterDeaths(tx: Tx, next: 'DAY_DISCUSSION' | 'NIGHT'): void {
  const s = tx.state;
  const reaction = s.pendingReactions[0];
  if (reaction) {
    setPhase(
      tx,
      { type: 'HUNTER_SHOT', hunterId: reaction.hunterId, returnTo: next, resolved: false, targetId: null },
      s.config.timers.hunter,
    );
    tx.emitTo([reaction.hunterId], 'ROLE_ACTION_REQUESTED', { step: 'HUNTER', phaseId: s.phase.id });
    return;
  }
  const winner = checkWinner(s);
  if (winner) {
    endGame(tx, winner, null);
    return;
  }
  if (next === 'DAY_DISCUSSION') setPhase(tx, { type: 'DAY_DISCUSSION', skipVotes: [] }, s.config.timers.discussion);
  else enterNight(tx);
}

export function resolveHunterShot(tx: Tx, targetId: string | null): void {
  const s = tx.state;
  const phase = s.phase;
  if (phase.type !== 'HUNTER_SHOT') fail('WRONG_PHASE', 'Không phải lượt Thợ Săn.');
  if (targetId !== null && !hunterTargets(s, phase.hunterId).includes(targetId)) {
    fail('INVALID_TARGET', 'Mục tiêu không hợp lệ.');
  }
  phase.resolved = true;
  phase.targetId = targetId;
  s.pendingReactions = s.pendingReactions.filter(
    (r) => !(r.kind === 'HUNTER_SHOT' && r.hunterId === phase.hunterId),
  );
  const died = targetId ? applyDeaths(tx, [{ playerId: targetId, causes: ['HUNTER'] }]) : [];
  const announced = publicDeathList(tx, died);
  tx.emitPublic('HUNTER_SHOT', { hunterId: phase.hunterId, targetId, deaths: announced });
  tx.log('HUNTER_SHOT', false, { hunterId: phase.hunterId, targetId, deaths: announced });
}

/** After a Hunter shot is resolved, either continue immediately (AUTO) or wait (HUMAN). */
export function afterHunterShot(tx: Tx): void {
  const phase = tx.state.phase;
  if (phase.type !== 'HUNTER_SHOT') return;
  if (tx.state.mode === 'AUTO') {
    continueAfterDeaths(tx, phase.returnTo);
  } else {
    phase.locked = true;
    phase.endsAt = null;
    awaitModerator(tx, 'HUNTER_RESOLVED');
  }
}

// ---------------------------------------------------------------------------
// Day: discussion & voting
// ---------------------------------------------------------------------------

export function enterVoting(tx: Tx, round: 1 | 2, candidates: string[] | null): void {
  const s = tx.state;
  setPhase(
    tx,
    { type: 'VOTING', round, candidates: candidates ? sortIdsBySeat(s, candidates) : null, ballots: {} },
    round === 1 ? s.config.timers.voting : s.config.timers.runoff,
  );
}

export function voteTargets(tx: Tx | { state: Tx['state'] }, voterId: string): string[] {
  const s = tx.state;
  const phase = s.phase;
  if (phase.type !== 'VOTING') return [];
  const base = phase.candidates ?? alivePlayers(s).map((p) => p.id);
  return base.filter((id) => {
    const p = s.players.find((pl) => pl.id === id);
    if (!p?.alive) return false;
    return s.config.rules.allowSelfVote || id !== voterId;
  });
}

export function closeVoting(tx: Tx): void {
  const s = tx.state;
  const phase = s.phase;
  if (phase.type !== 'VOTING') fail('WRONG_PHASE', 'Không phải lúc bỏ phiếu.');
  const aliveIds = new Set(alivePlayers(s).map((p) => p.id));
  const valid = new Set((phase.candidates ?? [...aliveIds]).filter((id) => aliveIds.has(id)));
  // Only ballots from voters still alive count.
  const ballots = Object.fromEntries(Object.entries(phase.ballots).filter(([voter]) => aliveIds.has(voter)));
  const { tally, leaders } = tallyVotes(ballots, valid);

  let outcome: 'ELIMINATED' | 'TIE_RUNOFF' | 'TIE_NO_ELIMINATION' | 'NO_VOTES';
  let eliminatedId: string | null = null;
  if (leaders.length === 0) outcome = 'NO_VOTES';
  else if (leaders.length === 1) {
    outcome = 'ELIMINATED';
    eliminatedId = leaders[0] as string;
  } else if (phase.round === 1 && s.config.rules.runoffOnTie) outcome = 'TIE_RUNOFF';
  else outcome = 'TIE_NO_ELIMINATION';

  const revealBallots = s.config.rules.revealVotes;
  s.voteHistory.push({ day: s.dayNumber, round: phase.round, ballots, tally, eliminatedId, outcome });
  tx.emitPublic('VOTING_ENDED', {
    round: phase.round,
    tally,
    outcome,
    leaders: outcome === 'TIE_RUNOFF' || outcome === 'TIE_NO_ELIMINATION' ? leaders : [],
    ballots: revealBallots ? ballots : null,
  });
  tx.log('VOTE_CLOSED', false, {
    round: phase.round,
    tally,
    outcome,
    ballots: revealBallots ? ballots : null,
  });
  if (tx.state.mode === 'HUMAN') tx.emitModerator('VOTING_ENDED', { round: phase.round, ballots, tally, outcome });

  if (outcome === 'TIE_RUNOFF') {
    enterVoting(tx, 2, leaders);
    return;
  }
  enterVoteResult(tx, phase.round, tally, eliminatedId);
}

function enterVoteResult(tx: Tx, round: 1 | 2, tally: Record<string, number>, eliminatedId: string | null): void {
  const s = tx.state;
  if (s.mode === 'AUTO') {
    setPhase(tx, { type: 'VOTE_RESULT', round, confirmed: true, tally, eliminatedId }, s.config.timers.voteResult);
    applyVoteElimination(tx, eliminatedId);
  } else {
    s.pendingOutcome = { kind: 'VOTE', eliminatedId, tally, round };
    setPhase(tx, { type: 'VOTE_RESULT', round, confirmed: false, tally, eliminatedId: null }, null);
    awaitModerator(tx, 'CONFIRM_VOTE');
  }
}

export function applyVoteElimination(tx: Tx, eliminatedId: string | null): void {
  const s = tx.state;
  const phase = s.phase;
  if (phase.type === 'VOTE_RESULT') {
    phase.confirmed = true;
    phase.eliminatedId = eliminatedId;
  }
  s.pendingOutcome = null;
  if (!eliminatedId) {
    tx.emitPublic('PLAYER_ELIMINATED', { playerId: null, role: null, deaths: [] });
    tx.log('PLAYER_ELIMINATED', false, { playerId: null });
    return;
  }
  const died = applyDeaths(tx, [{ playerId: eliminatedId, causes: ['VOTE'] }]);
  const announced = publicDeathList(tx, died);
  const role = announced.find((d) => d.playerId === eliminatedId)?.role ?? null;
  tx.emitPublic('PLAYER_ELIMINATED', { playerId: eliminatedId, role, deaths: announced });
  tx.log('PLAYER_ELIMINATED', false, { playerId: eliminatedId, role, deaths: announced });
}

// ---------------------------------------------------------------------------
// Advance (timeout in AUTO / MOD_NEXT in HUMAN)
// ---------------------------------------------------------------------------

export function advance(tx: Tx): void {
  const s = tx.state;
  const phase = s.phase;
  switch (phase.type) {
    case 'ROLE_REVEAL':
      enterNight(tx);
      return;
    case 'NIGHT':
      finishNightStep(tx);
      return;
    case 'DAWN':
      if (!phase.confirmed) fail('NEEDS_CONFIRMATION', 'Cần xác nhận kết quả đêm trước.');
      continueAfterDeaths(tx, 'DAY_DISCUSSION');
      return;
    case 'HUNTER_SHOT':
      if (!phase.resolved) resolveHunterShot(tx, null);
      continueAfterDeaths(tx, phase.returnTo);
      return;
    case 'DAY_DISCUSSION':
      enterVoting(tx, 1, null);
      return;
    case 'VOTING':
      closeVoting(tx);
      return;
    case 'VOTE_RESULT':
      if (!phase.confirmed) fail('NEEDS_CONFIRMATION', 'Cần xác nhận kết quả bỏ phiếu trước.');
      continueAfterDeaths(tx, 'NIGHT');
      return;
    case 'GAME_OVER':
      fail('GAME_OVER', 'Trận đấu đã kết thúc.');
  }
}

/** Called when every eligible player has finished the current phase. */
export function onAllDone(tx: Tx, reason: string): void {
  if (tx.state.mode === 'AUTO') advance(tx);
  else awaitModerator(tx, reason);
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

export function endGame(tx: Tx, winner: Winner | null, reason: string | null): void {
  const s = tx.state;
  s.status = winner ? 'ENDED' : 'ABORTED';
  s.winner = winner;
  s.winnerIds = winnerIds(s, winner);
  s.endedAt = tx.now;
  s.paused = null;
  s.pendingOutcome = null;
  setPhase(tx, { type: 'GAME_OVER' }, null);
  tx.emitPublic('GAME_ENDED', {
    winner,
    winnerIds: s.winnerIds,
    reason,
    reveal: s.players.map((p) => ({ playerId: p.id, role: p.role, alive: p.alive })),
  });
  tx.log('GAME_ENDED', false, { winner, reason });
}
