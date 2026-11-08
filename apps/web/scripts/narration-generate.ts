/**
 * Pre-records every narration clip with VieNeu-TTS (same voice as the live narrator) into
 *   public/assets/audio/narration/<id>.mp3  +  src/generated/narration-clips.json
 * Only new/changed lines are synthesized (hash of voice + text). Needs the VieNeu server running:
 *   cd ~/Documents/Personal/App/TTS && ./start-server.sh
 *   npm run narration:generate -w @masoi/web            # TTS_URL / TTS_VOICE from the root .env
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NARRATION_CLIPS } from '@masoi/shared';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'assets', 'audio', 'narration');
const manifestPath = join(root, 'src', 'generated', 'narration-clips.json');
const url = (process.env.TTS_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const voice = process.env.TTS_VOICE || 'Hải Đăng';
const format = 'mp3_44100_96';
const force = process.argv.includes('--force');

interface Manifest {
  voice: string;
  generatedAt: string;
  clips: Record<string, string>;
}

mkdirSync(outDir, { recursive: true });
const prev: Manifest = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest)
  : { voice, generatedAt: '', clips: {} };

const health = await fetch(`${url}/health`).catch(() => null);
if (!health?.ok) {
  console.error(`[narration] VieNeu server not reachable at ${url} — start it with ./start-server.sh in the TTS project.`);
  process.exit(1);
}

const clips: Record<string, string> = {};
let made = 0;
for (const [id, text] of Object.entries(NARRATION_CLIPS)) {
  const hash = createHash('sha1').update(`${voice}|${format}|${text}`).digest('hex').slice(0, 12);
  const file = join(outDir, `${id}.mp3`);
  clips[id] = hash;
  if (!force && prev.clips[id] === hash && existsSync(file)) continue;
  const res = await fetch(`${url}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${format}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(process.env.TTS_API_KEY ? { 'xi-api-key': process.env.TTS_API_KEY } : {}) },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`[narration] ${id}: HTTP ${res.status}`);
    process.exit(1);
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  made++;
  console.log(`[narration] ${id} ← "${text}"`);
}

// Remove clips that no longer exist.
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.mp3') && !(f.slice(0, -4) in clips)) unlinkSync(join(outDir, f));
}
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify({ voice, generatedAt: new Date().toISOString(), clips }, null, 2) + '\n');
console.log(`[narration] ${Object.keys(clips).length} clips (${made} generated) — voice "${voice}".`);
