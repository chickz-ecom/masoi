import { describe, expect, it } from 'vitest';
import { describeTargets, retryUntilReady, withTimeout } from '../src/lib/dependencies';
import { createLogger } from '../src/lib/logger';

const logger = createLogger('silent', false);

describe('startup dependency handling (shared Postgres / Redis)', () => {
  it('retries until the step succeeds instead of throwing', async () => {
    let calls = 0;
    const ok = await retryUntilReady(
      'test',
      async () => {
        calls++;
        if (calls < 3) throw new Error("Can't reach database server at `shared-postgres:5432`");
      },
      logger,
      () => false,
      { initialDelayMs: 5 },
    );
    expect(ok).toBe(true);
    expect(calls).toBe(3);
  });

  it('gives up quietly when shutting down', async () => {
    let stopped = false;
    const ok = await retryUntilReady(
      'test',
      async () => {
        stopped = true;
        throw new Error('down');
      },
      logger,
      () => stopped,
      { initialDelayMs: 5 },
    );
    expect(ok).toBe(false);
  });

  it('withTimeout rejects a hanging check', async () => {
    await expect(withTimeout(new Promise(() => undefined), 20)).rejects.toThrow('timeout');
    await expect(withTimeout(Promise.resolve(1), 20)).resolves.toBe(1);
  });

  it('describes connection targets without credentials', () => {
    const t = describeTargets(
      'postgresql://masoi:s3cret-pw@shared-postgres:5432/masoi?schema=public&connection_limit=10',
      'redis://shared-redis:6379/0',
      'ww:',
    );
    expect(JSON.stringify(t)).not.toContain('s3cret-pw');
    expect(t).toEqual({
      db: { host: 'shared-postgres:5432', database: 'masoi', connectionLimit: '10' },
      redis: { host: 'shared-redis:6379', db: '0', prefix: 'ww:' },
    });
  });
});
