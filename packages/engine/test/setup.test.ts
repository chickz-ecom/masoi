import { describe, expect, it } from 'vitest';
import { createGame, defaultConfig, deckToList, seededRng, suggestDeck, validateDeck } from '../src';
import { Harness } from './helpers';

describe('deck validation', () => {
  it('accepts a balanced basic deck', () => {
    expect(validateDeck({ werewolf: 2, seer: 1, guardian: 1, witch: 1, villager: 3 }, 8, {
      enableAdvancedRoles: false,
    })).toEqual([]);
  });

  it('rejects size mismatch, no wolves, too many wolves and unique-role overflow', () => {
    const codes = (deck: Parameters<typeof validateDeck>[0], n: number) =>
      validateDeck(deck, n, { enableAdvancedRoles: false }).map((i) => i.code);
    expect(codes({ werewolf: 1, villager: 2 }, 4)).toContain('DECK_SIZE_MISMATCH');
    expect(codes({ villager: 4 }, 4)).toContain('NO_WOLVES');
    expect(codes({ werewolf: 2, villager: 2 }, 4)).toContain('TOO_MANY_WOLVES');
    expect(codes({ werewolf: 1, seer: 2, villager: 1 }, 4)).toContain('ROLE_LIMIT');
    expect(codes({ werewolf: 1, villager: 2 }, 3)).toContain('PLAYER_COUNT');
  });

  it('gates advanced roles behind enableAdvancedRoles', () => {
    const deck = { werewolf: 1, cupid: 1, villager: 2 };
    expect(validateDeck(deck, 4, { enableAdvancedRoles: false }).map((i) => i.code)).toContain('ADVANCED_DISABLED');
    expect(validateDeck(deck, 4, { enableAdvancedRoles: true })).toEqual([]);
  });

  it('suggests a valid deck for every supported size', () => {
    for (let n = 4; n <= 20; n++) {
      expect(validateDeck(suggestDeck(n), n, { enableAdvancedRoles: false })).toEqual([]);
    }
  });
});

describe('role assignment', () => {
  const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, seat: i + 1 }));
  const deck = { werewolf: 2, seer: 1, guardian: 1, witch: 1, villager: 3 };

  it('assigns exactly the deck', () => {
    const { state } = createGame({ gameId: 'g', mode: 'AUTO', config: defaultConfig(deck), players, now: 0, rng: seededRng(1) });
    const assigned = state.players.map((p) => p.role).sort();
    expect(assigned).toEqual(deckToList(deck).sort());
  });

  it('is random across seeds', () => {
    const layouts = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const { state } = createGame({ gameId: 'g', mode: 'AUTO', config: defaultConfig(deck), players, now: 0, rng: seededRng(seed) });
      layouts.add(state.players.map((p) => p.role).join(','));
    }
    expect(layouts.size).toBeGreaterThan(10);
  });

  it('sends each player only their own role (and wolves their teammates)', () => {
    const { state, events } = createGame({ gameId: 'g', mode: 'AUTO', config: defaultConfig(deck), players, now: 0, rng: seededRng(3) });
    const assigned = events.filter((e) => e.type === 'ROLE_ASSIGNED');
    expect(assigned).toHaveLength(8);
    for (const e of assigned) {
      expect(e.visibility.scope).toBe('players');
      if (e.visibility.scope !== 'players') continue;
      expect(e.visibility.playerIds).toHaveLength(1);
      const pid = e.visibility.playerIds[0];
      const p = state.players.find((pl) => pl.id === pid);
      expect(e.payload.role).toBe(p?.role);
      const teammates = e.payload.teammates as string[];
      if (p?.role === 'werewolf') expect(teammates).toHaveLength(1);
      else expect(teammates).toHaveLength(0);
    }
    // No public event maps a player to a role (the deck itself is public by design).
    for (const e of events.filter((ev) => ev.visibility.scope === 'public')) {
      expect(JSON.stringify(e.payload)).not.toMatch(/"role"/);
    }
  });

  it('rejects an invalid setup', () => {
    expect(() =>
      createGame({ gameId: 'g', mode: 'AUTO', config: defaultConfig({ villager: 4 }), players: players.slice(0, 4), now: 0, rng: seededRng(1) }),
    ).toThrow();
  });
});

describe('projection / secrecy', () => {
  it('players only see own role, wolves see teammates, moderator sees all', () => {
    const h = new Harness(['werewolf', 'werewolf', 'seer', 'villager', 'villager', 'guardian']);
    const villagerView = h.view({ kind: 'player', playerId: 'p4' });
    expect(villagerView.players.filter((p) => p.role !== null).map((p) => p.id)).toEqual(['p4']);
    expect(villagerView.moderator).toBeNull();

    const wolfView = h.view({ kind: 'player', playerId: 'p1' });
    expect(wolfView.players.filter((p) => p.role !== null).map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    expect(wolfView.me?.teammates).toEqual(['p2']);

    const spectator = h.view({ kind: 'spectator' });
    expect(spectator.players.every((p) => p.role === null)).toBe(true);
    expect(spectator.me).toBeNull();

    const mod = h.view({ kind: 'moderator' });
    expect(mod.players.every((p) => p.role !== null)).toBe(true);
  });

  it('never exposes secret timeline entries to players before game over', () => {
    const h = new Harness(['werewolf', 'seer', 'villager', 'villager', 'guardian']);
    h.ackAll();
    h.untilStep('GUARD');
    h.night('p5', { kind: 'GUARD_PROTECT', targetId: 'p3' });
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p3' });
    h.night('p2', { kind: 'SEER_CHECK', targetId: 'p1' });
    const v = h.view({ kind: 'player', playerId: 'p3' });
    expect(v.timeline.some((e) => e.secret)).toBe(false);
    expect(JSON.stringify(v)).not.toContain('GUARD_PROTECTED');
  });
});
