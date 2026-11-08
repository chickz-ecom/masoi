import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  deckSize,
  normalizeRules,
  normalizeTimers,
  suggestDeck,
  validateDeck,
  type Deck,
  type GameConfig,
  type RuleConfig,
  type TimerConfig,
} from '@masoi/engine';
import {
  defaultRoomSettings,
  type CreateRoomRequestSchema,
  type JoinRoomRequestSchema,
  type MemberKind,
  type RoomEventType,
  type RoomPublicInfo,
  type RoomSettings,
  type RoomSettingsPatch,
  type RoomView,
  type SessionResponse,
} from '@masoi/shared';
import type { Prisma, PrismaClient, Player, Room, RoomSettings as RoomSettingsRow } from '@prisma/client';
import type { z } from 'zod';
import type { GameService } from '../game/gameService';
import type { RedisLock } from '../game/lock';
import { AppError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import { hashToken, newRoomCode, newSessionToken } from '../security/tokens';

export interface MemberContext {
  memberId: string;
  roomId: string;
  roomCode: string;
  kind: MemberKind;
  sessionId: string;
}

/** Implemented by the realtime layer. */
export interface RoomBroadcaster {
  roomEvent(roomId: string, type: RoomEventType, payload: Record<string, unknown>): void;
  syncRoom(roomId: string): Promise<void>;
  revokeMember(memberId: string, reason: string): Promise<void>;
  connectedMemberIds(roomId: string): Promise<Set<string>>;
}

type RoomWithAll = Room & { settings: RoomSettingsRow | null; players: Player[] };

const json = (v: unknown) => v as Prisma.InputJsonValue;
const isActive = (p: Player) => !p.leftAt && !p.kickedAt;

export class RoomService {
  private broadcaster: RoomBroadcaster | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly lock: RedisLock,
    private readonly games: GameService,
    private readonly logger: Logger,
    private readonly sessionTtlDays: number,
  ) {}

  setBroadcaster(b: RoomBroadcaster): void {
    this.broadcaster = b;
  }

  private get bc(): RoomBroadcaster {
    if (!this.broadcaster) throw new Error('RoomBroadcaster not set');
    return this.broadcaster;
  }

  // -------------------------------------------------------------------------
  // Settings helpers
  // -------------------------------------------------------------------------

  static settingsFromRow(row: RoomSettingsRow): RoomSettings {
    return {
      name: row.name,
      maxPlayers: row.maxPlayers,
      deck: (row.deck ?? {}) as Deck,
      rules: normalizeRules((row.rules ?? {}) as Partial<RuleConfig>),
      timers: normalizeTimers((row.timers ?? {}) as Partial<TimerConfig>),
      allowSpectators: row.allowSpectators,
      allowRejoin: row.allowRejoin,
    };
  }

  /** Empty deck = automatic suggestion for the current number of players. */
  static effectiveDeck(settings: RoomSettings, playerCount: number): Deck {
    return deckSize(settings.deck) === 0 ? suggestDeck(playerCount) : settings.deck;
  }

  private async loadRoom(roomId: string): Promise<RoomWithAll> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { settings: true, players: { orderBy: { joinedAt: 'asc' } } },
    });
    if (!room || !room.settings) throw new AppError('ROOM_NOT_FOUND');
    return room;
  }

  private async findByCode(code: string): Promise<RoomWithAll> {
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: { settings: true, players: { orderBy: { joinedAt: 'asc' } } },
    });
    if (!room || !room.settings) throw new AppError('ROOM_NOT_FOUND');
    return room;
  }

  private async createSession(tx: Prisma.TransactionClient, playerId: string): Promise<string> {
    const token = newSessionToken();
    await tx.playerSession.create({
      data: {
        playerId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.sessionTtlDays * 86_400_000),
      },
    });
    return token;
  }

  // -------------------------------------------------------------------------
  // REST operations
  // -------------------------------------------------------------------------

  async createRoom(req: z.output<typeof CreateRoomRequestSchema>): Promise<SessionResponse> {
    const settings = defaultRoomSettings(req.name, req.maxPlayers);
    const patched = req.settings ? applyPatch(settings, req.settings) : settings;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      try {
        return await this.prisma.$transaction(async (tx) => {
          const room = await tx.room.create({ data: { code, mode: req.mode } });
          await tx.roomSettings.create({ data: settingsToRow(room.id, patched) });
          const host = await tx.player.create({
            data: {
              roomId: room.id,
              nickname: req.nickname,
              nicknameKey: req.nickname.toLowerCase(),
              kind: req.mode === 'HUMAN' ? 'MODERATOR' : 'PLAYER',
              ready: true,
            },
          });
          await tx.room.update({ where: { id: room.id }, data: { hostPlayerId: host.id } });
          const token = await this.createSession(tx, host.id);
          this.logger.info({ roomId: room.id, code, mode: req.mode }, 'room created');
          return { token, memberId: host.id, roomCode: code };
        });
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') continue; // code collision → retry
        throw err;
      }
    }
    throw new AppError('INTERNAL', 'Không thể tạo mã phòng, hãy thử lại.');
  }

  async getPublicInfo(code: string): Promise<RoomPublicInfo> {
    const room = await this.findByCode(code);
    const settings = RoomService.settingsFromRow(room.settings as RoomSettingsRow);
    return {
      code: room.code,
      name: settings.name,
      mode: room.mode,
      status: room.status,
      playerCount: room.players.filter((p) => isActive(p) && p.kind === 'PLAYER').length,
      maxPlayers: settings.maxPlayers,
      allowSpectators: settings.allowSpectators,
    };
  }

  async joinRoom(code: string, req: z.output<typeof JoinRoomRequestSchema>): Promise<SessionResponse> {
    const roomRef = await this.findByCode(code);
    const result = await this.lock.withLock(`room:${roomRef.id}`, async () => {
      const room = await this.loadRoom(roomRef.id);
      const settings = RoomService.settingsFromRow(room.settings as RoomSettingsRow);
      if (room.status === 'CLOSED') throw new AppError('ROOM_CLOSED');
      const active = room.players.filter(isActive);
      const key = req.nickname.toLowerCase();
      if (active.some((p) => p.nicknameKey === key)) throw new AppError('NICKNAME_TAKEN');
      if (req.asSpectator) {
        if (!settings.allowSpectators) throw new AppError('SPECTATORS_DISABLED');
      } else {
        if (room.status !== 'LOBBY') throw new AppError('GAME_IN_PROGRESS', 'Trận đấu đang diễn ra — bạn chỉ có thể vào xem (nếu phòng cho phép).');
        const players = active.filter((p) => p.kind === 'PLAYER').length;
        if (players >= settings.maxPlayers) throw new AppError('ROOM_FULL');
      }
      return this.prisma.$transaction(async (tx) => {
        const member = await tx.player.create({
          data: {
            roomId: room.id,
            nickname: req.nickname,
            nicknameKey: key,
            kind: req.asSpectator ? 'SPECTATOR' : 'PLAYER',
          },
        });
        const token = await this.createSession(tx, member.id);
        return { token, memberId: member.id, roomCode: room.code, nickname: member.nickname, kind: member.kind };
      });
    });
    this.bc.roomEvent(roomRef.id, 'PLAYER_JOINED', { memberId: result.memberId, nickname: result.nickname, kind: result.kind });
    await this.bc.syncRoom(roomRef.id);
    return { token: result.token, memberId: result.memberId, roomCode: result.roomCode };
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  async authenticate(token: string): Promise<MemberContext> {
    if (!token || token.length < 20 || token.length > 200) throw new AppError('UNAUTHORIZED');
    const session = await this.prisma.playerSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { player: { include: { room: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) throw new AppError('UNAUTHORIZED');
    const member = session.player;
    if (member.kickedAt) throw new AppError('SESSION_REVOKED');
    if (member.room.status === 'CLOSED') throw new AppError('ROOM_CLOSED');
    await this.prisma.playerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { memberId: member.id, roomId: member.roomId, roomCode: member.room.code, kind: member.kind, sessionId: session.id };
  }

  /** Re-read the member's kind (it can change when the moderator role is transferred). */
  async refreshContext(ctx: MemberContext): Promise<MemberContext> {
    const m = await this.prisma.player.findUnique({ where: { id: ctx.memberId }, select: { kind: true, kickedAt: true } });
    if (!m || m.kickedAt) throw new AppError('SESSION_REVOKED');
    return { ...ctx, kind: m.kind };
  }

  /** Called when a socket connects: a member who had left (rejoin allowed) is back. */
  async markReturned(ctx: MemberContext): Promise<boolean> {
    const m = await this.prisma.player.findUnique({ where: { id: ctx.memberId } });
    if (m?.leftAt && !m.kickedAt) {
      await this.prisma.player.update({ where: { id: m.id }, data: { leftAt: null } });
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  async buildRoomView(roomId: string, memberId: string, connected?: Set<string>): Promise<RoomView> {
    const room = await this.loadRoom(roomId);
    const online = connected ?? (await this.bc.connectedMemberIds(roomId));
    return this.toView(room, memberId, online);
  }

  /** Base view for every member in a room (the realtime layer sets `you`). */
  async buildRoomViews(roomId: string, connected: Set<string>): Promise<Map<string, RoomView>> {
    const room = await this.loadRoom(roomId);
    const out = new Map<string, RoomView>();
    for (const p of room.players) out.set(p.id, this.toView(room, p.id, connected));
    return out;
  }

  private toView(room: RoomWithAll, memberId: string, online: Set<string>): RoomView {
    const settings = RoomService.settingsFromRow(room.settings as RoomSettingsRow);
    const active = room.players.filter(isActive);
    const players = active.filter((p) => p.kind === 'PLAYER');
    const deck = RoomService.effectiveDeck(settings, players.length);
    const deckIssues = validateDeck(deck, players.length, settings.rules);
    if (players.length > settings.maxPlayers) {
      deckIssues.push({ code: 'PLAYER_COUNT', message: `Vượt quá số người tối đa (${settings.maxPlayers}).` });
    }
    const me = room.players.find((p) => p.id === memberId);
    const isHost = room.hostPlayerId === memberId;
    const allReady = players.every((p) => p.ready || p.id === room.hostPlayerId);
    const seatOf = new Map(players.map((p, i) => [p.id, i + 1] as const));
    return {
      code: room.code,
      mode: room.mode,
      status: room.status,
      hostId: room.hostPlayerId,
      settings: { ...settings, deck: settings.deck },
      members: room.players
        .filter((p) => isActive(p) || room.status === 'IN_GAME')
        .filter((p) => !p.kickedAt)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          kind: p.kind,
          ready: p.ready,
          connected: online.has(p.id),
          isHost: room.hostPlayerId === p.id,
          seat: seatOf.get(p.id) ?? null,
          left: Boolean(p.leftAt),
        })),
      you: { id: memberId, kind: me?.kind ?? 'SPECTATOR', isHost },
      currentGameId: room.currentGameId,
      deckIssues,
      canStart: room.status === 'LOBBY' && isHost && deckIssues.length === 0 && allReady,
    };
  }

  // -------------------------------------------------------------------------
  // Lobby commands
  // -------------------------------------------------------------------------

  private async withRoom<T>(ctx: MemberContext, fn: (room: RoomWithAll, settings: RoomSettings) => Promise<T>): Promise<T> {
    return this.lock.withLock(`room:${ctx.roomId}`, async () => {
      const room = await this.loadRoom(ctx.roomId);
      const me = room.players.find((p) => p.id === ctx.memberId);
      if (!me || me.kickedAt) throw new AppError('SESSION_REVOKED');
      return fn(room, RoomService.settingsFromRow(room.settings as RoomSettingsRow));
    });
  }

  private requireHost(room: RoomWithAll, ctx: MemberContext): void {
    if (room.hostPlayerId !== ctx.memberId) throw new AppError('NOT_HOST');
  }

  private requireLobby(room: RoomWithAll): void {
    if (room.status !== 'LOBBY') throw new AppError('GAME_IN_PROGRESS');
  }

  async setReady(ctx: MemberContext, ready: boolean): Promise<void> {
    await this.withRoom(ctx, async (room) => {
      this.requireLobby(room);
      if (ctx.kind !== 'PLAYER') throw new AppError('NOT_ALLOWED', 'Chỉ người chơi mới cần sẵn sàng.');
      await this.prisma.player.update({ where: { id: ctx.memberId }, data: { ready } });
    });
    this.bc.roomEvent(ctx.roomId, 'PLAYER_READY', { memberId: ctx.memberId, ready });
    await this.bc.syncRoom(ctx.roomId);
  }

  async updateSettings(ctx: MemberContext, patch: RoomSettingsPatch): Promise<void> {
    await this.withRoom(ctx, async (room, settings) => {
      this.requireHost(room, ctx);
      this.requireLobby(room);
      const next = applyPatch(settings, patch);
      const players = room.players.filter((p) => isActive(p) && p.kind === 'PLAYER').length;
      if (next.maxPlayers < players) {
        throw new AppError('INVALID_PAYLOAD', `Số người tối đa không thể nhỏ hơn số người hiện có (${players}).`);
      }
      const { roomId: _r, ...data } = settingsToRow(room.id, next);
      await this.prisma.roomSettings.update({ where: { roomId: room.id }, data });
    });
    this.bc.roomEvent(ctx.roomId, 'SETTINGS_UPDATED', {});
    await this.bc.syncRoom(ctx.roomId);
  }

  async kick(ctx: MemberContext, targetId: string): Promise<void> {
    await this.withRoom(ctx, async (room) => {
      this.requireHost(room, ctx);
      this.requireLobby(room);
      if (targetId === ctx.memberId) throw new AppError('NOT_ALLOWED', 'Không thể tự kick chính mình.');
      const target = room.players.find((p) => p.id === targetId && isActive(p));
      if (!target) throw new AppError('INVALID_TARGET', 'Người chơi không tồn tại.');
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.player.update({ where: { id: targetId }, data: { kickedAt: now, leftAt: now, ready: false } }),
        this.prisma.playerSession.updateMany({ where: { playerId: targetId, revokedAt: null }, data: { revokedAt: now } }),
      ]);
    });
    await this.bc.revokeMember(targetId, 'KICKED');
    this.bc.roomEvent(ctx.roomId, 'PLAYER_KICKED', { memberId: targetId });
    await this.bc.syncRoom(ctx.roomId);
  }

  async transferHost(ctx: MemberContext, targetId: string): Promise<void> {
    await this.withRoom(ctx, async (room) => {
      this.requireHost(room, ctx);
      this.requireLobby(room);
      const target = room.players.find((p) => p.id === targetId && isActive(p) && p.kind === 'PLAYER');
      if (!target) throw new AppError('INVALID_TARGET', 'Chỉ chuyển quyền cho người chơi đang ở trong phòng.');
      await this.prisma.$transaction(async (tx) => {
        if (room.mode === 'HUMAN') {
          // In moderator mode the host IS the moderator: swap roles.
          await tx.player.update({ where: { id: ctx.memberId }, data: { kind: 'PLAYER', ready: false } });
          await tx.player.update({ where: { id: targetId }, data: { kind: 'MODERATOR', ready: true } });
        }
        await tx.room.update({ where: { id: room.id }, data: { hostPlayerId: targetId } });
      });
    });
    this.bc.roomEvent(ctx.roomId, 'HOST_CHANGED', { hostId: targetId });
    await this.bc.syncRoom(ctx.roomId);
  }

  /**
   * Leave the room explicitly.
   * - Lobby: the member is removed (session revoked); host passes to the earliest remaining player.
   * - In game: the character stays; with allowRejoin the session stays valid, otherwise it is revoked.
   */
  async leave(ctx: MemberContext): Promise<void> {
    let revoked = false;
    let newHost: string | null = null;
    await this.withRoom(ctx, async (room, settings) => {
      const now = new Date();
      const inGame = room.status === 'IN_GAME';
      const isModeratorInGame = inGame && ctx.kind === 'MODERATOR';
      revoked = !inGame || (!settings.allowRejoin && !isModeratorInGame);
      const ops: Prisma.PrismaPromise<unknown>[] = [
        this.prisma.player.update({ where: { id: ctx.memberId }, data: { leftAt: now, ready: false } }),
      ];
      if (revoked) {
        ops.push(this.prisma.playerSession.updateMany({ where: { playerId: ctx.memberId, revokedAt: null }, data: { revokedAt: now } }));
      }
      if (room.hostPlayerId === ctx.memberId && !isModeratorInGame) {
        const candidate = room.players.find((p) => p.id !== ctx.memberId && isActive(p) && p.kind === 'PLAYER');
        newHost = candidate?.id ?? null;
        ops.push(this.prisma.room.update({ where: { id: room.id }, data: { hostPlayerId: newHost } }));
        if (candidate && room.mode === 'HUMAN' && !inGame) {
          ops.push(this.prisma.player.update({ where: { id: candidate.id }, data: { kind: 'MODERATOR', ready: true } }));
        }
      }
      const remaining = room.players.filter((p) => p.id !== ctx.memberId && isActive(p));
      if (remaining.length === 0 && !inGame) {
        ops.push(this.prisma.room.update({ where: { id: room.id }, data: { status: 'CLOSED', closedAt: now } }));
      }
      await this.prisma.$transaction(ops);
    });
    if (revoked) await this.bc.revokeMember(ctx.memberId, 'LEFT');
    this.bc.roomEvent(ctx.roomId, 'PLAYER_LEFT', { memberId: ctx.memberId });
    if (newHost) this.bc.roomEvent(ctx.roomId, 'HOST_CHANGED', { hostId: newHost });
    await this.bc.syncRoom(ctx.roomId);
  }

  async start(ctx: MemberContext): Promise<string> {
    const gameId = await this.withRoom(ctx, async (room, settings) => {
      this.requireHost(room, ctx);
      this.requireLobby(room);
      const players = room.players.filter((p) => isActive(p) && p.kind === 'PLAYER');
      if (players.length < MIN_PLAYERS || players.length > Math.min(MAX_PLAYERS, settings.maxPlayers)) {
        throw new AppError('INVALID_DECK', `Cần từ ${MIN_PLAYERS} đến ${settings.maxPlayers} người chơi.`);
      }
      const notReady = players.filter((p) => !p.ready && p.id !== room.hostPlayerId);
      if (notReady.length > 0) {
        throw new AppError('NOT_READY', `Chưa sẵn sàng: ${notReady.map((p) => p.nickname).join(', ')}`);
      }
      if (room.mode === 'HUMAN' && !room.players.some((p) => isActive(p) && p.kind === 'MODERATOR')) {
        throw new AppError('NOT_ALLOWED', 'Phòng cần có quản trò.');
      }
      const deck = RoomService.effectiveDeck(settings, players.length);
      const issues = validateDeck(deck, players.length, settings.rules);
      if (issues.length > 0) throw new AppError('INVALID_DECK', issues.map((i) => i.message).join(' '), issues);
      const config: GameConfig = { rules: settings.rules, timers: settings.timers, deck };
      return this.games.startGame({
        roomId: room.id,
        mode: room.mode,
        config,
        players: players.map((p, i) => ({ id: p.id, name: p.nickname, seat: i + 1 })),
      });
    });
    await this.bc.syncRoom(ctx.roomId);
    return gameId;
  }

  async playAgain(ctx: MemberContext): Promise<void> {
    await this.withRoom(ctx, async (room) => {
      this.requireHost(room, ctx);
      if (room.status !== 'IN_GAME' || !room.currentGameId) throw new AppError('NO_ACTIVE_GAME');
      const game = await this.prisma.game.findUnique({ where: { id: room.currentGameId }, select: { status: true } });
      if (game?.status === 'RUNNING') throw new AppError('GAME_IN_PROGRESS', 'Trận đấu chưa kết thúc.');
      await this.prisma.$transaction([
        this.prisma.room.update({ where: { id: room.id }, data: { status: 'LOBBY' } }),
        this.prisma.player.updateMany({
          where: { roomId: room.id, kind: 'PLAYER', id: { not: room.hostPlayerId ?? '' } },
          data: { ready: false },
        }),
      ]);
    });
    this.bc.roomEvent(ctx.roomId, 'RETURNED_TO_LOBBY', {});
    await this.bc.syncRoom(ctx.roomId);
  }

  async currentGame(roomId: string): Promise<{ gameId: string; status: string; mode: string } | null> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { currentGameId: true, status: true } });
    if (!room?.currentGameId || room.status !== 'IN_GAME') return null;
    const g = await this.prisma.game.findUnique({ where: { id: room.currentGameId }, select: { id: true, status: true, mode: true } });
    return g ? { gameId: g.id, status: g.status, mode: g.mode } : null;
  }

  async moderatorIds(roomId: string): Promise<string[]> {
    const mods = await this.prisma.player.findMany({ where: { roomId, kind: 'MODERATOR', kickedAt: null }, select: { id: true } });
    return mods.map((m) => m.id);
  }
}

export function applyPatch(settings: RoomSettings, patch: RoomSettingsPatch): RoomSettings {
  return {
    name: patch.name ?? settings.name,
    maxPlayers: patch.maxPlayers ?? settings.maxPlayers,
    deck: patch.deck ? Object.fromEntries(Object.entries(patch.deck).filter(([, n]) => (n ?? 0) > 0)) : settings.deck,
    rules: normalizeRules({ ...settings.rules, ...(patch.rules ?? {}) }),
    timers: normalizeTimers({ ...settings.timers, ...(patch.timers ?? {}) }),
    allowSpectators: patch.allowSpectators ?? settings.allowSpectators,
    allowRejoin: patch.allowRejoin ?? settings.allowRejoin,
  };
}

function settingsToRow(roomId: string, s: RoomSettings) {
  return {
    roomId,
    name: s.name,
    maxPlayers: s.maxPlayers,
    deck: json(s.deck),
    rules: json(s.rules),
    timers: json(s.timers),
    allowSpectators: s.allowSpectators,
    allowRejoin: s.allowRejoin,
  };
}
