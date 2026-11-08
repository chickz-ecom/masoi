import type { SessionResponse } from '@masoi/shared';

/**
 * Guest sessions are stored per room code in localStorage so a refresh or reconnect
 * returns to the same character. The token is the only credential; nicknames are display-only.
 */
const KEY = 'masoi.sessions.v1';

export interface StoredSession extends SessionResponse {
  nickname: string;
  savedAt: number;
}

function readAll(): Record<string, StoredSession> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, StoredSession>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoredSession>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: session lives only in memory for this tab */
  }
}

export function getSession(code: string): StoredSession | null {
  return readAll()[code.toUpperCase()] ?? null;
}

export function saveSession(s: SessionResponse, nickname: string) {
  const all = readAll();
  all[s.roomCode.toUpperCase()] = { ...s, nickname, savedAt: Date.now() };
  // keep the 10 most recent rooms
  const entries = Object.entries(all).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 10);
  writeAll(Object.fromEntries(entries));
}

export function clearSession(code: string) {
  const all = readAll();
  delete all[code.toUpperCase()];
  writeAll(all);
}

export function recentSessions(): StoredSession[] {
  return Object.values(readAll()).sort((a, b) => b.savedAt - a.savedAt);
}
