#!/usr/bin/env node
/**
 * Validates delivered artwork against the manifest and writes src/generated/asset-availability.json.
 *  - wrong size / missing alpha → error (exit 1, unless --quiet)
 *  - missing file → reported (technical placeholder is used at runtime)
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST } from './manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public', 'assets');
const quiet = process.argv.includes('--quiet');

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  /* dimension checks skipped */
}

const availability = {};
const errors = [];
const missing = { P0: [], P1: [], P2: [] };

for (const a of MANIFEST) {
  const master = join(pub, `${a.key}.png`);
  const folder = dirname(master);
  const base = a.key.split('/').pop();
  const genDir = join(folder, '_generated');
  const webp = existsSync(genDir)
    ? readdirSync(genDir)
        .map((f) => f.match(new RegExp(`^${base}-(\\d+)\\.webp$`)))
        .filter(Boolean)
        .map((m) => Number(m[1]))
        .sort((x, y) => x - y)
    : [];
  const present = existsSync(master);
  availability[a.key] = { master: present, webp: present ? webp : [] };
  if (!present) {
    missing[a.priority].push(a.key);
    continue;
  }
  if (sharp) {
    const meta = await sharp(master).metadata();
    if (meta.width !== a.width || meta.height !== a.height) {
      errors.push(`${a.key}.png: ${meta.width}×${meta.height}, expected ${a.width}×${a.height}`);
    }
    if (a.alpha && !meta.hasAlpha) errors.push(`${a.key}.png: needs a transparent background (alpha channel)`);
  }
}

const outDir = join(root, 'src', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'asset-availability.json'), JSON.stringify(availability, null, 2) + '\n');

const delivered = Object.values(availability).filter((v) => v.master).length;
if (!quiet || errors.length) {
  console.log(`[assets] ${delivered}/${MANIFEST.length} assets delivered.`);
  if (missing.P0.length) console.log(`[assets] Missing P0 (placeholder in use): ${missing.P0.length}`);
  if (!quiet) for (const p of ['P0', 'P1', 'P2']) if (missing[p].length) console.log(`  ${p}: ${missing[p].join(', ')}`);
}
if (errors.length) {
  console.error('[assets] Invalid files:\n  ' + errors.join('\n  '));
  if (!quiet) process.exit(1);
}
