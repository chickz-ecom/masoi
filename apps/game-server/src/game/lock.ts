import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { AppError } from '../lib/errors';

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end`;

/**
 * Distributed mutex (single Redis, SET NX PX + token-checked release).
 * Correctness does not depend on it alone: game writes also use optimistic version checks.
 */
export class RedisLock {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
    private readonly ttlMs = 10_000,
  ) {}

  async withLock<T>(name: string, fn: () => Promise<T>, waitMs = 5_000): Promise<T> {
    const key = `${this.prefix}lock:${name}`;
    const token = randomUUID();
    const deadline = Date.now() + waitMs;
    let delay = 10;
    for (;;) {
      const ok = await this.redis.set(key, token, 'PX', this.ttlMs, 'NX');
      if (ok === 'OK') break;
      if (Date.now() > deadline) throw new AppError('CONFLICT', 'Hệ thống đang bận, hãy thử lại.');
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 100);
    }
    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => undefined);
    }
  }
}

/** In-process FIFO per key: serializes work for the same game inside one instance. */
export class KeyedQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    this.tails.set(key, next);
    void next.finally(() => {
      if (this.tails.get(key) === next) this.tails.delete(key);
    }).catch(() => undefined);
    return next;
  }
}
