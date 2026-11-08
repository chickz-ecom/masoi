import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { AppConfig } from './config';
import { GameService } from './game/gameService';
import { KeyedQueue, RedisLock } from './game/lock';
import { TimerScheduler } from './game/scheduler';
import { registerRoutes } from './http/routes';
import { AppError, httpStatus } from './lib/errors';
import { describeTargets, retryUntilReady, withTimeout } from './lib/dependencies';
import { createLogger, type Logger } from './lib/logger';
import { createPrisma } from './lib/prisma';
import { createRedis } from './lib/redis';
import { Realtime } from './realtime/socketServer';
import { TtsService } from './narration/ttsService';
import { ensureRoleDefinitions } from './rooms/roleDefinitions';
import { RoomService } from './rooms/roomService';
import { RateLimiter } from './security/rateLimit';

export interface App {
  listen(): Promise<string>;
  close(): Promise<void>;
  logger: Logger;
  services: { rooms: RoomService; games: GameService; realtime: Realtime };
  address(): string;
}

export async function createApp(config: AppConfig, opts: { logger?: Logger } = {}): Promise<App> {
  const logger = opts.logger ?? createLogger(config.LOG_LEVEL, config.NODE_ENV === 'development');
  const prisma = createPrisma(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL, logger, 'cmd');
  const pub = createRedis(config.REDIS_URL, logger, 'pub', { subscriber: true });
  const sub = pub.duplicate();
  sub.on('error', (err) => logger.warn({ err: err.message }, 'redis sub error'));

  // No DB/Redis round-trip here: Postgres/Redis are shared with another app on the VPS and may be restarting.
  // listen() serves /api/health right away (db/redis=false) and waits for them instead of exiting (crash-loop).
  let closing = false;
  let ready = false;

  const prefix = config.REDIS_PREFIX;
  const lock = new RedisLock(redis, prefix);
  const queue = new KeyedQueue();
  const limiter = new RateLimiter(redis, prefix);

  // The scheduler needs the game service and vice-versa; wire through a late-bound callback.
  let games: GameService | null = null;
  const scheduler = new TimerScheduler(redis, prefix, logger, (gameId) => (games ? games.handleTimer(gameId) : Promise.resolve()));
  games = new GameService(prisma, lock, queue, scheduler, logger);
  const rooms = new RoomService(prisma, lock, games, logger, config.SESSION_TTL_DAYS);
  const tts = new TtsService(
    { url: config.TTS_URL, voice: config.TTS_VOICE, apiKey: config.TTS_API_KEY, format: config.TTS_FORMAT, timeoutMs: config.TTS_TIMEOUT_MS },
    redis,
    prefix,
    logger,
  );

  const http = Fastify({
    logger: false,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 16 * 1024,
  });
  await http.register(cors, { origin: config.corsOrigins, methods: ['GET', 'POST'] });
  await http.register(rateLimit, {
    global: true,
    max: 120 * config.RATE_LIMIT_SCALE,
    timeWindow: '1 minute',
    redis,
    nameSpace: `${prefix}http-rl:`,
    skipOnError: true,
    errorResponseBuilder: () => ({ statusCode: 429, code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, hãy thử lại sau.' }),
  });
  http.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.status(httpStatus(err.code)).send(err.toJSON());
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.status(429).send({ code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, hãy thử lại sau.' });
    if (status && status < 500) return reply.status(status).send({ code: 'INVALID_PAYLOAD', message: 'Yêu cầu không hợp lệ.' });
    logger.error({ err, url: req.url }, 'http error');
    return reply.status(500).send({ code: 'INTERNAL', message: 'Lỗi máy chủ.' });
  });
  await registerRoutes(http, { rooms, prisma, redis, tts, rateScale: config.RATE_LIMIT_SCALE, isReady: () => ready });
  await http.ready();

  const realtime = new Realtime(http.server, {
    rooms,
    games,
    limiter,
    logger,
    corsOrigins: config.corsOrigins,
    pubClient: pub,
    subClient: sub,
    redisPrefix: prefix,
    disconnectGraceMs: config.DISCONNECT_GRACE_MS,
    rateScale: config.RATE_LIMIT_SCALE,
    tts,
    trustProxy: config.TRUST_PROXY,
  });

  let address = '';
  return {
    logger,
    services: { rooms, games, realtime },
    address: () => address,
    async listen() {
      address = await http.listen({ port: config.GAME_SERVER_PORT, host: config.GAME_SERVER_HOST });
      const targets = describeTargets(config.DATABASE_URL, config.REDIS_URL, prefix);
      logger.info({ address, ...targets }, 'game server listening, connecting to Postgres / Redis');
      let restored = 0;
      const ok = await retryUntilReady(
        'startup',
        async () => {
          await ensureRoleDefinitions(prisma);
          if ((await withTimeout(redis.ping(), 5_000)) !== 'PONG') throw new Error('redis ping failed');
          restored = await games.reconcileTimers();
        },
        logger,
        () => closing,
      );
      if (!ok) return address;
      scheduler.start();
      ready = true;
      logger.info({ address, restoredTimers: restored, tts: tts.enabled ? `${config.TTS_URL} (${config.TTS_VOICE})` : 'off' }, 'game server ready');
      return address;
    },
    async close() {
      closing = true;
      await scheduler.stop();
      await realtime.close();
      await http.close().catch(() => undefined);
      await prisma.$disconnect();
      await Promise.allSettled([redis.quit(), pub.quit(), sub.quit()]);
    },
  };
}
