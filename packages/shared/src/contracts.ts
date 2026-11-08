import type { DeckIssue, EngineErrorCode, EngineEventType, GameView } from '@masoi/engine';
import type { z } from 'zod';
import type {
  AckRolePayloadSchema,
  EmptyPayloadSchema,
  HunterShootPayloadSchema,
  ModeratorCommandPayloadSchema,
  NightActionPayloadSchema,
  PingPayloadSchema,
  ReadyPayloadSchema,
  RoomSettings,
  SkipDiscussionPayloadSchema,
  TargetMemberPayloadSchema,
  UpdateSettingsPayloadSchema,
  VotePayloadSchema,
} from './schemas';

// ---------------------------------------------------------------------------
// Errors & acknowledgements
// ---------------------------------------------------------------------------

export type ServerErrorCode =
  | EngineErrorCode
  | 'UNAUTHORIZED'
  | 'SESSION_REVOKED'
  | 'RATE_LIMITED'
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_CLOSED'
  | 'GAME_IN_PROGRESS'
  | 'NO_ACTIVE_GAME'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'INVALID_DECK'
  | 'NICKNAME_TAKEN'
  | 'SPECTATORS_DISABLED'
  | 'REJOIN_DISABLED'
  | 'CONFLICT'
  | 'INTERNAL';

export interface ServerError {
  code: ServerErrorCode;
  message: string;
  details?: unknown;
}

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: ServerError };
export type AckFn<T = undefined> = (res: Ack<T>) => void;

// ---------------------------------------------------------------------------
// Room (lobby) view
// ---------------------------------------------------------------------------

export type MemberKind = 'PLAYER' | 'MODERATOR' | 'SPECTATOR';
export type RoomStatus = 'LOBBY' | 'IN_GAME' | 'CLOSED';

export interface RoomMemberView {
  id: string;
  nickname: string;
  kind: MemberKind;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  seat: number | null;
  left: boolean;
}

export interface RoomView {
  code: string;
  mode: 'AUTO' | 'HUMAN';
  status: RoomStatus;
  hostId: string | null;
  settings: RoomSettings;
  members: RoomMemberView[];
  you: { id: string; kind: MemberKind; isHost: boolean };
  currentGameId: string | null;
  /** Server-side deck validation for the current player count (for the host UI). */
  deckIssues: DeckIssue[];
  canStart: boolean;
}

export interface GameSync {
  view: GameView;
  version: number;
  serverNow: number;
}

// ---------------------------------------------------------------------------
// Events (server → client)
// ---------------------------------------------------------------------------

export type RoomEventType =
  | 'ROOM_CREATED'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_RECONNECTED'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_READY'
  | 'PLAYER_KICKED'
  | 'HOST_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'RETURNED_TO_LOBBY';

export type ServerEventType = RoomEventType | EngineEventType;

export interface ServerEvent {
  /** Monotonic per game (engine events) or random (room events). */
  id: string;
  type: ServerEventType;
  at: number;
  payload: Record<string, unknown>;
}

export interface ServerToClientEvents {
  /** Full lobby/room state for this member (ROOM state sync). */
  'room:state': (room: RoomView) => void;
  /** GAME_STATE_SYNC: the projected game view for this member. */
  'game:sync': (sync: GameSync) => void;
  /** Named, recipient-filtered events (PLAYER_JOINED, PHASE_CHANGED, ROLE_ASSIGNED, …). */
  'event': (event: ServerEvent) => void;
  /** Session revoked (kicked / left with rejoin disabled). */
  'session:revoked': (payload: { reason: string }) => void;
}

type P<S extends z.ZodType> = z.input<S>;

export interface ClientToServerEvents {
  'room:sync': (payload: P<typeof EmptyPayloadSchema>, ack: AckFn<{ room: RoomView; game: GameSync | null }>) => void;
  'room:leave': (payload: P<typeof EmptyPayloadSchema>, ack: AckFn) => void;
  'lobby:ready': (payload: P<typeof ReadyPayloadSchema>, ack: AckFn) => void;
  'lobby:updateSettings': (payload: P<typeof UpdateSettingsPayloadSchema>, ack: AckFn) => void;
  'lobby:kick': (payload: P<typeof TargetMemberPayloadSchema>, ack: AckFn) => void;
  'lobby:transferHost': (payload: P<typeof TargetMemberPayloadSchema>, ack: AckFn) => void;
  'game:start': (payload: P<typeof EmptyPayloadSchema>, ack: AckFn<{ gameId: string }>) => void;
  'game:ackRole': (payload: P<typeof AckRolePayloadSchema>, ack: AckFn) => void;
  'game:nightAction': (payload: P<typeof NightActionPayloadSchema>, ack: AckFn) => void;
  'game:hunterShoot': (payload: P<typeof HunterShootPayloadSchema>, ack: AckFn) => void;
  'game:skipDiscussion': (payload: P<typeof SkipDiscussionPayloadSchema>, ack: AckFn) => void;
  'game:vote': (payload: P<typeof VotePayloadSchema>, ack: AckFn) => void;
  'game:playAgain': (payload: P<typeof EmptyPayloadSchema>, ack: AckFn) => void;
  'mod:command': (payload: P<typeof ModeratorCommandPayloadSchema>, ack: AckFn) => void;
  'time:ping': (payload: P<typeof PingPayloadSchema>, ack: AckFn<{ serverNow: number; clientTime: number }>) => void;
}

export interface SocketAuth {
  token: string;
}

/** Vietnamese messages for server errors (client fallback when message is missing). */
export const ERROR_MESSAGES: Partial<Record<ServerErrorCode, string>> = {
  UNAUTHORIZED: 'Phiên đăng nhập không hợp lệ. Hãy vào lại phòng.',
  SESSION_REVOKED: 'Phiên của bạn đã bị thu hồi.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh, hãy thử lại sau giây lát.',
  INVALID_PAYLOAD: 'Dữ liệu gửi lên không hợp lệ.',
  ROOM_NOT_FOUND: 'Không tìm thấy phòng.',
  ROOM_FULL: 'Phòng đã đầy.',
  ROOM_CLOSED: 'Phòng đã đóng.',
  GAME_IN_PROGRESS: 'Trận đấu đang diễn ra.',
  NO_ACTIVE_GAME: 'Không có trận đấu nào đang diễn ra.',
  NOT_HOST: 'Chỉ chủ phòng mới có quyền này.',
  NOT_READY: 'Chưa phải tất cả người chơi đều sẵn sàng.',
  INVALID_DECK: 'Bộ vai không hợp lệ.',
  NICKNAME_TAKEN: 'Nickname đã có người dùng trong phòng.',
  SPECTATORS_DISABLED: 'Phòng không cho phép người xem.',
  REJOIN_DISABLED: 'Phòng không cho phép vào lại.',
  CONFLICT: 'Có xung đột dữ liệu, hãy thử lại.',
  INTERNAL: 'Lỗi máy chủ, hãy thử lại.',
};
