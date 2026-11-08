import type { Redis } from 'ioredis';
import type { Logger } from '../lib/logger';

const POP_DUE_SCRIPT = `
local items = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
for _, m in ipairs(items) do redis.call('ZREM', KEYS[1], m) end
return items`;

/**
 * Server-side phase timers. Deadlines live in a Redis sorted set (one entry per game, score = deadline ms).
 * Every instance polls; the Lua pop is atomic so each due timer is handled by exactly one instance.
 * Deadlines are also persisted in Postgres (Game.nextDeadline) and re-scheduled on boot.
 */
export class TimerScheduler {
  private handle: NodeJS.Timeout | null = null;
  private running = false;
  private lastWarnAt = 0;
  private readonly key: string;

  constructor(
    private readonly redis: Redis,
    prefix: string,
    private readonly logger: Logger,
    private readonly onDue: (gameId: string) => Promise<void>,
    private readonly intervalMs = 250,
  ) {
    this.key = `${prefix}timers`;
  }

  async schedule(gameId: string, deadline: number | null): Promise<void> {
    if (deadline === null) await this.redis.zrem(this.key, gameId);
    else await this.redis.zadd(this.key, deadline, gameId);
  }

  start(): void {
    if (this.handle) return;
    this.handle = setInterval(() => void this.poll(), this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }

  private async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = (await this.redis.eval(POP_DUE_SCRIPT, 1, this.key, Date.now(), 20)) as string[];
      await Promise.all(
        due.map((gameId) =>
          this.onDue(gameId).catch(async (err: unknown) => {
            this.logger.error({ err, gameId }, 'timer handling failed; retrying in 1s');
            await this.redis.zadd(this.key, Date.now() + 1000, gameId).catch(() => undefined);
          }),
        ),
      );
    } catch (err) {
      // Polls every 250 ms: during a Redis outage log at most every 10 s.
      if (Date.now() - this.lastWarnAt > 10_000) {
        this.lastWarnAt = Date.now();
        this.logger.warn({ err: (err as Error).message }, 'timer poll failed (Redis unavailable?)');
      }
    } finally {
      this.running = false;
    }
  }
}
