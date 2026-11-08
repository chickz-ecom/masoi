import pino from 'pino';

/**
 * Structured logger. Tokens and auth headers are redacted; game secrets (roles, night actions)
 * must never be logged above debug level.
 */
export function createLogger(level: string, pretty: boolean) {
  return pino({
    level,
    redact: {
      paths: ['token', '*.token', 'req.headers.authorization', 'headers.authorization', 'auth.token', '*.auth.token'],
      censor: '[redacted]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } } : {}),
  });
}

export type Logger = ReturnType<typeof createLogger>;
