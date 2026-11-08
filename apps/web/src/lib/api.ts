import type { CreateRoomRequest, JoinRoomRequest, RoomPublicInfo, ServerError, SessionResponse } from '@masoi/shared';
import { ERROR_MESSAGES } from '@masoi/shared';

/** Empty in production (same origin through Nginx). */
export const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly code: ServerError['code'],
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GAME_SERVER_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('INTERNAL', 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
  }
  const body = (await res.json().catch(() => ({}))) as Partial<ServerError> & T;
  if (!res.ok) {
    const code = (body.code ?? 'INTERNAL') as ServerError['code'];
    throw new ApiError(code, body.message ?? ERROR_MESSAGES[code] ?? 'Đã có lỗi xảy ra.');
  }
  return body as T;
}

export const api = {
  createRoom: (req: CreateRoomRequest) => request<SessionResponse>('/api/rooms', { method: 'POST', body: JSON.stringify(req) }),
  roomInfo: (code: string) => request<RoomPublicInfo>(`/api/rooms/${encodeURIComponent(code)}`),
  joinRoom: (code: string, req: JoinRoomRequest) =>
    request<SessionResponse>(`/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: JSON.stringify(req) }),
  history: (token: string) =>
    request<HistoryEntry[]>('/api/me/history', { headers: { authorization: `Bearer ${token}` } }),
};

export interface HistoryEntry {
  gameId: string;
  number: number;
  status: string;
  winner: string | null;
  nights: number;
  days: number;
  endedAt: string | null;
}
