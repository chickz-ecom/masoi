#!/usr/bin/env node
/**
 * Generates responsive WebP variants for every delivered master PNG:
 *   public/assets/<folder>/<name>.png → public/assets/<folder>/_generated/<name>-<width>.webp
 * Fog overlays delivered on black are converted to alpha (luminance → transparency).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MANIFEST } from './manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public', 'assets');
let count = 0;

for (const a of MANIFEST) {
  const master = join(pub, `${a.key}.png`);
  if (!existsSync(master)) continue;
  const base = a.key.split('/').pop();
  const outDir = join(dirname(master), '_generated');
  mkdirSync(outDir, { recursive: true });
  let input = sharp(master);
  if (a.key === 'effects/fog-overlay') {
    const meta = await sharp(master).metadata();
    if (!meta.hasAlpha) {
      const { data, info } = await sharp(master).greyscale().raw().toBuffer({ resolveWithObject: true });
      input = sharp({ create: { width: info.width, height: info.height, channels: 3, background: '#d8dcf0' } }).joinChannel(data, {
        raw: { width: info.width, height: info.height, channels: 1 },
      });
    }
  }
  const buffer = await input.png().toBuffer();
  for (const w of a.widths) {
    await sharp(buffer)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: a.alpha ? 90 : 82, alphaQuality: 90, effort: 5 })
      .toFile(join(outDir, `${base}-${w}.webp`));
    count++;
  }
}
console.log(`[assets] wrote ${count} WebP variants. Run "npm run assets:check" to refresh availability.`);
