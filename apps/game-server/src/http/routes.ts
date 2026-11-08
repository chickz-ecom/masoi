import {
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  RoomCodeSchema,
  type RoomPublicInfo,
  type SessionResponse,
} from '@masoi/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { withTimeout } from '../lib/dependencies';
import { AppError } from '../lib/errors';
import type { TtsService } from '../narration/ttsService';
import type { RoomService } from '../rooms/roomService';

function bearer(req: FastifyRequest): string {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw new AppError('UNAUTHORIZED');
  return h.slice(7).trim();
}

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new AppError('INVALID_PAYLOAD', r.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
  return r.data;
}

const HEALTH_TIMEOUT_MS = 2_000;

export async function registerRoutes(
  app: FastifyInstance,
  deps: { rooms: RoomService; prisma: PrismaClient; redis: Redis; tts?: TtsService; rateScale?: number; isReady?: () => boolean },
): Promise<void> {
  const { rooms, prisma, redis } = deps;
  const scale = deps.rateScale ?? 1;
  const limit = (max: number) => ({ rateLimit: { max: max * scale, timeWindow: '1 minute' } });

  // Live check of the (shared) Postgres / Redis, each bounded by a timeout so the endpoint answers quickly during an
  // outage. `ready` = boot finished (role definitions, timers restored). 503 unless all three are true.
  app.get('/api/health', { config: { rateLimit: false } }, async (_req, reply) => {
    const [db, redisOk] = await Promise.all([
      withTimeout(prisma.$queryRaw`SELECT 1`, HEALTH_TIMEOUT_MS).then(
        () => true,
        () => false,
      ),
      // Not connected → false at once (a PING would wait in ioredis' offline queue).
      redis.status !== 'ready'
        ? Promise.resolve(false)
        : withTimeout(redis.ping(), HEALTH_TIMEOUT_MS).then(
            (r) => r === 'PONG',
            () => false,
          ),
    ]);
    const ready = deps.isReady?.() ?? true;
    const ok = db && redisOk && ready;
    return reply.status(ok ? 200 : 503).send({ ok, db, redis: redisOk, ready, time: Date.now() });
  });

  app.post(
    '/api/rooms',
    { config: limit(10) },
    async (req, reply): Promise<SessionResponse> => {
      const body = parse(CreateRoomRequestSchema, req.body);
      const session = await rooms.createRoom(body);
      reply.status(201);
      return session;
    },
  );

  app.get<{ Params: { code: string } }>(
    '/api/rooms/:code',
    { config: limit(60) },
    async (req): Promise<RoomPublicInfo> => rooms.getPublicInfo(parse(RoomCodeSchema, req.params.code)),
  );

  app.post<{ Params: { code: string } }>(
    '/api/rooms/:code/join',
    { config: limit(20) },
    async (req, reply): Promise<SessionResponse> => {
      const code = parse(RoomCodeSchema, req.params.code);
      const body = parse(JoinRoomRequestSchema, req.body);
      const session = await rooms.joinRoom(code, body);
      reply.status(201);
      return session;
    },
  );

  /** Is server-side (VieNeu) narration available? */
  app.get('/api/tts/status', { config: limit(60) }, async () => {
    const tts = deps.tts;
    return { enabled: Boolean(tts?.enabled) && (await tts!.healthy()), voice: tts?.voice ?? null, engine: 'vieneu' };
  });

  /** Narration audio (mp3). Requires a room session; text is public narration, length-limited and cached. */
  // Keyed by session, not IP: several players behind one NAT / one dev machine must not share the budget.
  app.post(
    '/api/tts',
    {
      config: {
        rateLimit: {
          max: 120 * scale,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => `tts:${req.headers.authorization ?? req.ip}`,
        },
      },
    },
    async (req, reply) => {
    await rooms.authenticate(bearer(req));
    const body = (req.body ?? {}) as { text?: unknown };
    if (typeof body.text !== 'string' || !body.text.trim()) throw new AppError('INVALID_PAYLOAD', 'Thiếu nội dung.');
    if (!deps.tts?.enabled) throw new AppError('NOT_ALLOWED', 'Lời dẫn giọng nói chưa được bật trên máy chủ.');
    const audio = await deps.tts.synthesize(body.text);
    return reply.header('content-type', 'audio/mpeg').header('cache-control', 'private, max-age=86400').send(audio);
    },
  );

  /** Finished games of the caller's room (history / replay summary). Requires the session token. */
  app.get('/api/me/history', { config: limit(30) }, async (req) => {
    const ctx = await rooms.authenticate(bearer(req));
    const games = await prisma.game.findMany({
      where: { roomId: ctx.roomId, status: { in: ['ENDED', 'ABORTED'] } },
      orderBy: { number: 'desc' },
      take: 20,
      select: { id: true, number: true, mode: true, status: true, startedAt: true, endedAt: true, result: true },
    });
    return games.map((g) => ({
      gameId: g.id,
      number: g.number,
      mode: g.mode,
      status: g.status,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
      winner: g.result?.winner ?? null,
      winnerIds: g.result?.winnerIds ?? [],
      nights: g.result?.nights ?? 0,
      days: g.result?.days ?? 0,
      summary: g.result?.summary ?? null,
    }));
  });
}
