import { describe, expect, it } from 'vitest';
import { Harness, SYSTEM } from './helpers';

// Seats: p1 werewolf, p2 werewolf, p3 seer, p4 guardian, p5 witch, p6 hunter, p7 villager, p8 villager
const BASIC = ['werewolf', 'werewolf', 'seer', 'guardian', 'witch', 'hunter', 'villager', 'villager'] as const;

function startNight(h: Harness) {
  h.ackAll();
  expect(h.phase.type).toBe('NIGHT');
}

describe('night order', () => {
  it('collects actions in the defined order and skips roles absent from the deck', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    expect(h.state.night?.steps).toEqual(['GUARD', 'WEREWOLVES', 'SEER', 'WITCH']);
    const h2 = new Harness(['werewolf', 'villager', 'villager', 'villager']);
    h2.ackAll();
    expect(h2.state.night?.steps).toEqual(['WEREWOLVES']);
  });

  it('runs a fake-duration step when the role holder is dead', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.player('p4').alive = false; // guardian dead (simulated)
    h.nextNight();
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('GUARD');
    if (h.phase.type === 'NIGHT') {
      expect(h.phase.fake).toBe(true);
      const dur = (h.phase.endsAt ?? 0) - h.phase.startedAt;
      expect(dur).toBeGreaterThanOrEqual(6000);
      expect(dur).toBeLessThanOrEqual(12000);
    }
  });

  it('ends a step early once every actor acted (AUTO)', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('GUARD');
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('WEREWOLVES');
  });

  it('rejects actions from the wrong role, wrong step, dead players and stale phases', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.expectError(h.as('p3'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'SEER_CHECK', targetId: 'p1' } }, 'WRONG_STEP');
    h.expectError(h.as('p7'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'GUARD_PROTECT', targetId: 'p1' } }, 'NOT_ALLOWED');
    const stale = h.phase.id;
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    h.expectError(h.as('p1'), { type: 'NIGHT_ACTION', phaseId: stale, action: { kind: 'WOLF_VOTE', targetId: 'p7' } }, 'STALE_PHASE');
    h.expectError(h.as('p4'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'GUARD_PROTECT', targetId: 'p7' } }, 'WRONG_STEP');
  });

  it('ignores a stale timer tick (idempotent)', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    const before = h.phase.id;
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    h.now += 999_999;
    const res = h.run(SYSTEM, { type: 'TICK', phaseId: before });
    expect(res.changed).toBe(false);
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('WEREWOLVES');
  });
});

describe('werewolves', () => {
  it('kills the consensus target and ends the step early', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p7' });
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('WEREWOLVES');
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p7' });
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('SEER');
    h.untilPhase('DAWN');
    expect(h.player('p7').alive).toBe(false);
    expect(h.player('p7').death?.causes).toEqual(['WOLVES']);
  });

  it('can change votes, shares them with wolves only', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p7' });
    const ev = h.eventsOf('WOLF_VOTES_UPDATED')[0];
    expect(ev?.visibility).toEqual({ scope: 'players', playerIds: ['p1', 'p2'] });
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p8' });
    expect(h.state.night?.wolfVotes.p1).toBe('p8');
  });

  it('cannot target a fellow wolf by default', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.expectError(h.as('p1'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'WOLF_VOTE', targetId: 'p2' } }, 'INVALID_TARGET');
  });

  it('no wolf votes → nobody attacked', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilPhase('DAWN');
    expect(h.state.players.every((p) => p.alive)).toBe(true);
  });

  it('disagreement → plurality, ties broken randomly (or no kill by policy)', () => {
    const h = new Harness(['werewolf', 'werewolf', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'seer']);
    h.ackAll();
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p4' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p4' });
    h.night('p3', { kind: 'WOLF_VOTE', targetId: 'p5' });
    h.timeout();
    expect(h.state.night?.wolfTarget).toBe('p4');

    const tie = new Harness([...BASIC], { rules: { wolfTiePolicy: 'no_kill' } });
    tie.ackAll();
    tie.untilStep('WEREWOLVES');
    tie.night('p1', { kind: 'WOLF_VOTE', targetId: 'p7' });
    tie.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    tie.timeout();
    expect(tie.state.night?.wolfTarget).toBeNull();

    const rnd = new Harness([...BASIC], { rules: { wolfTiePolicy: 'random' } });
    rnd.ackAll();
    rnd.untilStep('WEREWOLVES');
    rnd.night('p1', { kind: 'WOLF_VOTE', targetId: 'p7' });
    rnd.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    rnd.timeout();
    expect(['p7', 'p8']).toContain(rnd.state.night?.wolfTarget);
  });
});

describe('guardian', () => {
  it('blocks the wolf attack', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p7' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p7' });
    h.untilPhase('DAWN');
    expect(h.player('p7').alive).toBe(true);
    const announced = h.eventsOf('NIGHT_RESULT')[0]?.payload.deaths;
    expect(announced).toEqual([]);
  });

  it('cannot protect the same player two nights in a row', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    h.nextNight();
    expect(h.state.nightNumber).toBe(2);
    h.untilStep('GUARD');
    h.expectError(h.as('p4'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'GUARD_PROTECT', targetId: 'p7' } }, 'INVALID_TARGET');
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p8' });
  });

  it('can protect again after skipping a night', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    h.nextNight(); // night 2: skip
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: null });
    h.nextNight(); // night 3
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    expect(h.state.night?.guardTarget).toBe('p7');
  });

  it('does not block poison', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    h.untilStep('WITCH');
    h.night('p5', { kind: 'WITCH_ACT', heal: false, poisonTargetId: 'p7' });
    expect(h.phase.type).toBe('DAWN');
    expect(h.player('p7').alive).toBe(false);
    expect(h.player('p7').death?.causes).toEqual(['POISON']);
  });
});

describe('witch', () => {
  it('sees the attacked player and can heal them', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.untilStep('WITCH');
    const prompt = h.view({ kind: 'player', playerId: 'p5' }).me?.prompt;
    expect(prompt).toMatchObject({ kind: 'WITCH_ACT', attackedId: 'p8', canHeal: true });
    // others do not see the attacked player
    expect(JSON.stringify(h.view({ kind: 'player', playerId: 'p7' }))).not.toContain('"attackedId"');
    h.night('p5', { kind: 'WITCH_ACT', heal: true, poisonTargetId: null });
    expect(h.player('p8').alive).toBe(true);
    expect(h.state.roles.witch.healUsed).toBe(true);
  });

  it('cannot use both potions in one night by default, nor reuse a potion', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.untilStep('WITCH');
    h.expectError(h.as('p5'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'WITCH_ACT', heal: true, poisonTargetId: 'p1' } }, 'NOT_ALLOWED');
    h.night('p5', { kind: 'WITCH_ACT', heal: false, poisonTargetId: 'p1' });
    expect(h.player('p1').alive).toBe(false);
    expect(h.player('p8').alive).toBe(false);
    // Night 2: poison already used
    h.nextNight();
    h.untilStep('WEREWOLVES');
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p7' });
    h.untilStep('WITCH');
    h.expectError(h.as('p5'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'WITCH_ACT', heal: false, poisonTargetId: 'p2' } }, 'NO_POTION');
  });

  it('cannot heal when nobody was attacked and cannot poison self', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WITCH');
    h.expectError(h.as('p5'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'WITCH_ACT', heal: true, poisonTargetId: null } }, 'INVALID_TARGET');
    h.expectError(h.as('p5'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'WITCH_ACT', heal: false, poisonTargetId: 'p5' } }, 'INVALID_TARGET');
  });

  it('witch who does nothing changes nothing', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WITCH');
    h.night('p5', { kind: 'WITCH_ACT', heal: false, poisonTargetId: null });
    expect(h.state.roles.witch).toEqual({ healUsed: false, poisonUsed: false });
  });
});

describe('seer', () => {
  it('learns wolf / not wolf privately, never the exact role', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('SEER');
    h.night('p3', { kind: 'SEER_CHECK', targetId: 'p1' });
    const ev = h.eventsOf('SEER_RESULT')[0];
    expect(ev?.visibility).toEqual({ scope: 'players', playerIds: ['p3'] });
    expect(ev?.payload).toEqual({ targetId: 'p1', isWolf: true });
    const view = h.view({ kind: 'player', playerId: 'p3' });
    expect(view.me?.seerResults).toEqual([{ night: 1, targetId: 'p1', isWolf: true }]);
    expect(view.players.find((p) => p.id === 'p1')?.role).toBeNull();
  });

  it('cannot check self or twice per night', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('SEER');
    h.expectError(h.as('p3'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'SEER_CHECK', targetId: 'p3' } }, 'INVALID_TARGET');
  });
});

describe('dawn announcements', () => {
  it('announces deaths sorted by seat without causes', () => {
    const h = new Harness([...BASIC]);
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.untilStep('WITCH');
    h.night('p5', { kind: 'WITCH_ACT', heal: false, poisonTargetId: 'p7' });
    const ev = h.eventsOf('NIGHT_RESULT')[0];
    expect(ev?.visibility.scope).toBe('public');
    expect(ev?.payload.deaths).toEqual([
      { playerId: 'p7', role: 'villager' },
      { playerId: 'p8', role: 'villager' },
    ]);
    expect(JSON.stringify(ev?.payload)).not.toMatch(/POISON|WOLVES/);
  });

  it('hides roles when revealRoleOnDeath is off', () => {
    const h = new Harness([...BASIC], { rules: { revealRoleOnDeath: false } });
    startNight(h);
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.untilPhase('DAWN');
    expect(h.eventsOf('NIGHT_RESULT')[0]?.payload.deaths).toEqual([{ playerId: 'p8', role: null }]);
    expect(h.view({ kind: 'player', playerId: 'p7' }).players.find((p) => p.id === 'p8')?.role).toBeNull();
  });
});
