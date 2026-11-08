import {
  DEFAULT_RULES,
  DEFAULT_TIMERS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLE_IDS,
  TIMER_LIMITS,
  type RuleConfig,
  type TimerConfig,
} from '@masoi/engine';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Control chars, zero-width & bidi overrides are stripped; HTML is never interpreted (React escapes). */
// eslint-disable-next-line no-control-regex -- intentionally strips control, zero-width and bidi characters
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff<>]/g;

export function sanitizeText(input: string): string {
  return input.normalize('NFC').replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim();
}

export const NicknameSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().min(2, 'Nickname cần ít nhất 2 ký tự.').max(20, 'Nickname tối đa 20 ký tự.'));

export const RoomNameSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().min(1, 'Tên phòng không được trống.').max(40, 'Tên phòng tối đa 40 ký tự.'));

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`), 'Mã phòng không hợp lệ.');

export const IdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const ClientActionIdSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const PhaseIdSchema = z.number().int().positive();

export const ModeSchema = z.enum(['AUTO', 'HUMAN']);
export const RoleIdSchema = z.enum(ROLE_IDS);

export const DeckSchema = z.partialRecord(RoleIdSchema, z.number().int().min(0).max(MAX_PLAYERS));

const timerShape = Object.fromEntries(
  (Object.keys(DEFAULT_TIMERS) as (keyof TimerConfig)[]).map((k) => {
    const [min, max] = TIMER_LIMITS[k];
    return [k, z.number().int().min(min).max(max)];
  }),
) as Record<keyof TimerConfig, z.ZodNumber>;
export const TimerConfigSchema = z.object(timerShape);

export const RuleConfigSchema = z.object({
  wolvesKnowEachOther: z.boolean(),
  wolvesCanTargetWolves: z.boolean(),
  wolfTiePolicy: z.enum(['random', 'no_kill']),
  guardCanSelfProtect: z.boolean(),
  guardSameTargetConsecutive: z.boolean(),
  witchCanSelfHeal: z.boolean(),
  witchBothPotionsSameNight: z.boolean(),
  revealRoleOnDeath: z.boolean(),
  revealVotes: z.boolean(),
  allowSelfVote: z.boolean(),
  allowVoteChange: z.boolean(),
  runoffOnTie: z.boolean(),
  allowSkipDiscussion: z.boolean(),
  enableAdvancedRoles: z.boolean(),
  deadCanSpectate: z.boolean(),
  deadSeeAllRoles: z.boolean(),
  onAllDisconnected: z.enum(['pause', 'end']),
  abandonAfterMinutes: z.number().int().min(1).max(120),
}) satisfies z.ZodType<RuleConfig>;

export const RoomSettingsSchema = z.object({
  name: RoomNameSchema,
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
  deck: DeckSchema,
  rules: RuleConfigSchema,
  timers: TimerConfigSchema,
  allowSpectators: z.boolean(),
  allowRejoin: z.boolean(),
});
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

export const RoomSettingsPatchSchema = z
  .object({
    name: RoomNameSchema.optional(),
    maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).optional(),
    deck: DeckSchema.optional(),
    rules: RuleConfigSchema.partial().optional(),
    timers: TimerConfigSchema.partial().optional(),
    allowSpectators: z.boolean().optional(),
    allowRejoin: z.boolean().optional(),
  })
  .strict();
export type RoomSettingsPatch = z.infer<typeof RoomSettingsPatchSchema>;

export function defaultRoomSettings(name: string, maxPlayers = 12): RoomSettings {
  return {
    name,
    maxPlayers,
    deck: {},
    rules: { ...DEFAULT_RULES },
    timers: { ...DEFAULT_TIMERS },
    allowSpectators: false,
    allowRejoin: true,
  };
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

export const CreateRoomRequestSchema = z
  .object({
    nickname: NicknameSchema,
    mode: ModeSchema,
    name: RoomNameSchema,
    maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).default(12),
    settings: RoomSettingsPatchSchema.optional(),
  })
  .strict();
export type CreateRoomRequest = z.input<typeof CreateRoomRequestSchema>;

export const JoinRoomRequestSchema = z
  .object({
    nickname: NicknameSchema,
    asSpectator: z.boolean().default(false),
  })
  .strict();
export type JoinRoomRequest = z.input<typeof JoinRoomRequestSchema>;

export interface SessionResponse {
  token: string;
  memberId: string;
  roomCode: string;
}

export interface RoomPublicInfo {
  code: string;
  name: string;
  mode: 'AUTO' | 'HUMAN';
  status: 'LOBBY' | 'IN_GAME' | 'CLOSED';
  playerCount: number;
  maxPlayers: number;
  allowSpectators: boolean;
}

// ---------------------------------------------------------------------------
// Socket payloads (client → server)
// ---------------------------------------------------------------------------

export const ReadyPayloadSchema = z.object({ ready: z.boolean() }).strict();
export const UpdateSettingsPayloadSchema = z.object({ patch: RoomSettingsPatchSchema }).strict();
export const TargetMemberPayloadSchema = z.object({ memberId: IdSchema }).strict();
export const EmptyPayloadSchema = z.object({}).strict();

export const AckRolePayloadSchema = z.object({ phaseId: PhaseIdSchema }).strict();

export const NightActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CUPID_LINK'), targetIds: z.tuple([IdSchema, IdSchema]) }).strict(),
  z.object({ kind: z.literal('GUARD_PROTECT'), targetId: IdSchema.nullable() }).strict(),
  z.object({ kind: z.literal('WOLF_VOTE'), targetId: IdSchema.nullable() }).strict(),
  z.object({ kind: z.literal('WHITE_WOLF_KILL'), targetId: IdSchema.nullable() }).strict(),
  z.object({ kind: z.literal('SEER_CHECK'), targetId: IdSchema }).strict(),
  z.object({ kind: z.literal('WITCH_ACT'), heal: z.boolean(), poisonTargetId: IdSchema.nullable() }).strict(),
]);

export const NightActionPayloadSchema = z
  .object({ phaseId: PhaseIdSchema, clientActionId: ClientActionIdSchema, action: NightActionSchema })
  .strict();

export const HunterShootPayloadSchema = z
  .object({ phaseId: PhaseIdSchema, clientActionId: ClientActionIdSchema, targetId: IdSchema.nullable() })
  .strict();

export const SkipDiscussionPayloadSchema = z.object({ phaseId: PhaseIdSchema }).strict();

export const VotePayloadSchema = z
  .object({
    phaseId: PhaseIdSchema,
    clientActionId: ClientActionIdSchema,
    targetId: IdSchema.nullable(),
    lock: z.boolean(),
  })
  .strict();

export const WinnerSchema = z.enum(['VILLAGE', 'WEREWOLF', 'LOVERS', 'WHITE_WOLF', 'DRAW']);

export const ModeratorCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MOD_NEXT') }).strict(),
  z.object({ type: z.literal('MOD_PAUSE') }).strict(),
  z.object({ type: z.literal('MOD_RESUME') }).strict(),
  z.object({ type: z.literal('MOD_ADJUST_TIMER'), deltaSeconds: z.number().int().min(-600).max(600) }).strict(),
  z.object({ type: z.literal('MOD_LOCK') }).strict(),
  z.object({ type: z.literal('MOD_REOPEN'), seconds: z.number().int().min(5).max(600) }).strict(),
  z
    .object({
      type: z.literal('MOD_CONFIRM'),
      override: z
        .union([
          z.object({ deaths: z.array(IdSchema).max(20) }).strict(),
          z.object({ eliminatedId: IdSchema.nullable() }).strict(),
        ])
        .optional(),
      reason: z.string().max(200).transform(sanitizeText).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('MOD_END'),
      winner: WinnerSchema.nullable(),
      reason: z.string().max(200).transform(sanitizeText).optional(),
    })
    .strict(),
]);
export type ModeratorCommand = z.infer<typeof ModeratorCommandSchema>;

export const ModeratorCommandPayloadSchema = z
  .object({ clientActionId: ClientActionIdSchema, command: ModeratorCommandSchema })
  .strict();

export const PingPayloadSchema = z.object({ clientTime: z.number() }).strict();
