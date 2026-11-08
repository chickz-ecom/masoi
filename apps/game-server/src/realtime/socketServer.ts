import type { Server as HttpServer } from 'node:http';
import { projectView, type Actor, type Command, type GameState, type Viewer } from '@masoi/engine';
import {
  AckRolePayloadSchema,
  EmptyPayloadSchema,
  HunterShootPayloadSchema,
  ModeratorCommandPayloadSchema,
  NightActionPayloadSchema,
  PingPayloadSchema,
  ReadyPayloadSchema,
  SkipDiscussionPayloadSchema,
  TargetMemberPayloadSchema,
  UpdateSettingsPayloadSchema,
  VotePayloadSchema,
  type Ack,
  type ClientToServerEvents,
  type GameSync,
  type RoomEventType,
  type ServerToClientEvents,
  narrate,
} from '@masoi/shared';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import type { ZodType } from 'zod';
import type { DispatchMeta, GameBroadcaster, GameDelivery, GameService } from '../game/gameService';
import { AppError, toServerError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import type { MemberContext, RoomBroadcaster, RoomService } from '../rooms/roomService';
import type { TtsService } from '../narration/ttsService';
import type { RateLimiter } from '../security/rateLimit';
import { newId } from '../security/tokens';

interface SocketData {
  ctx: MemberContext;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Real client IP: first X-Forwarded-For hop when the proxy is trusted, else the TCP peer. */
export function clientIp(handshake: { address: string; headers: Record<string, string | string[] | undefined> }, trustProxy: boolean): string {
  if (trustProxy) {
    const raw = handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return handshake.address;
}

const NARRATED_EVENTS = new Set(['PHASE_CHANGED', 'NIGHT_RESULT', 'HUNTER_SHOT', 'PLAYER_ELIMINATED', 'GAME_ENDED']);

const R = {
  room: (roomId: string) => `r:${roomId}`,
  member: (memberId: string) => `m:${memberId}`,
  mods: (roomId: string) => `mods:${roomId}`,
  spectators: (roomId: string) => `spec:${roomId}`,
};

export interface RealtimeDeps {
  rooms: RoomService;
  games: GameService;
  limiter: RateLimiter;
  logger: Logger;
  corsOrigins: string[];
  pubClient: Redis;
  subClient: Redis;
  /** Shared Redis: every pub/sub channel of the Socket.IO adapter starts with this prefix (ww:sio#…). */
  redisPrefix: string;
  disconnectGraceMs: number;
  rateScale?: number;
  tts?: TtsService;
  /** Behind a reverse proxy (Caddy / Nginx): take the client IP from X-Forwarded-For. */
  trustProxy?: boolean;
}

export class Realtime implements GameBroadcaster, RoomBroadcaster {
  readonly io: IO;
  private readonly graceTimers = new Set<NodeJS.Timeout>();

  constructor(
    httpServer: HttpServer,
    private readonly deps: RealtimeDeps,
  ) {
    this.io = new Server(httpServer, {
      path: '/socket.io',
      cors: { origin: deps.corsOrigins, credentials: false },
      serveClient: false,
      pingInterval: 20_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 32 * 1024,
    });
    this.io.adapter(createAdapter(deps.pubClient, deps.subClient, { key: `${deps.redisPrefix}sio` }));
    this.io.use((socket, next) => void this.authenticate(socket, next));
    this.io.on('connection', (socket) => void this.onConnection(socket));
    deps.games.setBroadcaster(this);
    deps.rooms.setBroadcaster(this);
  }

  async close(): Promise<void> {
    for (const t of this.graceTimers) clearTimeout(t);
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
  }

  // -------------------------------------------------------------------------
  // Auth & connection lifecycle
  // -------------------------------------------------------------------------

  private async authenticate(socket: ClientSocket, next: (err?: Error) => void): Promise<void> {
    try {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string') throw new AppError('UNAUTHORIZED');
      const ip = clientIp(socket.handshake, this.deps.trustProxy ?? false);
      await this.deps.limiter.consume(`ws-auth:${ip}`, 30 * (this.deps.rateScale ?? 1), 60_000);
      socket.data.ctx = await this.deps.rooms.authenticate(token);
      next();
    } catch (err) {
      const e = toServerError(err);
      const error = new Error(e.message) as Error & { data?: unknown };
      error.data = { code: e.code };
      next(error);
    }
  }

  private async onConnection(socket: ClientSocket): Promise<void> {
    const ctx = socket.data.ctx;
    const rooms = [R.room(ctx.roomId), R.member(ctx.memberId)];
    if (ctx.kind === 'MODERATOR') rooms.push(R.mods(ctx.roomId));
    if (ctx.kind === 'SPECTATOR') rooms.push(R.spectators(ctx.roomId));
    await socket.join(rooms);
    this.registerHandlers(socket);
    socket.on('disconnect', () => this.onDisconnect(ctx));

    try {
      const returned = await this.deps.rooms.markReturned(ctx);
      const sockets = await this.io.in(R.member(ctx.memberId)).fetchSockets();
      if (sockets.length === 1 || returned) this.roomEvent(ctx.roomId, 'PLAYER_RECONNECTED', { memberId: ctx.memberId });
      await this.syncRoom(ctx.roomId);
      await this.applyPresencePolicy(ctx.roomId);
    } catch (err) {
      this.deps.logger.warn({ err: (err as Error).message, memberId: ctx.memberId }, 'post-connect sync failed');
    }
  }

  private onDisconnect(ctx: MemberContext): void {
    const timer = setTimeout(() => {
      this.graceTimers.delete(timer);
      void (async () => {
        const sockets = await this.io.in(R.member(ctx.memberId)).fetchSockets();
        if (sockets.length > 0) return; // refreshed / reconnected
        this.roomEvent(ctx.roomId, 'PLAYER_DISCONNECTED', { memberId: ctx.memberId });
        await this.syncRoom(ctx.roomId);
        await this.applyPresencePolicy(ctx.roomId);
      })().catch((err: unknown) => this.deps.logger.warn({ err: (err as Error).message }, 'disconnect handling failed'));
    }, this.deps.disconnectGraceMs);
    this.graceTimers.add(timer);
  }

  /**
   * Disconnect policy (RULES.md §9):
   *  AUTO  — no participant connected → pause (or abort); someone back → resume.
   *  HUMAN — moderator gone → pause with abandonment deadline; moderator back → resume.
   */
  async applyPresencePolicy(roomId: string): Promise<void> {
    const current = await this.deps.rooms.currentGame(roomId);
    if (!current || current.status !== 'RUNNING') return;
    const online = await this.connectedMemberIds(roomId);
    const loaded = await this.deps.games.loadState(current.gameId);
    if (!loaded) return;
    const state = loaded.state;
    let present: boolean;
    if (state.mode === 'AUTO') present = state.players.some((p) => online.has(p.id));
    else present = (await this.deps.rooms.moderatorIds(roomId)).some((id) => online.has(id));

    const system: Actor = { kind: 'system' };
    if (!present) {
      const abort = state.mode === 'AUTO' && state.config.rules.onAllDisconnected === 'end';
      await this.deps.games.dispatch(current.gameId, system, (s): Command | null => {
        if (s.status !== 'RUNNING') return null;
        if (abort) return { type: 'SYS_ABORT', reason: 'ALL_DISCONNECTED' };
        if (s.paused && s.paused.abandonAt !== null) return null;
        return { type: 'SYS_PAUSE', reason: state.mode === 'AUTO' ? 'ALL_DISCONNECTED' : 'MODERATOR_DISCONNECTED' };
      });
    } else if (state.paused) {
      await this.deps.games.dispatch(current.gameId, system, (s) =>
        s.status === 'RUNNING' && s.paused && (s.paused.by === 'system' || s.paused.abandonAt !== null) ? { type: 'SYS_RESUME' } : null,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  private handle<E extends keyof ClientToServerEvents, S extends ZodType, R>(
    socket: ClientSocket,
    event: E,
    schema: S,
    fn: (data: S['_output'], ctx: MemberContext) => Promise<R>,
    limit = 15,
  ): void {
    const listener = async (payload: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      const reply = ack as (res: Ack<R | undefined>) => void;
      try {
        await this.deps.limiter.consume(`ws:${socket.data.ctx.memberId}:${event}`, limit, 1000);
        const parsed = schema.safeParse(payload ?? {});
        if (!parsed.success) {
          throw new AppError('INVALID_PAYLOAD', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
        }
        const data = await fn(parsed.data, socket.data.ctx);
        reply({ ok: true, data });
      } catch (err) {
        const e = toServerError(err);
        if (e.code === 'INTERNAL') this.deps.logger.error({ err, event }, 'socket handler failed');
        reply({ ok: false, error: e });
      }
    };
    socket.on(event, listener as never);
  }

  private registerHandlers(socket: ClientSocket): void {
    const { rooms } = this.deps;

    this.handle(socket, 'room:sync', EmptyPayloadSchema, async (_d, ctx) => {
      const room = await rooms.buildRoomView(ctx.roomId, ctx.memberId);
      const game = await this.gameSyncFor(ctx);
      return { room, game };
    }, 5);
    this.handle(socket, 'room:leave', EmptyPayloadSchema, async (_d, ctx) => {
      await rooms.leave(ctx);
      return undefined;
    }, 3);
    this.handle(socket, 'lobby:ready', ReadyPayloadSchema, async (d, ctx) => {
      await rooms.setReady(ctx, d.ready);
      return undefined;
    }, 5);
    this.handle(socket, 'lobby:updateSettings', UpdateSettingsPayloadSchema, async (d, ctx) => {
      await rooms.updateSettings(ctx, d.patch);
      return undefined;
    }, 10);
    this.handle(socket, 'lobby:kick', TargetMemberPayloadSchema, async (d, ctx) => {
      await rooms.kick(ctx, d.memberId);
      return undefined;
    }, 5);
    this.handle(socket, 'lobby:transferHost', TargetMemberPayloadSchema, async (d, ctx) => {
      await rooms.transferHost(await rooms.refreshContext(ctx), d.memberId);
      socket.data.ctx = await rooms.refreshContext(ctx);
      return undefined;
    }, 3);
    this.handle(socket, 'game:start', EmptyPayloadSchema, async (_d, ctx) => {
      const gameId = await rooms.start(await rooms.refreshContext(ctx));
      return { gameId };
    }, 2);
    this.handle(socket, 'game:playAgain', EmptyPayloadSchema, async (_d, ctx) => {
      await rooms.playAgain(ctx);
      return undefined;
    }, 2);

    this.handle(socket, 'game:ackRole', AckRolePayloadSchema, (d, ctx) =>
      this.playerCommand(ctx, { type: 'ACK_ROLE', phaseId: d.phaseId }),
    );
    this.handle(socket, 'game:nightAction', NightActionPayloadSchema, (d, ctx) =>
      this.playerCommand(ctx, { type: 'NIGHT_ACTION', phaseId: d.phaseId, action: d.action }, { clientActionId: d.clientActionId }),
    );
    this.handle(socket, 'game:hunterShoot', HunterShootPayloadSchema, (d, ctx) =>
      this.playerCommand(ctx, { type: 'HUNTER_SHOOT', phaseId: d.phaseId, targetId: d.targetId }, { clientActionId: d.clientActionId }),
    );
    this.handle(socket, 'game:skipDiscussion', SkipDiscussionPayloadSchema, (d, ctx) =>
      this.playerCommand(ctx, { type: 'SKIP_DISCUSSION', phaseId: d.phaseId }),
    );
    this.handle(socket, 'game:vote', VotePayloadSchema, (d, ctx) =>
      this.playerCommand(ctx, { type: 'VOTE', phaseId: d.phaseId, targetId: d.targetId, lock: d.lock }, { clientActionId: d.clientActionId }),
    );
    this.handle(socket, 'mod:command', ModeratorCommandPayloadSchema, async (d, ctx) => {
      const fresh = await rooms.refreshContext(ctx);
      if (fresh.kind !== 'MODERATOR') throw new AppError('NOT_ALLOWED', 'Chỉ quản trò mới có quyền này.');
      const gameId = await this.requireGame(ctx.roomId);
      const { reason, ...rest } = d.command as typeof d.command & { reason?: string };
      const outcome = await this.deps.games.dispatch(gameId, { kind: 'moderator' }, rest as Command, {
        memberId: ctx.memberId,
        clientActionId: d.clientActionId,
        reason,
      });
      if (!outcome.ok) throw new AppError(outcome.error.code, outcome.error.message);
      return undefined;
    }, 10);
    this.handle(socket, 'time:ping', PingPayloadSchema, async (d) => ({ serverNow: Date.now(), clientTime: d.clientTime }), 5);
  }

  private async requireGame(roomId: string): Promise<string> {
    const current = await this.deps.rooms.currentGame(roomId);
    if (!current) throw new AppError('NO_ACTIVE_GAME');
    return current.gameId;
  }

  private async playerCommand(ctx: MemberContext, command: Command, meta: Omit<DispatchMeta, 'memberId'> = {}): Promise<undefined> {
    if (ctx.kind !== 'PLAYER') throw new AppError('NOT_PARTICIPANT', 'Bạn không tham gia trận này.');
    const gameId = await this.requireGame(ctx.roomId);
    const outcome = await this.deps.games.dispatch(gameId, { kind: 'player', playerId: ctx.memberId }, command, {
      ...meta,
      memberId: ctx.memberId,
    });
    if (!outcome.ok) throw new AppError(outcome.error.code, outcome.error.message);
    return undefined;
  }

  private viewerFor(ctx: MemberContext, state: GameState): Viewer {
    if (ctx.kind === 'MODERATOR' && state.mode === 'HUMAN') return { kind: 'moderator' };
    if (ctx.kind === 'PLAYER' && state.players.some((p) => p.id === ctx.memberId)) {
      return { kind: 'player', playerId: ctx.memberId };
    }
    return { kind: 'spectator' };
  }

  private async gameSyncFor(ctx: MemberContext): Promise<GameSync | null> {
    const current = await this.deps.rooms.currentGame(ctx.roomId);
    if (!current) return null;
    const loaded = await this.deps.games.loadState(current.gameId);
    if (!loaded) return null;
    return { view: projectView(loaded.state, this.viewerFor(ctx, loaded.state)), version: loaded.version, serverNow: Date.now() };
  }

  // -------------------------------------------------------------------------
  // Broadcasting (recipient-scoped; never broadcast raw state)
  // -------------------------------------------------------------------------

  async deliverGame({ roomId, state, version, events }: GameDelivery): Promise<void> {
    const human = state.mode === 'HUMAN';
    for (const { envelope, event } of events) {
      const v = event.visibility;
      if (v.scope === 'public') {
        this.io.to(R.room(roomId)).emit('event', envelope);
      } else if (v.scope === 'players') {
        const targets = v.playerIds.map(R.member);
        if (human) targets.push(R.mods(roomId));
        this.io.to(targets).emit('event', envelope);
      } else if (human) {
        this.io.to(R.mods(roomId)).emit('event', envelope);
      }
    }
    const serverNow = Date.now();
    for (const p of state.players) {
      this.io.to(R.member(p.id)).emit('game:sync', {
        view: projectView(state, { kind: 'player', playerId: p.id }),
        version,
        serverNow,
      });
    }
    if (human) {
      this.io.to(R.mods(roomId)).emit('game:sync', { view: projectView(state, { kind: 'moderator' }), version, serverNow });
    }
    const spectatorView = projectView(state, { kind: 'spectator' });
    this.io.to(R.spectators(roomId)).emit('game:sync', { view: spectatorView, version, serverNow });
    // Warm the VieNeu narration cache for the new phase (narration only uses public information).
    if (this.deps.tts?.enabled && events.some((e) => NARRATED_EVENTS.has(e.event.type))) {
      this.deps.tts.prefetch(narrate(spectatorView));
    }
  }

  roomEvent(roomId: string, type: RoomEventType, payload: Record<string, unknown>): void {
    this.io.to(R.room(roomId)).emit('event', { id: newId(), type, at: Date.now(), payload });
  }

  async connectedMemberIds(roomId: string): Promise<Set<string>> {
    const sockets = await this.io.in(R.room(roomId)).fetchSockets();
    return new Set(sockets.map((s) => (s.data as SocketData).ctx.memberId));
  }

  async syncRoom(roomId: string): Promise<void> {
    const sockets = await this.io.in(R.room(roomId)).fetchSockets();
    const online = new Set(sockets.map((s) => (s.data as SocketData).ctx.memberId));
    const views = await this.deps.rooms.buildRoomViews(roomId, online);
    for (const s of sockets) {
      const view = views.get((s.data as SocketData).ctx.memberId);
      if (view) s.emit('room:state', view);
    }
  }

  async revokeMember(memberId: string, reason: string): Promise<void> {
    this.io.to(R.member(memberId)).emit('session:revoked', { reason });
    // Give the client a moment to receive the message before disconnecting.
    setTimeout(() => this.io.in(R.member(memberId)).disconnectSockets(true), 200);
  }
}
