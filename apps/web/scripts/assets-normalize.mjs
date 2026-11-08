#!/usr/bin/env node
/**
 * Normalizes delivered masters to the manifest contract (run before assets:optimize):
 *  - Same aspect ratio but different size (e.g. ChatGPT's 1254×1254 squares) → resized to the exact size.
 *  - Asset requires alpha but has none → a uniform background (sampled from the corners) is keyed out
 *    with soft edges and colour un-premultiplied (e.g. a moon delivered on white).
 * Originals are kept in public/assets/<folder>/_originals/ (git-ignored) the first time they are touched.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MANIFEST } from './manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public', 'assets');
let changed = 0;

async function keyOutBackground(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => { const i = (y * w + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const corners = [px(2, 2), px(w - 3, 2), px(2, h - 3), px(w - 3, h - 3)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / 4));
  const spread = Math.max(...corners.map((p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2])));
  if (spread > 40) return null; // background is not uniform → leave it for a human
  const out = Buffer.alloc(w * h * 4);
  const lo = 18, hi = 90; // distance band for the soft edge
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
    const a = Math.min(1, Math.max(0, (d - lo) / (hi - lo)));
    const un = (c, k) => (a > 0 ? Math.min(255, Math.max(0, Math.round((c - (1 - a) * bg[k]) / a))) : 0);
    out[i * 4] = un(r, 0); out[i * 4 + 1] = un(g, 1); out[i * 4 + 2] = un(b, 2); out[i * 4 + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

for (const a of MANIFEST) {
  const file = join(pub, `${a.key}.png`);
  if (!existsSync(file)) continue;
  const meta = await sharp(file).metadata();
  const sameAspect = Math.abs(meta.width / meta.height - a.width / a.height) < 0.01;
  const needsResize = sameAspect && (meta.width !== a.width || meta.height !== a.height);
  const needsAlpha = a.alpha && !meta.hasAlpha;
  if (!needsResize && !needsAlpha) continue;
  const backupDir = join(dirname(file), '_originals');
  mkdirSync(backupDir, { recursive: true });
  const backup = join(backupDir, `${a.key.split('/').pop()}.png`);
  if (!existsSync(backup)) copyFileSync(file, backup);
  let buf = await sharp(file).png().toBuffer();
  if (needsAlpha) {
    const keyed = await keyOutBackground(buf);
    if (keyed) buf = keyed;
    else console.warn(`[assets] ${a.key}: needs transparency but the background is not uniform — fix manually`);
  }
  if (needsResize) buf = await sharp(buf).resize(a.width, a.height, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(buf).toFile(file);
  const m2 = await sharp(file).metadata();
  console.log(`[assets] normalized ${a.key}: ${meta.width}×${meta.height}${meta.hasAlpha ? '' : ' (opaque)'} → ${m2.width}×${m2.height}${m2.hasAlpha ? ' alpha' : ''}`);
  changed++;
}
console.log(`[assets] ${changed} file(s) normalized.`);
