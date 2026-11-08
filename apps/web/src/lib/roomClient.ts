'use client';

import type { NightAction } from '@masoi/engine';
import {
  ERROR_MESSAGES,
  type Ack,
  type ClientToServerEvents,
  type GameSync,
  type ModeratorCommand,
  type RoomSettingsPatch,
  type RoomView,
  type ServerError,
  type ServerEvent,
  type ServerToClientEvents,
} from '@masoi/shared';
import { io, type Socket } from 'socket.io-client';
import { GAME_SERVER_URL } from './api';
import { newClientActionId } from './utils';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'revoked' | 'error';

export interface RoomClientState {
  status: ConnectionStatus;
  error: string | null;
  room: RoomView | null;
  game: GameSync | null;
  /** serverNow - clientNow, in ms. */
  clockOffset: number;
  events: ServerEvent[];
}

type Listener = () => void;
type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 8000;

/**
 * One instance per room page. Owns the Socket.IO connection and exposes an immutable snapshot
 * for React (useSyncExternalStore). The server is authoritative: this class never computes
 * game results — it only renders projections and sends intents.
 */
export class RoomClient {
  private socket: AppSocket | null = null;
  private listeners = new Set<Listener>();
  private state: RoomClientState = {
    status: 'connecting',
    error: null,
    room: null,
    game: null,
    clockOffset: 0,
    events: [],
  };

  constructor(readonly token: string) {}

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<RoomClientState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  now(): number {
    return Date.now() + this.state.clockOffset;
  }

  connect() {
    if (this.socket) return;
    const socket: AppSocket = io(GAME_SERVER_URL || undefined, {
      path: '/socket.io',
      auth: { token: this.token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.set({ status: 'connected', error: null });
      void this.resync();
      void this.syncClock();
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      if (this.state.status !== 'revoked') this.set({ status: 'reconnecting' });
    });
    socket.on('connect_error', (err) => {
      const code = (err as Error & { data?: { code?: string } }).data?.code;
      if (code === 'UNAUTHORIZED' || code === 'SESSION_REVOKED' || code === 'ROOM_CLOSED') {
        this.set({ status: 'revoked', error: err.message });
        socket.disconnect();
      } else {
        this.set({ status: this.state.room ? 'reconnecting' : 'error', error: 'Không kết nối được máy chủ. Đang thử lại…' });
      }
    });
    socket.on('room:state', (room) => this.set({ room }));
    socket.on('game:sync', (sync) => {
      const current = this.state.game;
      // Ignore out-of-order syncs (multiple server instances may deliver concurrently).
      if (current && current.view.gameId === sync.view.gameId && sync.version < current.version) return;
      this.set({ game: sync });
    });
    socket.on('event', (event) => {
      this.set({ events: [...this.state.events.slice(-49), event] });
      if (event.type === 'RETURNED_TO_LOBBY') this.set({ game: null });
    });
    socket.on('session:revoked', ({ reason }) => {
      this.set({ status: 'revoked', error: reason === 'KICKED' ? 'Bạn đã bị mời ra khỏi phòng.' : 'Bạn đã rời phòng.' });
    });
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  async resync() {
    const res = await this.emit<{ room: RoomView; game: GameSync | null }>('room:sync', {});
    if (res.ok) this.set({ room: res.data.room, game: res.data.game });
  }

  /** NTP-style offset estimate: median of a few round trips. */
  private async syncClock() {
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const res = await this.emit<{ serverNow: number }>('time:ping', { clientTime: t0 });
      const t1 = Date.now();
      if (res.ok) samples.push(res.data.serverNow - (t0 + (t1 - t0) / 2));
    }
    if (samples.length) {
      samples.sort((a, b) => a - b);
      this.set({ clockOffset: samples[Math.floor(samples.length / 2)] ?? 0 });
    }
  }

  emit<T = undefined>(event: keyof ClientToServerEvents, payload: unknown): Promise<Ack<T>> {
    const socket = this.socket;
    return new Promise((resolve) => {
      if (!socket || !socket.connected) {
        resolve({ ok: false, error: { code: 'INTERNAL', message: 'Mất kết nối — đang kết nối lại…' } });
        return;
      }
      (socket.timeout(ACK_TIMEOUT_MS) as unknown as {
        emit: (e: string, p: unknown, cb: (err: Error | null, res: Ack<T>) => void) => void;
      }).emit(event, payload, (err, res) => {
        if (err) resolve({ ok: false, error: { code: 'INTERNAL', message: 'Máy chủ không phản hồi, hãy thử lại.' } });
        else resolve(res);
      });
    });
  }

  // ---- intents -------------------------------------------------------------
  ready = (ready: boolean) => this.emit('lobby:ready', { ready });
  updateSettings = (patch: RoomSettingsPatch) => this.emit('lobby:updateSettings', { patch });
  kick = (memberId: string) => this.emit('lobby:kick', { memberId });
  transferHost = (memberId: string) => this.emit('lobby:transferHost', { memberId });
  start = () => this.emit<{ gameId: string }>('game:start', {});
  leave = () => this.emit('room:leave', {});
  playAgain = () => this.emit('game:playAgain', {});
  ackRole = (phaseId: number) => this.emit('game:ackRole', { phaseId });
  nightAction = (phaseId: number, action: NightAction) =>
    this.emit('game:nightAction', { phaseId, clientActionId: newClientActionId(), action });
  hunterShoot = (phaseId: number, targetId: string | null) =>
    this.emit('game:hunterShoot', { phaseId, clientActionId: newClientActionId(), targetId });
  skipDiscussion = (phaseId: number) => this.emit('game:skipDiscussion', { phaseId });
  vote = (phaseId: number, targetId: string | null, lock: boolean) =>
    this.emit('game:vote', { phaseId, clientActionId: newClientActionId(), targetId, lock });
  mod = (command: ModeratorCommand) => this.emit('mod:command', { clientActionId: newClientActionId(), command });
}

export function errorText(error: ServerError): string {
  return error.message || ERROR_MESSAGES[error.code] || 'Đã có lỗi xảy ra.';
}
