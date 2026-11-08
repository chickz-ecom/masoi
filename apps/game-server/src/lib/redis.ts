import { Redis } from 'ioredis';
import type { Logger } from './logger';

export function createRedis(url: string, logger: Logger, name: string, opts: { subscriber?: boolean } = {}): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    // Commands fail fast during an outage instead of piling up forever.
    maxRetriesPerRequest: opts.subscriber ? null : 3,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
    connectionName: `masoi-${name}`,
  });
  client.on('error', (err) => logger.warn({ err: err.message, client: name }, 'redis error'));
  client.on('reconnecting', () => logger.info({ client: name }, 'redis reconnecting'));
  client.on('ready', () => logger.debug({ client: name }, 'redis ready'));
  return client;
}
