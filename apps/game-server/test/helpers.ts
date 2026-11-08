import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { GameView } from '@masoi/engine';
import type { Ack, GameSync, RoomView, ServerEvent, SessionResponse } from '@masoi/shared';
import { io, type Socket } from 'socket.io-client';
import { createApp, type App } from '../src/app';
import { loadConfig } from '../src/config';

try {
  process.loadEnvFile(resolve(__dirname, '../../../.env'));
} catch {
  /* CI provides env */
}

export function testEnv(prefix = `test:${randomUUID().slice(0, 8)}:`) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.searchParams.set('schema', 'test');
  return {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: url.toString(),
    GAME_SERVER_PORT: '0',
    GAME_SERVER_HOST: '127.0.0.1',
    REDIS_PREFIX: prefix,
    LOG_LEVEL: 'silent',
    DISCONNECT_GRACE_MS: '300',
    RATE_LIMIT_SCALE: '1000',
    CORS_ORIGINS: 'http://localhost:3100',
  } as NodeJS.ProcessEnv;
}

export async function startServer(prefix?: string): Promise<{ app: App; url: string; prefix: string }> {
  const env = testEnv(prefix);
  const app = await createApp(loadConfig(env));
  const url = await app.listen();
  return { app, url, prefix: env.REDIS_PREFIX as string };
}

export async function api<T>(url: string, path: string, body?: unknown, token?: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${url}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

export const FAST_TIMERS = {
  roleReveal: 5,
  dawn: 3,
  voteResult: 3,
  fakeStepMin: 2,
  fakeStepMax: 2,
  hunter: 10,
  discussion: 30,
  voting: 15,
  runoff: 15,
  cupid: 10,
  guard: 10,
  werewolves: 15,
  whiteWolf: 10,
  seer: 10,
  witch: 10,
};

export class Client {
  socket!: Socket;
  room: RoomView | null = null;
  sync: GameSync | null = null;
  events: ServerEvent[] = [];
  revoked: string | null = null;
  private waiters: (() => void)[] = [];

  constructor(
    readonly url: string,
    readonly session: SessionResponse,
    readonly name: string,
  ) {}

  get id() {
    return this.session.memberId;
  }
  get view(): GameView {
    if (!this.sync) throw new Error(`${this.name} has no game view`);
    return this.sync.view;
  }

  async connect(): Promise<this> {
    this.socket = io(this.url, { auth: { token: this.session.token }, transports: ['websocket'], reconnection: false, forceNew: true });
    this.socket.on('room:state', (r: RoomView) => {
      this.room = r;
      this.notify();
    });
    this.socket.on('game:sync', (s: GameSync) => {
      if (!this.sync || s.version >= this.sync.version) this.sync = s;
      this.notify();
    });
    this.socket.on('event', (e: ServerEvent) => {
      this.events.push(e);
      this.notify();
    });
    this.socket.on('session:revoked', (p: { reason: string }) => {
      this.revoked = p.reason;
      this.notify();
    });
    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', (err) => reject(err));
    });
    return this;
  }

  private notify() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }

  async waitFor(pred: () => boolean, label = 'condition', timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!pred()) {
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`${this.name}: timeout waiting for ${label} (phase=${this.sync?.view.phase.type}/${this.sync?.view.phase.step})`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, Math.min(left, 250));
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  }

  waitPhase(type: GameView['phase']['type'], step?: string, timeoutMs?: number) {
    return this.waitFor(
      () => this.sync?.view.phase.type === type && (step === undefined || this.sync?.view.phase.step === step),
      `${type}${step ? `/${step}` : ''}`,
      timeoutMs,
    );
  }

  emit<T = undefined>(event: string, payload: unknown = {}): Promise<Ack<T>> {
    return new Promise((resolve) => this.socket.emit(event, payload, (res: Ack<T>) => resolve(res)));
  }

  async must<T = undefined>(event: string, payload: unknown = {}): Promise<T> {
    const res = await this.emit<T>(event, payload);
    if (!res.ok) throw new Error(`${this.name} ${event} failed: ${res.error.code} ${res.error.message}`);
    return res.data;
  }

  close() {
    this.socket?.disconnect();
  }
}

export function cid() {
  return randomUUID().replace(/-/g, '');
}

/** Create a room with `n` players (AUTO: host is a player; HUMAN: host is moderator + n players). */
export async function setupRoom(url: string, mode: 'AUTO' | 'HUMAN', n: number, settings: Record<string, unknown> = {}) {
  const created = await api<SessionResponse>(url, '/api/rooms', {
    nickname: mode === 'HUMAN' ? 'Quản Trò' : 'Chủ Phòng',
    mode,
    name: 'Phòng Test',
    maxPlayers: 12,
    settings,
  });
  if (created.status !== 201) throw new Error(`create failed ${JSON.stringify(created.data)}`);
  const host = await new Client(url, created.data, 'host').connect();
  const others: Client[] = [];
  const toJoin = mode === 'HUMAN' ? n : n - 1;
  for (let i = 0; i < toJoin; i++) {
    const joined = await api<SessionResponse>(url, `/api/rooms/${created.data.roomCode}/join`, { nickname: `Người ${i + 1}` });
    if (joined.status !== 201) throw new Error(`join failed ${JSON.stringify(joined.data)}`);
    others.push(await new Client(url, joined.data, `p${i + 1}`).connect());
  }
  return { code: created.data.roomCode, host, others, all: [host, ...others] };
}
