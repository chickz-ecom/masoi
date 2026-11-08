import type { Redis } from 'ioredis';
import { AppError } from '../lib/errors';

/**
 * Fixed-window rate limiter backed by Redis (works across instances).
 * Throws RATE_LIMITED when the budget for the window is exhausted.
 */
export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  async consume(key: string, limit: number, windowMs: number): Promise<void> {
    const bucket = Math.floor(Date.now() / windowMs);
    const redisKey = `${this.prefix}rl:${key}:${bucket}`;
    const results = await this.redis.multi().incr(redisKey).pexpire(redisKey, windowMs + 1000).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    if (count > limit) throw new AppError('RATE_LIMITED');
  }
}
