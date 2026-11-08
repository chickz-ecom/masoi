import { MAX_PLAYERS, MIN_PLAYERS } from './config';
import { ROLES, isWolfRole } from './roles';
import { ROLE_IDS, type Deck, type RoleId, type RuleConfig } from './types';

export interface DeckIssue {
  code:
    | 'PLAYER_COUNT'
    | 'DECK_SIZE_MISMATCH'
    | 'NO_WOLVES'
    | 'TOO_MANY_WOLVES'
    | 'ROLE_LIMIT'
    | 'ADVANCED_DISABLED'
    | 'UNKNOWN_ROLE'
    | 'NEGATIVE_COUNT';
  message: string;
}

export function deckSize(deck: Deck): number {
  return Object.values(deck).reduce((sum, n) => sum + (n ?? 0), 0);
}

export function deckToList(deck: Deck): RoleId[] {
  const out: RoleId[] = [];
  for (const id of ROLE_IDS) {
    const n = deck[id] ?? 0;
    for (let i = 0; i < n; i++) out.push(id);
  }
  return out;
}

export function deckWolfCount(deck: Deck): number {
  return ROLE_IDS.filter(isWolfRole).reduce((sum, id) => sum + (deck[id] ?? 0), 0);
}

export function validateDeck(
  deck: Deck,
  playerCount: number,
  rules: Pick<RuleConfig, 'enableAdvancedRoles'>,
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    issues.push({
      code: 'PLAYER_COUNT',
      message: `Cần từ ${MIN_PLAYERS} đến ${MAX_PLAYERS} người chơi (hiện có ${playerCount}).`,
    });
  }
  for (const key of Object.keys(deck)) {
    if (!(ROLE_IDS as readonly string[]).includes(key)) {
      issues.push({ code: 'UNKNOWN_ROLE', message: `Vai không hợp lệ: ${key}` });
    }
  }
  for (const id of ROLE_IDS) {
    const n = deck[id] ?? 0;
    const def = ROLES[id];
    if (!Number.isInteger(n) || n < 0) {
      issues.push({ code: 'NEGATIVE_COUNT', message: `Số lượng ${def.name} không hợp lệ.` });
      continue;
    }
    if (def.maxCount !== null && n > def.maxCount) {
      issues.push({ code: 'ROLE_LIMIT', message: `${def.name} chỉ được tối đa ${def.maxCount} lá.` });
    }
    if (n > 0 && def.advanced && !rules.enableAdvancedRoles) {
      issues.push({
        code: 'ADVANCED_DISABLED',
        message: `${def.name} là vai nâng cao — cần bật "Vai nâng cao" trong luật chơi.`,
      });
    }
  }
  const size = deckSize(deck);
  if (size !== playerCount) {
    issues.push({
      code: 'DECK_SIZE_MISMATCH',
      message: `Tổng số vai (${size}) phải bằng số người chơi (${playerCount}).`,
    });
  }
  const wolves = deckWolfCount(deck);
  if (wolves === 0) issues.push({ code: 'NO_WOLVES', message: 'Cần ít nhất 1 Sói.' });
  if (wolves > 0 && wolves >= size - wolves) {
    issues.push({ code: 'TOO_MANY_WOLVES', message: 'Số Sói phải ít hơn số người không phải Sói.' });
  }
  return issues;
}

/** A balanced default deck for N players using only basic roles. */
export function suggestDeck(playerCount: number): Deck {
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, playerCount));
  const wolves = Math.max(1, Math.round(n / 4));
  const deck: Deck = { werewolf: wolves, seer: 1 };
  if (n >= 5) deck.guardian = 1;
  if (n >= 6) deck.witch = 1;
  if (n >= 8) deck.hunter = 1;
  const used = deckSize(deck);
  deck.villager = n - used;
  return deck;
}
