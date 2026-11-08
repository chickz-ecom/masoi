import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { AppError } from '../lib/errors';
import type { Logger } from '../lib/logger';

export interface TtsConfig {
  url: string;
  voice: string;
  apiKey: string;
  format: string;
  timeoutMs: number;
}

const MAX_TEXT = 400;
const CACHE_TTL_S = 7 * 24 * 3600;
const MAX_QUEUE = 30;

/**
 * Vietnamese narration through a VieNeu-TTS server (ElevenLabs-compatible endpoint).
 * - Results are cached in Redis by hash(voice|format|text) → identical lines are generated once.
 * - Concurrent requests for the same text share one upstream call.
 * - Upstream calls are serialized (VieNeu on CPU serves one stream at a time).
 * Narration text is public game information only (it is built from the spectator projection).
 */
export class TtsService {
  private readonly inflight = new Map<string, Promise<Buffer>>();
  private chain: Promise<unknown> = Promise.resolve();
  private queued = 0;

  constructor(
    private readonly cfg: TtsConfig,
    private readonly redis: Redis,
    private readonly prefix: string,
    private readonly logger: Logger,
  ) {}

  get enabled(): boolean {
    return this.cfg.url.length > 0;
  }

  get voice(): string {
    return this.cfg.voice;
  }

  static normalize(text: string): string {
    return text.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  }

  private key(text: string): string {
    const h = createHash('sha256').update(`${this.cfg.voice}|${this.cfg.format}|${text}`).digest('hex');
    return `${this.prefix}tts:${h}`;
  }

  async synthesize(rawText: string): Promise<Buffer> {
    if (!this.enabled) throw new AppError('NOT_ALLOWED', 'Lời dẫn giọng nói chưa được bật trên máy chủ.');
    const text = TtsService.normalize(rawText);
    if (!text) throw new AppError('INVALID_PAYLOAD', 'Không có nội dung để đọc.');
    const key = this.key(text);
    const cached = await this.redis.getBuffer(key).catch(() => null);
    if (cached && cached.length > 0) return cached;
    const running = this.inflight.get(key);
    if (running) return running;
    if (this.queued >= MAX_QUEUE) throw new AppError('RATE_LIMITED', 'Máy chủ giọng nói đang bận.');
    this.queued++;
    const job = this.chain
      .catch(() => undefined)
      .then(() => this.fetchUpstream(text))
      .then(async (audio) => {
        await this.redis.set(key, audio, 'EX', CACHE_TTL_S).catch(() => undefined);
        return audio;
      })
      .finally(() => {
        this.queued--;
        this.inflight.delete(key);
      });
    this.chain = job;
    this.inflight.set(key, job);
    return job;
  }

  /** Warm the cache in the background (called on phase changes). */
  prefetch(text: string): void {
    if (!this.enabled || !text) return;
    this.synthesize(text).catch((err: unknown) => this.logger.debug({ err: (err as Error).message }, 'tts prefetch failed'));
  }

  private async fetchUpstream(text: string): Promise<Buffer> {
    const url = `${this.cfg.url.replace(/\/$/, '')}/v1/text-to-speech/${encodeURIComponent(this.cfg.voice)}?output_format=${this.cfg.format}`;
    const started = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.cfg.apiKey ? { 'xi-api-key': this.cfg.apiKey } : {}),
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    }).catch((err: unknown) => {
      this.logger.warn({ err: (err as Error).message }, 'tts upstream unreachable');
      throw new AppError('INTERNAL', 'Không kết nối được máy chủ giọng nói.');
    });
    if (!res.ok) {
      this.logger.warn({ status: res.status }, 'tts upstream error');
      throw new AppError(res.status === 429 ? 'RATE_LIMITED' : 'INTERNAL', 'Máy chủ giọng nói đang bận.');
    }
    const audio = Buffer.from(await res.arrayBuffer());
    this.logger.debug({ ms: Date.now() - started, bytes: audio.length }, 'tts generated');
    return audio;
  }

  async healthy(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetch(`${this.cfg.url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
