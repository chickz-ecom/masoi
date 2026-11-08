import { describe, expect, it } from 'vitest';
import {
  CreateRoomRequestSchema,
  ModeratorCommandPayloadSchema,
  NicknameSchema,
  NightActionPayloadSchema,
  RoomCodeSchema,
  RoomSettingsPatchSchema,
  VotePayloadSchema,
  sanitizeText,
} from '../src';

describe('sanitization', () => {
  it('strips control, zero-width, bidi and angle-bracket characters', () => {
    expect(sanitizeText('  Ti\u200bếp\u202e <b>  ')).toBe('Tiếp b');
    expect(NicknameSchema.parse('  Đỗ   Quang  ')).toBe('Đỗ Quang');
  });

  it('rejects too-short / too-long nicknames', () => {
    expect(NicknameSchema.safeParse('a').success).toBe(false);
    expect(NicknameSchema.safeParse('\u200b\u200b').success).toBe(false);
    expect(NicknameSchema.safeParse('x'.repeat(21)).success).toBe(false);
  });
});

describe('payload validation', () => {
  it('normalizes room codes', () => {
    expect(RoomCodeSchema.parse(' abcd23 ')).toBe('ABCD23');
    expect(RoomCodeSchema.safeParse('ABCD10').success).toBe(false); // 1 and 0 are excluded
  });

  it('validates create-room requests with defaults', () => {
    const r = CreateRoomRequestSchema.parse({ nickname: 'Tiếp', mode: 'AUTO', name: 'Làng' });
    expect(r.maxPlayers).toBe(12);
    expect(CreateRoomRequestSchema.safeParse({ nickname: 'Tiếp', mode: 'GOD', name: 'x' }).success).toBe(false);
    expect(CreateRoomRequestSchema.safeParse({ nickname: 'Tiếp', mode: 'AUTO', name: 'x', extra: 1 }).success).toBe(false);
  });

  it('validates night actions strictly', () => {
    const base = { phaseId: 3, clientActionId: 'abcdefgh12' };
    expect(NightActionPayloadSchema.safeParse({ ...base, action: { kind: 'SEER_CHECK', targetId: 'p1' } }).success).toBe(true);
    expect(NightActionPayloadSchema.safeParse({ ...base, action: { kind: 'SEER_CHECK', targetId: null } }).success).toBe(false);
    expect(NightActionPayloadSchema.safeParse({ ...base, action: { kind: 'KILL_ALL' } }).success).toBe(false);
    expect(NightActionPayloadSchema.safeParse({ ...base, action: { kind: 'WITCH_ACT', heal: true, poisonTargetId: 'x', hack: 1 } }).success).toBe(false);
  });

  it('validates votes and moderator commands', () => {
    expect(VotePayloadSchema.safeParse({ phaseId: 1, clientActionId: 'abcdefgh', targetId: null, lock: true }).success).toBe(true);
    expect(VotePayloadSchema.safeParse({ phaseId: 0, clientActionId: 'abcdefgh', targetId: null, lock: true }).success).toBe(false);
    expect(
      ModeratorCommandPayloadSchema.safeParse({ clientActionId: 'abcdefgh', command: { type: 'MOD_ADJUST_TIMER', deltaSeconds: 9999 } }).success,
    ).toBe(false);
    expect(
      ModeratorCommandPayloadSchema.safeParse({ clientActionId: 'abcdefgh', command: { type: 'MOD_CONFIRM', override: { deaths: ['p1'] } } }).success,
    ).toBe(true);
  });

  it('settings patch rejects out-of-range timers and unknown keys', () => {
    expect(RoomSettingsPatchSchema.safeParse({ timers: { discussion: 5 } }).success).toBe(false);
    expect(RoomSettingsPatchSchema.safeParse({ timers: { discussion: 120 } }).success).toBe(true);
    expect(RoomSettingsPatchSchema.safeParse({ isAdmin: true }).success).toBe(false);
  });
});
