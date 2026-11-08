import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  GAME_SERVER_PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  GAME_SERVER_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:3100'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Key prefix so several deployments/tests can share one Redis. */
  REDIS_PREFIX: z.string().default('ww:'),
  /** Grace period before treating a disconnect as "gone" (refresh tolerance). */
  /** Multiplier for HTTP rate limits (tests use a large value). */
  RATE_LIMIT_SCALE: z.coerce.number().min(1).max(10_000).default(1),
  /** VieNeu-TTS server (ElevenLabs-compatible API). Empty = server-side narration disabled. */
  TTS_URL: z.string().default(''),
  TTS_VOICE: z.string().default('Hải Đăng'),
  TTS_API_KEY: z.string().default(''),
  TTS_FORMAT: z.string().regex(/^mp3_\d{4,5}_\d{2,3}$/).default('mp3_24000_64'),
  TTS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
  DISCONNECT_GRACE_MS: z.coerce.number().int().min(0).max(60_000).default(4000),
});

export type AppConfig = z.infer<typeof EnvSchema> & { corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
