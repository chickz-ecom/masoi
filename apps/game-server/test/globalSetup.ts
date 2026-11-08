import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Run migrations into an isolated `test` schema before the suite. */
export default function setup() {
  try {
    process.loadEnvFile(resolve(__dirname, '../../../.env'));
  } catch {
    /* env may come from CI */
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.searchParams.set('schema', 'test');
  process.env.DATABASE_URL = url.toString();
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env, cwd: resolve(__dirname, '..') });
}
