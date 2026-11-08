import { isWolf } from './internal';
import type { GameState, Winner } from './types';

/** Win check per RULES.md §6. Only call once pendingReactions is empty. */
export function checkWinner(state: GameState): Winner | null {
  const alive = state.players.filter((p) => p.alive);
  if (alive.length === 0) return 'DRAW';

  const lovers = state.roles.lovers;
  if (lovers && alive.length === 2) {
    const [a, b] = lovers;
    const pa = state.players.find((p) => p.id === a);
    const pb = state.players.find((p) => p.id === b);
    if (pa?.alive && pb?.alive && isWolf(pa) !== isWolf(pb)) return 'LOVERS';
  }

  if (alive.length === 1 && alive[0]?.role === 'white_wolf') return 'WHITE_WOLF';

  const wolves = alive.filter(isWolf).length;
  const others = alive.length - wolves;
  if (wolves === 0) return 'VILLAGE';
  if (wolves >= others) return 'WEREWOLF';
  return null;
}

export function winnerIds(state: GameState, winner: Winner | null): string[] {
  switch (winner) {
    case 'VILLAGE':
      return state.players.filter((p) => !isWolf(p)).map((p) => p.id);
    case 'WEREWOLF':
      return state.players.filter(isWolf).map((p) => p.id);
    case 'LOVERS':
      return state.roles.lovers ? [...state.roles.lovers] : [];
    case 'WHITE_WOLF':
      return state.players.filter((p) => p.role === 'white_wolf').map((p) => p.id);
    default:
      return [];
  }
}
