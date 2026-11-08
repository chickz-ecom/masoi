import { expect } from 'vitest';
import {
  applyCommand,
  createGame,
  defaultConfig,
  projectView,
  seededRng,
  type Actor,
  type Command,
  type Deck,
  type EngineEvent,
  type GameState,
  type Mode,
  type NightAction,
  type RoleId,
  type RuleConfig,
  type Viewer,
} from '../src';

export const SYSTEM: Actor = { kind: 'system' };
export const MOD: Actor = { kind: 'moderator' };

export interface SetupOptions {
  mode?: Mode;
  rules?: Partial<RuleConfig>;
  seed?: number;
}

/**
 * Test harness: creates a game with a FIXED role per seat (p1 gets roles[0], …)
 * and exposes helpers to drive it.
 */
export class Harness {
  state: GameState;
  now = 1_000_000;
  events: EngineEvent[] = [];
  readonly rng;

  constructor(roles: RoleId[], opts: SetupOptions = {}) {
    this.rng = seededRng(opts.seed ?? 42);
    const deck: Deck = {};
    for (const r of roles) deck[r] = (deck[r] ?? 0) + 1;
    const config = defaultConfig(deck);
    config.rules = { ...config.rules, enableAdvancedRoles: true, ...opts.rules };
    const created = createGame({
      gameId: 'g1',
      mode: opts.mode ?? 'AUTO',
      config,
      players: roles.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, seat: i + 1 })),
      now: this.now,
      rng: this.rng,
    });
    // Force deterministic role assignment for readable tests.
    created.state.players.forEach((p, i) => {
      p.role = roles[i] as RoleId;
    });
    this.state = created.state;
    this.events = created.events;
  }

  player(id: string) {
    const p = this.state.players.find((pl) => pl.id === id);
    if (!p) throw new Error(`no player ${id}`);
    return p;
  }

  get phase() {
    return this.state.phase;
  }

  /** Apply a command; throws on engine error. */
  run(actor: Actor, command: Command) {
    const res = applyCommand(this.state, actor, command, { now: this.now, rng: this.rng });
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    this.state = res.state;
    this.events = res.events;
    return res;
  }

  /** Apply a command expecting an engine error code. */
  expectError(actor: Actor, command: Command, code: string) {
    const res = applyCommand(this.state, actor, command, { now: this.now, rng: this.rng });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(code);
  }

  as(id: string): Actor {
    return { kind: 'player', playerId: id };
  }

  /** Jump the clock to the current phase deadline and fire the timer. */
  timeout() {
    const endsAt = this.state.phase.endsAt;
    if (endsAt === null) throw new Error('phase has no deadline');
    this.now = endsAt;
    return this.run(SYSTEM, { type: 'TICK', phaseId: this.state.phase.id });
  }

  ackAll() {
    for (const p of this.state.players) {
      if (this.state.phase.type !== 'ROLE_REVEAL') break;
      this.run(this.as(p.id), { type: 'ACK_ROLE', phaseId: this.state.phase.id });
    }
  }

  night(actorId: string, action: NightAction) {
    return this.run(this.as(actorId), { type: 'NIGHT_ACTION', phaseId: this.state.phase.id, action });
  }

  /** Time out night steps until the given step is active. */
  untilStep(step: string) {
    let guard = 0;
    while (!(this.state.phase.type === 'NIGHT' && this.state.phase.step === step)) {
      if (++guard > 20) throw new Error(`never reached step ${step}`);
      this.timeout();
    }
  }

  /** Advance (via timeouts) until the given phase type. */
  untilPhase(type: GameState['phase']['type']) {
    let guard = 0;
    while (this.state.phase.type !== type) {
      if (++guard > 40) throw new Error(`never reached phase ${type}, at ${this.state.phase.type}`);
      this.step();
    }
  }

  /** Advance through the day into the next night. */
  nextNight() {
    const target = this.state.nightNumber + 1;
    let guard = 0;
    while (!(this.state.phase.type === 'NIGHT' && this.state.nightNumber === target)) {
      if (++guard > 40) throw new Error('never reached next night');
      this.step();
    }
  }

  /** One step forward: MOD_CONFIRM/MOD_NEXT in HUMAN mode, a timeout in AUTO mode. */
  step() {
    if (this.state.mode === 'HUMAN') {
      const ph = this.state.phase;
      if ((ph.type === 'DAWN' || ph.type === 'VOTE_RESULT') && !ph.confirmed) {
        this.run(MOD, { type: 'MOD_CONFIRM' });
      } else this.run(MOD, { type: 'MOD_NEXT' });
    } else this.timeout();
  }

  vote(voter: string, target: string | null, lock = true) {
    return this.run(this.as(voter), { type: 'VOTE', phaseId: this.state.phase.id, targetId: target, lock });
  }

  view(viewer: Viewer) {
    return projectView(this.state, viewer);
  }

  eventsOf(type: EngineEvent['type']) {
    return this.events.filter((e) => e.type === type);
  }
}
