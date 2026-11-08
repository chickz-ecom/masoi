import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createGame,
  defaultConfig,
  projectView,
  seededRng,
  suggestDeck,
  type Actor,
  type Command,
  type GameState,
  type Mode,
  type Rng,
} from '../src';

/**
 * Property-style test: play many full games with random (but legal-looking, and some illegal) inputs
 * and check invariants. This catches stuck states and invariant violations.
 */
function randomGame(seed: number, players: number, mode: Mode) {
  const rng: Rng = seededRng(seed);
  const config = defaultConfig(suggestDeck(players));
  let now = 0;
  let { state } = createGame({
    gameId: `sim-${seed}`,
    mode,
    config,
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i + 1 })),
    now,
    rng,
  });
  const pick = <T,>(xs: T[]): T | undefined => (xs.length ? xs[rng.int(xs.length)] : undefined);
  let lastPhaseId = state.phase.id;
  let steps = 0;

  const apply = (actor: Actor, cmd: Command) => {
    const res = applyCommand(state, actor, cmd, { now, rng });
    if (res.ok) {
      // invariants
      expect(res.state.phase.id).toBeGreaterThanOrEqual(lastPhaseId);
      lastPhaseId = res.state.phase.id;
      for (const p of res.state.players) {
        if (!p.alive) expect(p.death).not.toBeNull();
      }
      expect(res.state.roles.witch.healUsed === true || res.state.roles.witch.healUsed === false).toBe(true);
      state = res.state;
    }
    return res;
  };

  while (state.status === 'RUNNING' && steps < 2000) {
    steps++;
    // Every living/dead player tries whatever their view prompts.
    for (const p of state.players) {
      const view = projectView(state, { kind: 'player', playerId: p.id });
      const prompt = view.me?.prompt;
      if (!prompt || rng.int(4) === 0) continue;
      const phaseId = state.phase.id;
      const actor: Actor = { kind: 'player', playerId: p.id };
      switch (prompt.kind) {
        case 'ACK_ROLE':
          apply(actor, { type: 'ACK_ROLE', phaseId });
          break;
        case 'GUARD_PROTECT':
          apply(actor, { type: 'NIGHT_ACTION', phaseId, action: { kind: 'GUARD_PROTECT', targetId: pick(prompt.targets) ?? null } });
          break;
        case 'WOLF_VOTE':
          apply(actor, { type: 'NIGHT_ACTION', phaseId, action: { kind: 'WOLF_VOTE', targetId: pick(prompt.targets) ?? null } });
          break;
        case 'SEER_CHECK': {
          const t = pick(prompt.targets);
          if (t) apply(actor, { type: 'NIGHT_ACTION', phaseId, action: { kind: 'SEER_CHECK', targetId: t } });
          break;
        }
        case 'WITCH_ACT': {
          const heal = prompt.canHeal && rng.int(2) === 0;
          const poison = !heal && rng.int(3) === 0 ? (pick(prompt.poisonTargets) ?? null) : null;
          apply(actor, { type: 'NIGHT_ACTION', phaseId, action: { kind: 'WITCH_ACT', heal, poisonTargetId: poison } });
          break;
        }
        case 'HUNTER_SHOOT':
          apply(actor, { type: 'HUNTER_SHOOT', phaseId, targetId: pick(prompt.targets) ?? null });
          break;
        case 'SKIP_DISCUSSION':
          apply(actor, { type: 'SKIP_DISCUSSION', phaseId });
          break;
        case 'VOTE':
          apply(actor, { type: 'VOTE', phaseId, targetId: rng.int(5) === 0 ? null : (pick(prompt.targets) ?? null), lock: true });
          break;
        default:
          break;
      }
      // Illegal: stale phase id must always be rejected.
      if (phaseId > 1) {
        const stale = applyCommand(state, actor, { type: 'SKIP_DISCUSSION', phaseId: phaseId - 1 }, { now, rng });
        if (state.status === 'RUNNING' && !state.paused) expect(stale.ok).toBe(false);
      }
    }
    if (state.status !== 'RUNNING') break;
    if (mode === 'HUMAN') {
      if (state.phase.type === 'DAWN' || state.phase.type === 'VOTE_RESULT') {
        if (!(state.phase as { confirmed: boolean }).confirmed) apply({ kind: 'moderator' }, { type: 'MOD_CONFIRM' });
      }
      apply({ kind: 'moderator' }, { type: 'MOD_NEXT' });
    } else if (state.phase.endsAt !== null) {
      now = state.phase.endsAt;
      apply({ kind: 'system' }, { type: 'TICK', phaseId: state.phase.id });
    }
  }
  return { state: state as GameState, steps };
}

describe('random full-game simulation', () => {
  it.each([
    [4, 'AUTO'],
    [6, 'AUTO'],
    [8, 'AUTO'],
    [12, 'AUTO'],
    [8, 'HUMAN'],
    [16, 'HUMAN'],
  ] as const)('%i players, %s mode: every game terminates with a valid winner', (players, mode) => {
    for (let seed = 1; seed <= 25; seed++) {
      const { state } = randomGame(seed * 7 + players, players, mode);
      expect(state.status).toBe('ENDED');
      expect(['VILLAGE', 'WEREWOLF', 'DRAW']).toContain(state.winner);
      expect(state.phase.type).toBe('GAME_OVER');
    }
  });
});
