import { isWolfRole } from './roles';
import type {
  EngineError,
  EngineErrorCode,
  EngineEvent,
  EngineEventType,
  GameState,
  PlayerState,
  Rng,
  TimelineKind,
} from './types';

export class EngineFailure extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
  }
  toError(): EngineError {
    return { code: this.code, message: this.message };
  }
}

export function fail(code: EngineErrorCode, message: string): never {
  throw new EngineFailure(code, message);
}

/** Mutable working context for a single command application. Operates on a cloned state. */
export class Tx {
  readonly events: EngineEvent[] = [];
  changed = false;

  constructor(
    public readonly state: GameState,
    public readonly now: number,
    public readonly rng: Rng,
  ) {}

  touch(): void {
    this.changed = true;
  }

  emit(type: EngineEventType, visibility: EngineEvent['visibility'], payload: Record<string, unknown> = {}): void {
    this.changed = true;
    this.events.push({ type, visibility, payload });
  }
  emitPublic(type: EngineEventType, payload: Record<string, unknown> = {}): void {
    this.emit(type, { scope: 'public' }, payload);
  }
  emitTo(playerIds: string[], type: EngineEventType, payload: Record<string, unknown> = {}): void {
    if (playerIds.length === 0) return;
    this.emit(type, { scope: 'players', playerIds: [...new Set(playerIds)] }, payload);
  }
  emitModerator(type: EngineEventType, payload: Record<string, unknown> = {}): void {
    if (this.state.mode !== 'HUMAN') return;
    this.emit(type, { scope: 'moderator' }, payload);
  }

  log(kind: TimelineKind, secret: boolean, data: Record<string, unknown> = {}): void {
    this.changed = true;
    this.state.timeline.push({
      at: this.now,
      phaseId: this.state.phase.id,
      night: this.state.nightNumber,
      day: this.state.dayNumber,
      kind,
      secret,
      data,
    });
  }

  player(id: string): PlayerState {
    const p = this.state.players.find((pl) => pl.id === id);
    if (!p) fail('INVALID_TARGET', 'Người chơi không tồn tại.');
    return p;
  }
}

export function findPlayer(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.alive);
}

export function aliveIds(state: GameState): string[] {
  return alivePlayers(state).map((p) => p.id);
}

export function isWolf(p: PlayerState): boolean {
  return isWolfRole(p.role);
}

export function aliveWolves(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.alive && isWolf(p));
}

export function playersWithRole(state: GameState, role: PlayerState['role']): PlayerState[] {
  return state.players.filter((p) => p.role === role);
}

export function aliveWithRole(state: GameState, role: PlayerState['role']): PlayerState | undefined {
  return state.players.find((p) => p.role === role && p.alive);
}

export function bySeat(a: PlayerState, b: PlayerState): number {
  return a.seat - b.seat;
}

export function sortIdsBySeat(state: GameState, ids: string[]): string[] {
  const seat = new Map(state.players.map((p) => [p.id, p.seat] as const));
  return [...ids].sort((a, b) => (seat.get(a) ?? 0) - (seat.get(b) ?? 0));
}
