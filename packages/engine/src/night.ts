import { type Tx, aliveWolves, fail, findPlayer, isWolf } from './internal';
import { pick } from './rng';
import { NIGHT_STEP_ROLES } from './roles';
import { tallyWolfVotes } from './voting';
import type {
  GameState,
  NightAction,
  NightOutcomeDetails,
  NightState,
  NightStepId,
  Phase,
  PlayerState,
  ProposedDeath,
} from './types';
import { NIGHT_STEPS } from './types';

type NightPhase = Extract<Phase, { type: 'NIGHT' }>;

export function newNightState(number: number, steps: NightStepId[]): NightState {
  return {
    number,
    steps,
    cupidLink: null,
    guardTarget: null,
    wolfVotes: {},
    wolfTarget: null,
    whiteWolfTarget: null,
    seerTarget: null,
    witchHeal: false,
    witchPoisonTarget: null,
  };
}

function deckHas(state: GameState, roles: readonly string[]): boolean {
  return roles.some((r) => (state.config.deck[r as keyof typeof state.config.deck] ?? 0) > 0);
}

/** Steps for a given night, in collection order. Steps for roles absent from the (public) deck are skipped. */
export function planNightSteps(state: GameState, night: number): NightStepId[] {
  return NIGHT_STEPS.filter((step) => {
    if (step === 'CUPID' && night !== 1) return false;
    if (step === 'WHITE_WOLF' && night % 2 !== 0) return false;
    if (step === 'WEREWOLVES') return true;
    return deckHas(state, NIGHT_STEP_ROLES[step]);
  });
}

// ---------------------------------------------------------------------------
// Target rules (single source of truth for server validation AND client prompts)
// ---------------------------------------------------------------------------

export function guardTargets(state: GameState, guardId: string): string[] {
  const { guardCanSelfProtect, guardSameTargetConsecutive } = state.config.rules;
  const last = state.roles.guardLast;
  return state.players
    .filter((p) => p.alive)
    .filter((p) => guardCanSelfProtect || p.id !== guardId)
    .filter(
      (p) =>
        guardSameTargetConsecutive ||
        !(last && last.targetId === p.id && last.night === state.nightNumber - 1),
    )
    .map((p) => p.id);
}

export function wolfTargets(state: GameState): string[] {
  const canTargetWolves = state.config.rules.wolvesCanTargetWolves;
  return state.players.filter((p) => p.alive && (canTargetWolves || !isWolf(p))).map((p) => p.id);
}

export function whiteWolfTargets(state: GameState, whiteWolfId: string): string[] {
  return state.players.filter((p) => p.alive && isWolf(p) && p.id !== whiteWolfId).map((p) => p.id);
}

export function seerTargets(state: GameState, seerId: string): string[] {
  return state.players.filter((p) => p.alive && p.id !== seerId).map((p) => p.id);
}

export function cupidTargets(state: GameState): string[] {
  return state.players.filter((p) => p.alive).map((p) => p.id);
}

export function witchCanHeal(state: GameState, witchId: string): boolean {
  const target = state.night?.wolfTarget ?? null;
  if (state.roles.witch.healUsed || !target) return false;
  if (target === witchId && !state.config.rules.witchCanSelfHeal) return false;
  return true;
}

export function witchPoisonTargets(state: GameState, witchId: string): string[] {
  if (state.roles.witch.poisonUsed) return [];
  return state.players.filter((p) => p.alive && p.id !== witchId).map((p) => p.id);
}

export function hunterTargets(state: GameState, hunterId: string): string[] {
  return state.players.filter((p) => p.alive && p.id !== hunterId).map((p) => p.id);
}

// ---------------------------------------------------------------------------
// Step actors and completion
// ---------------------------------------------------------------------------

/** Living players who have something to do in this step. Empty → "fake" step. */
export function stepActors(state: GameState, step: NightStepId): PlayerState[] {
  const alive = (role: PlayerState['role']) => state.players.filter((p) => p.alive && p.role === role);
  switch (step) {
    case 'CUPID':
      return state.nightNumber === 1 ? alive('cupid') : [];
    case 'GUARD':
      return alive('guardian');
    case 'WEREWOLVES':
      return aliveWolves(state);
    case 'WHITE_WOLF':
      return alive('white_wolf').filter((ww) => whiteWolfTargets(state, ww.id).length > 0);
    case 'SEER':
      return alive('seer');
    case 'WITCH':
      return alive('witch').filter(
        (w) => witchCanHeal(state, w.id) || witchPoisonTargets(state, w.id).length > 0,
      );
  }
}

/** Actors snapshotted when the current step started (still alive). */
export function currentStepActors(state: GameState): PlayerState[] {
  const phase = state.phase;
  if (phase.type !== 'NIGHT') return [];
  return state.players.filter((p) => p.alive && phase.actors.includes(p.id));
}

export function isStepComplete(state: GameState): boolean {
  const phase = state.phase;
  if (phase.type !== 'NIGHT' || phase.fake) return false;
  const actors = currentStepActors(state);
  if (actors.length === 0) return false;
  if (phase.step === 'WEREWOLVES') {
    const votes = state.night?.wolfVotes ?? {};
    const choices = actors.map((w) => (w.id in votes ? votes[w.id] : undefined));
    if (choices.some((c) => c === undefined)) return false;
    return new Set(choices).size === 1;
  }
  return actors.every((a) => phase.acted.includes(a.id));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const ACTION_STEP: Record<NightAction['kind'], NightStepId> = {
  CUPID_LINK: 'CUPID',
  GUARD_PROTECT: 'GUARD',
  WOLF_VOTE: 'WEREWOLVES',
  WHITE_WOLF_KILL: 'WHITE_WOLF',
  SEER_CHECK: 'SEER',
  WITCH_ACT: 'WITCH',
};

function requireTarget(targets: string[], id: string | null | undefined): void {
  if (!id || !targets.includes(id)) fail('INVALID_TARGET', 'Mục tiêu không hợp lệ.');
}

export function applyNightAction(tx: Tx, actorId: string, action: NightAction): void {
  const state = tx.state;
  const phase = state.phase as NightPhase;
  const night = state.night as NightState;
  const actor = tx.player(actorId);
  if (!actor.alive) fail('PLAYER_DEAD', 'Người chết không thể sử dụng kỹ năng.');
  if (ACTION_STEP[action.kind] !== phase.step) fail('WRONG_STEP', 'Chưa đến lượt hành động này.');
  if (phase.locked) fail('PHASE_LOCKED', 'Lượt hành động đã bị khóa.');
  if (!currentStepActors(state).some((a) => a.id === actorId)) {
    fail('NOT_ALLOWED', 'Bạn không thể hành động ở lượt này.');
  }
  if (action.kind !== 'WOLF_VOTE' && phase.acted.includes(actorId)) {
    fail('ALREADY_ACTED', 'Bạn đã hành động trong đêm nay.');
  }

  const name = (id: string) => findPlayer(state, id)?.name ?? id;

  switch (action.kind) {
    case 'CUPID_LINK': {
      const [a, b] = action.targetIds;
      const targets = cupidTargets(state);
      requireTarget(targets, a);
      requireTarget(targets, b);
      if (a === b) fail('INVALID_TARGET', 'Phải chọn hai người khác nhau.');
      const pa = tx.player(a);
      const pb = tx.player(b);
      pa.loverId = b;
      pb.loverId = a;
      night.cupidLink = [a, b];
      state.roles.lovers = [a, b];
      tx.emitTo([a], 'LOVERS_LINKED', { partnerId: b, partnerRole: pb.role });
      tx.emitTo([b], 'LOVERS_LINKED', { partnerId: a, partnerRole: pa.role });
      tx.log('LOVERS_LINKED', true, { cupidId: actorId, a, b, names: [name(a), name(b)] });
      break;
    }
    case 'GUARD_PROTECT': {
      if (action.targetId !== null) {
        requireTarget(guardTargets(state, actorId), action.targetId);
        state.roles.guardLast = { targetId: action.targetId, night: state.nightNumber };
        tx.log('GUARD_PROTECTED', true, { guardId: actorId, targetId: action.targetId });
      }
      night.guardTarget = action.targetId;
      break;
    }
    case 'WOLF_VOTE': {
      if (action.targetId !== null) requireTarget(wolfTargets(state), action.targetId);
      night.wolfVotes[actorId] = action.targetId;
      const wolves = aliveWolves(state).map((w) => w.id);
      tx.emitTo(wolves, 'WOLF_VOTES_UPDATED', { votes: { ...night.wolfVotes } });
      break;
    }
    case 'WHITE_WOLF_KILL': {
      if (action.targetId !== null) {
        requireTarget(whiteWolfTargets(state, actorId), action.targetId);
        tx.log('WHITE_WOLF_TARGETED', true, { whiteWolfId: actorId, targetId: action.targetId });
      }
      night.whiteWolfTarget = action.targetId;
      break;
    }
    case 'SEER_CHECK': {
      requireTarget(seerTargets(state, actorId), action.targetId);
      const target = tx.player(action.targetId);
      const isWolfResult = isWolf(target);
      night.seerTarget = target.id;
      state.roles.seerResults.push({ night: state.nightNumber, targetId: target.id, isWolf: isWolfResult });
      tx.emitTo([actorId], 'SEER_RESULT', { targetId: target.id, isWolf: isWolfResult });
      tx.log('SEER_CHECKED', true, { seerId: actorId, targetId: target.id, isWolf: isWolfResult });
      break;
    }
    case 'WITCH_ACT': {
      const { heal, poisonTargetId } = action;
      if (heal && poisonTargetId && !state.config.rules.witchBothPotionsSameNight) {
        fail('NOT_ALLOWED', 'Không được dùng cả hai bình trong cùng một đêm.');
      }
      if (heal) {
        if (state.roles.witch.healUsed) fail('NO_POTION', 'Bình cứu đã được sử dụng.');
        if (!witchCanHeal(state, actorId)) fail('INVALID_TARGET', 'Không thể dùng bình cứu đêm nay.');
      }
      if (poisonTargetId) {
        if (state.roles.witch.poisonUsed) fail('NO_POTION', 'Bình độc đã được sử dụng.');
        requireTarget(witchPoisonTargets(state, actorId), poisonTargetId);
      }
      if (heal) {
        night.witchHeal = true;
        state.roles.witch.healUsed = true;
        tx.log('WITCH_HEALED', true, { witchId: actorId, targetId: night.wolfTarget });
      }
      if (poisonTargetId) {
        night.witchPoisonTarget = poisonTargetId;
        state.roles.witch.poisonUsed = true;
        tx.log('WITCH_POISONED', true, { witchId: actorId, targetId: poisonTargetId });
      }
      break;
    }
  }

  if (!phase.acted.includes(actorId)) phase.acted.push(actorId);
  tx.emitTo([actorId], 'ROLE_ACTION_SUBMITTED', { step: phase.step, kind: action.kind });
  tx.emitModerator('ROLE_ACTION_SUBMITTED', { step: phase.step, actorId, action });
}

/** Decide the pack's target at the end of the WEREWOLVES step. */
export function finalizeWolfTarget(tx: Tx): void {
  const state = tx.state;
  const night = state.night as NightState;
  const aliveWolfIds = new Set(aliveWolves(state).map((w) => w.id));
  const votes: Record<string, string | null> = {};
  for (const [wolfId, target] of Object.entries(night.wolfVotes)) {
    if (!aliveWolfIds.has(wolfId)) continue;
    if (target !== null && !wolfTargets(state).includes(target)) continue;
    votes[wolfId] = target;
  }
  const { leaders } = tallyWolfVotes(votes);
  let target: string | null = null;
  let tieBroken = false;
  if (leaders.length === 1) {
    target = leaders[0] ?? null;
  } else if (leaders.length > 1) {
    tieBroken = true;
    target = state.config.rules.wolfTiePolicy === 'random' ? pick(leaders, tx.rng) : null;
  }
  night.wolfTarget = target;
  tx.log('WOLVES_TARGETED', true, { targetId: target, votes, tieBroken });
}

/** Compute (but do not apply) the night's deaths per RULES.md §3.2. */
export function resolveNight(state: GameState): { deaths: ProposedDeath[]; details: NightOutcomeDetails } {
  const night = state.night as NightState;
  const causes = new Map<string, Set<ProposedDeath['causes'][number]>>();
  const add = (id: string, cause: ProposedDeath['causes'][number]) => {
    const p = findPlayer(state, id);
    if (!p || !p.alive) return;
    if (!causes.has(id)) causes.set(id, new Set());
    causes.get(id)?.add(cause);
  };

  let elderShielded = false;
  const wolfTarget = night.wolfTarget;
  if (wolfTarget) {
    const blocked = night.guardTarget === wolfTarget || night.witchHeal;
    if (!blocked) {
      const victim = findPlayer(state, wolfTarget);
      if (victim?.role === 'elder' && state.roles.elderLivesLost === 0) elderShielded = true;
      else add(wolfTarget, 'WOLVES');
    }
  }
  if (night.whiteWolfTarget) add(night.whiteWolfTarget, 'WHITE_WOLF');
  if (night.witchPoisonTarget) add(night.witchPoisonTarget, 'POISON');

  const deaths: ProposedDeath[] = [...causes.entries()].map(([playerId, set]) => ({
    playerId,
    causes: [...set],
  }));
  return {
    deaths,
    details: {
      wolfTarget,
      guardTarget: night.guardTarget,
      healed: night.witchHeal,
      poisonTarget: night.witchPoisonTarget,
      whiteWolfTarget: night.whiteWolfTarget,
      elderShielded,
    },
  };
}
