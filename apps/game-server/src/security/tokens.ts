import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@masoi/shared';
import type { Rng } from '@masoi/engine';

/** 256-bit random session token (base64url). Only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Hard-to-guess room code from an unambiguous alphabet (no 0/O, 1/I/L). */
export function newRoomCode(): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) out += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return out;
}

/** Cryptographically secure RNG for role assignment & tie breaks. */
export const cryptoRng: Rng = {
  int(maxExclusive: number): number {
    if (maxExclusive <= 1) return 0;
    return randomInt(maxExclusive);
  },
};

export function newId(): string {
  return randomUUID().replace(/-/g, '');
}
