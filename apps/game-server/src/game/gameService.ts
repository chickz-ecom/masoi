import {
  RULESET_ID,
  applyCommand,
  createGame,
  nextDeadline,
  projectView,
  type Actor,
  type Command,
  type EngineEvent,
  type GameConfig,
  type GameState,
  type Viewer,
} from '@masoi/engine';
import type { GameSync, ServerError, ServerEvent } from '@masoi/shared';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import { cryptoRng } from '../security/tokens';
import type { KeyedQueue, RedisLock } from './lock';
import type { TimerScheduler } from './scheduler';

export interface DeliveredEvent {
  envelope: ServerEvent;
  event: EngineEvent;
}

export interface GameDelivery {
  roomId: string;
  gameId: string;
  state: GameState;
  version: number;
  events: DeliveredEvent[];
}

/** Implemented by the realtime layer. */
export interface GameBroadcaster {
  deliverGame(delivery: GameDelivery): Promise<void>;
}

export interface DispatchMeta {
  /** Member who issued the command (players and moderators). */
  memberId?: string;
  /** Idempotency key from the client. */
  clientActionId?: string;
  reason?: string;
}

export type DispatchOutcome = { ok: true; duplicate: boolean } | { ok: false; error: ServerError };

class VersionConflict extends Error {}

const json = (v: unknown) => v as Prisma.InputJsonValue;

export interface StartGameInput {
  roomId: string;
  mode: 'AUTO' | 'HUMAN';
  config: GameConfig;
  players: { id: string; name: string; seat: number }[];
}

export class GameService {
  private broadcaster: GameBroadcaster | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly lock: RedisLock,
    private readonly queue: KeyedQueue,
    private readonly scheduler: TimerScheduler,
    private readonly logger: Logger,
  ) {}

  setBroadcaster(b: GameBroadcaster): void {
    this.broadcaster = b;
  }

  // -------------------------------------------------------------------------
  // Creation
  // -------------------------------------------------------------------------

  /**
   * Create and persist a new game for a room. Caller must hold the room lock and have validated
   * the lobby (host, ready, deck). Role assignment uses a CSPRNG.
   */
  async startGame(input: StartGameInput): Promise<string> {
    const now = Date.now();
    const gameId = `g_${cryptoRng.int(2 ** 30).toString(36)}${now.toString(36)}`;
    let created: ReturnType<typeof createGame>;
    try {
      created = createGame({ gameId, mode: input.mode, config: input.config, players: input.players, now, rng: cryptoRng });
    } catch (err) {
      throw new AppError('INVALID_DECK', (err as Error).message);
    }
    const { state, events } = created;
    const delivered = await this.prisma.$transaction(async (tx) => {
      const last = await tx.game.findFirst({ where: { roomId: input.roomId }, orderBy: { number: 'desc' }, select: { number: true } });
      await tx.game.create({
        data: {
          id: gameId,
          roomId: input.roomId,
          number: (last?.number ?? 0) + 1,
          mode: input.mode,
          ruleset: RULESET_ID,
          version: 1,
          state: json(state),
          phaseType: state.phase.type,
          phaseId: state.phase.id,
          nextDeadline: toDate(nextDeadline(state)),
          eventSeq: events.length,
          startedAt: new Date(now),
        },
      });
      for (const p of state.players) {
        const participant = await tx.gameParticipant.create({
          data: { gameId, playerId: p.id, seat: p.seat },
        });
        await tx.gameRoleAssignment.create({ data: { gameId, participantId: participant.id, roleId: p.role } });
      }
      await tx.gamePhase.create({
        data: {
          gameId,
          phaseId: state.phase.id,
          type: state.phase.type,
          night: 0,
          day: 0,
          startedAt: new Date(now),
          endsAt: toDate(state.phase.endsAt),
        },
      });
      const out = await this.insertEvents(tx, gameId, 0, events, now);
      await tx.room.update({ where: { id: input.roomId }, data: { status: 'IN_GAME', currentGameId: gameId } });
      return out;
    });
    await this.scheduler.schedule(gameId, nextDeadline(state));
    await this.broadcaster?.deliverGame({ roomId: input.roomId, gameId, state, version: 1, events: delivered });
    this.logger.info({ gameId, roomId: input.roomId, players: state.players.length, mode: input.mode }, 'game started');
    return gameId;
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /**
   * Apply a command authoritatively: serialized per game (in-process queue + Redis lock),
   * idempotent by clientActionId, persisted with an optimistic version check, then fanned out.
   */
  dispatch(
    gameId: string,
    actor: Actor,
    command: Command | ((state: GameState) => Command | null),
    meta: DispatchMeta = {},
  ): Promise<DispatchOutcome> {
    return this.queue.run(gameId, () => this.lock.withLock(`game:${gameId}`, () => this.dispatchLocked(gameId, actor, command, meta)));
  }

  private async dispatchLocked(
    gameId: string,
    actor: Actor,
    commandOrFn: Command | ((state: GameState) => Command | null),
    meta: DispatchMeta,
  ): Promise<DispatchOutcome> {
    const { memberId, clientActionId } = meta;
    if (memberId && clientActionId) {
      const prior = await this.prisma.gameAction.findUnique({
        where: { gameId_actorPlayerId_clientActionId: { gameId, actorPlayerId: memberId, clientActionId } },
        select: { result: true, errorCode: true },
      });
      if (prior) {
        return prior.result === 'ACCEPTED'
          ? { ok: true, duplicate: true }
          : { ok: false, error: { code: (prior.errorCode ?? 'CONFLICT') as ServerError['code'], message: 'Hành động đã được xử lý trước đó.' } };
      }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, roomId: true, state: true, version: true, eventSeq: true, status: true },
      });
      if (!game) throw new AppError('NO_ACTIVE_GAME');
      const before = game.state as unknown as GameState;
      const command = typeof commandOrFn === 'function' ? commandOrFn(before) : commandOrFn;
      if (!command) return { ok: true, duplicate: false };
      const now = Date.now();
      const res = applyCommand(before, actor, command, { now, rng: cryptoRng });

      if (!res.ok) {
        if (memberId && clientActionId) {
          await this.prisma.gameAction
            .createMany({
              data: [
                {
                  gameId,
                  phaseId: before.phase.id,
                  actorPlayerId: memberId,
                  clientActionId,
                  kind: command.type,
                  payload: json(command),
                  result: 'REJECTED',
                  errorCode: res.error.code,
                },
              ],
              skipDuplicates: true,
            })
            .catch(() => undefined);
        }
        if (command.type === 'TICK') await this.scheduler.schedule(gameId, nextDeadline(before));
        return { ok: false, error: res.error };
      }

      if (!res.changed) {
        // e.g. early/stale timer: keep the timer alive.
        if (command.type === 'TICK') await this.scheduler.schedule(gameId, nextDeadline(before));
        return { ok: true, duplicate: false };
      }

      const after = res.state;
      try {
        const delivered = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.game.updateMany({
            where: { id: gameId, version: game.version },
            data: {
              state: json(after),
              version: { increment: 1 },
              status: after.status,
              phaseType: after.phase.type,
              phaseId: after.phase.id,
              nextDeadline: toDate(nextDeadline(after)),
              eventSeq: game.eventSeq + res.events.length,
              endedAt: after.endedAt ? new Date(after.endedAt) : null,
            },
          });
          if (updated.count !== 1) throw new VersionConflict();
          const out = await this.insertEvents(tx, gameId, game.eventSeq, res.events, now);
          await this.persistSideTables(tx, gameId, before, after, actor, command, meta, now);
          return out;
        });
        await this.scheduler.schedule(gameId, nextDeadline(after));
        await this.broadcaster?.deliverGame({
          roomId: game.roomId,
          gameId,
          state: after,
          version: game.version + 1,
          events: delivered,
        });
        if (after.status !== 'RUNNING' && before.status === 'RUNNING') {
          this.logger.info({ gameId, winner: after.winner, status: after.status }, 'game finished');
        }
        return { ok: true, duplicate: false };
      } catch (err) {
        if (err instanceof VersionConflict) {
          this.logger.warn({ gameId, attempt }, 'version conflict, retrying');
          continue;
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && clientActionId) {
          return { ok: true, duplicate: true };
        }
        throw err;
      }
    }
    throw new AppError('CONFLICT');
  }

  /** Called by the timer scheduler. */
  async handleTimer(gameId: string): Promise<void> {
    await this.dispatch(gameId, { kind: 'system' }, (s) => (s.status === 'RUNNING' ? { type: 'TICK', phaseId: s.phase.id } : null));
  }

  /** Re-register timers of all running games (after a restart or Redis data loss). */
  async reconcileTimers(): Promise<number> {
    const games = await this.prisma.game.findMany({
      where: { status: 'RUNNING', nextDeadline: { not: null } },
      select: { id: true, nextDeadline: true },
    });
    for (const g of games) await this.scheduler.schedule(g.id, g.nextDeadline?.getTime() ?? null);
    return games.length;
  }

  async loadState(gameId: string): Promise<{ state: GameState; version: number; roomId: string } | null> {
    const g = await this.prisma.game.findUnique({ where: { id: gameId }, select: { state: true, version: true, roomId: true } });
    return g ? { state: g.state as unknown as GameState, version: g.version, roomId: g.roomId } : null;
  }

  async getSync(gameId: string, viewer: Viewer): Promise<GameSync | null> {
    const loaded = await this.loadState(gameId);
    if (!loaded) return null;
    return { view: projectView(loaded.state, viewer), version: loaded.version, serverNow: Date.now() };
  }

  // -------------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------------

  private async insertEvents(
    tx: Prisma.TransactionClient,
    gameId: string,
    seqStart: number,
    events: EngineEvent[],
    now: number,
  ): Promise<DeliveredEvent[]> {
    if (events.length === 0) return [];
    const rows = events.map((e, i) => ({
      gameId,
      seq: seqStart + i + 1,
      type: e.type,
      visibility:
        e.visibility.scope === 'public' ? ('PUBLIC' as const) : e.visibility.scope === 'players' ? ('PRIVATE' as const) : ('MODERATOR' as const),
      recipients: e.visibility.scope === 'players' ? e.visibility.playerIds : [],
      payload: json(e.payload),
      createdAt: new Date(now),
    }));
    await tx.gameEvent.createMany({ data: rows });
    return events.map((event, i) => ({
      event,
      envelope: { id: `${gameId}:${seqStart + i + 1}`, type: event.type, at: now, payload: event.payload },
    }));
  }

  private async persistSideTables(
    tx: Prisma.TransactionClient,
    gameId: string,
    before: GameState,
    after: GameState,
    actor: Actor,
    command: Command,
    meta: DispatchMeta,
    now: number,
  ): Promise<void> {
    const at = new Date(now);
    if (meta.memberId && meta.clientActionId) {
      await tx.gameAction.create({
        data: {
          gameId,
          phaseId: before.phase.id,
          actorPlayerId: meta.memberId,
          clientActionId: meta.clientActionId,
          kind: command.type === 'NIGHT_ACTION' ? command.action.kind : command.type,
          payload: json(command),
          result: 'ACCEPTED',
        },
      });
    }
    if (command.type === 'VOTE' && actor.kind === 'player' && before.phase.type === 'VOTING') {
      await tx.vote.upsert({
        where: { gameId_phaseId_voterPlayerId: { gameId, phaseId: before.phase.id, voterPlayerId: actor.playerId } },
        create: {
          gameId,
          phaseId: before.phase.id,
          day: before.dayNumber,
          round: before.phase.round,
          voterPlayerId: actor.playerId,
          targetPlayerId: command.targetId,
          locked: command.lock || !before.config.rules.allowVoteChange,
        },
        update: { targetPlayerId: command.targetId, locked: command.lock || !before.config.rules.allowVoteChange },
      });
    }
    if (after.phaseSeq !== before.phaseSeq) {
      await tx.gamePhase.updateMany({ where: { gameId, endedAt: null }, data: { endedAt: at } });
      // Record the final phase reached by this command (intermediate phases are in the event log).
      await tx.gamePhase.create({
        data: {
          gameId,
          phaseId: after.phase.id,
          type: after.phase.type,
          step: after.phase.type === 'NIGHT' ? after.phase.step : null,
          night: after.nightNumber,
          day: after.dayNumber,
          startedAt: at,
          endsAt: toDate(after.phase.endsAt),
          endedAt: after.phase.type === 'GAME_OVER' ? at : null,
        },
      });
    }
    for (const p of after.players) {
      const prev = before.players.find((b) => b.id === p.id);
      if (prev?.alive && !p.alive) {
        await tx.gameParticipant.update({
          where: { gameId_playerId: { gameId, playerId: p.id } },
          data: { alive: false, diedAtPhase: p.death?.phaseId ?? null },
        });
      }
    }
    if (actor.kind === 'moderator' && meta.memberId) {
      await tx.moderatorAuditLog.create({
        data: {
          gameId,
          moderatorPlayerId: meta.memberId,
          command: command.type,
          payload: json(command),
          before: json({ phase: before.phase, pendingOutcome: before.pendingOutcome, paused: before.paused }),
          after: json({ phase: after.phase, paused: after.paused }),
          reason: meta.reason ?? null,
        },
      });
    }
    if (after.status !== 'RUNNING' && before.status === 'RUNNING') {
      await tx.gameResult.create({
        data: {
          gameId,
          winner: after.winner,
          winnerIds: after.winnerIds,
          nights: after.nightNumber,
          days: after.dayNumber,
          endedAt: at,
          summary: json({
            players: after.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, role: p.role, alive: p.alive, death: p.death })),
            voteHistory: after.voteHistory,
            timeline: after.timeline,
          }),
        },
      });
    }
  }
}

function toDate(ms: number | null): Date | null {
  return ms === null ? null : new Date(ms);
}
