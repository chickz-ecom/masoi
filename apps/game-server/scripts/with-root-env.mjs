#!/usr/bin/env node
/**
 * Runs a command with the monorepo root .env loaded (e.g. `node scripts/with-root-env.mjs prisma migrate dev`).
 * Prisma CLI only reads .env next to the schema/package, but this repo keeps a single .env at the root.
 * Real environment variables always win over values from the file (CI / Docker keep working).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: with-root-env.mjs <command> [...args]');
  process.exit(2);
}
const res = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
process.exit(res.status ?? 1);
