import type { Logger } from './logger';

/**
 * Retries `step` with exponential backoff until it succeeds or `stopped()` turns true.
 * Used at boot so a Postgres / Redis that is (re)starting — shared with another app on the VPS — makes the
 * game server wait instead of exiting and crash-looping. Returns false if stopped before success.
 */
export async function retryUntilReady(
  name: string,
  step: () => Promise<void>,
  logger: Logger,
  stopped: () => boolean,
  opts: { initialDelayMs?: number; maxDelayMs?: number } = {},
): Promise<boolean> {
  let delay = opts.initialDelayMs ?? 500;
  const maxDelay = opts.maxDelayMs ?? 5_000;
  for (let attempt = 1; ; attempt++) {
    if (stopped()) return false;
    try {
      await step();
      if (attempt > 1) logger.info({ step: name, attempts: attempt }, 'dependencies ready');
      return true;
    } catch (err) {
      // Prisma / ioredis messages name the host, never the password.
      logger.warn({ step: name, attempt, retryInMs: delay, err: summary(err) }, 'dependencies not ready, retrying');
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, maxDelay);
  }
}

/** Resolves to the promise's value, or rejects after `ms` (the original promise keeps running). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function summary(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.trim().split('\n').filter(Boolean).pop()?.slice(0, 300) ?? 'unknown error';
}

/** Connection targets for logs: host / database / pool — never credentials. */
export function describeTargets(databaseUrl: string, redisUrl: string, redisPrefix: string) {
  const describe = (raw: string) => {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  };
  const db = describe(databaseUrl);
  const rd = describe(redisUrl);
  return {
    db: db
      ? { host: db.host, database: db.pathname.slice(1), connectionLimit: db.searchParams.get('connection_limit') ?? 'prisma default' }
      : 'unparsable',
    redis: rd ? { host: rd.host, db: rd.pathname.slice(1) || '0', prefix: redisPrefix } : 'unparsable',
  };
}
