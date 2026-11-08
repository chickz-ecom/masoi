import { describe, expect, it } from 'vitest';
import { Harness, MOD, SYSTEM } from './helpers';

const BASIC = ['werewolf', 'werewolf', 'seer', 'guardian', 'witch', 'hunter', 'villager', 'villager'] as const;

describe('HUMAN mode transition policy', () => {
  it('timeouts only lock the phase; the moderator advances', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    expect(h.phase.type).toBe('ROLE_REVEAL');
    h.timeout();
    expect(h.phase.type).toBe('ROLE_REVEAL');
    expect(h.phase.locked).toBe(true);
    expect(h.eventsOf('TIMER_EXPIRED')[0]?.visibility).toEqual({ scope: 'moderator' });
    h.run(MOD, { type: 'MOD_NEXT' });
    expect(h.phase.type).toBe('NIGHT');
  });

  it('all actors done does not auto-advance in HUMAN mode', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.run(MOD, { type: 'MOD_NEXT' });
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('GUARD');
    expect(h.eventsOf('AWAITING_MODERATOR')).toHaveLength(1);
  });

  it('night results wait for confirmation, and can be overridden (audited)', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.run(MOD, { type: 'MOD_NEXT' }); // → GUARD
    h.run(MOD, { type: 'MOD_NEXT' }); // → WEREWOLVES
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p7' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p7' });
    h.run(MOD, { type: 'MOD_NEXT' }); // → SEER
    h.run(MOD, { type: 'MOD_NEXT' }); // → WITCH
    h.run(MOD, { type: 'MOD_NEXT' }); // → DAWN (unconfirmed)
    expect(h.phase.type).toBe('DAWN');
    expect(h.player('p7').alive).toBe(true);
    const playerView = h.view({ kind: 'player', playerId: 'p3' });
    expect(playerView.phase.awaitingModerator).toBe(true);
    expect(JSON.stringify(playerView)).not.toContain('pendingOutcome');
    const modView = h.view({ kind: 'moderator' });
    expect(modView.moderator?.pendingOutcome).toMatchObject({ kind: 'NIGHT', deaths: [{ playerId: 'p7', causes: ['WOLVES'] }] });
    h.expectError(MOD, { type: 'MOD_NEXT' }, 'NEEDS_CONFIRMATION');
    h.expectError(MOD, { type: 'MOD_CONFIRM', override: { deaths: ['p7', 'p7'] } }, 'INVALID_OVERRIDE');
    h.expectError(MOD, { type: 'MOD_CONFIRM', override: { eliminatedId: 'p7' } }, 'INVALID_OVERRIDE');
    h.run(MOD, { type: 'MOD_CONFIRM', override: { deaths: ['p8'] } });
    expect(h.player('p7').alive).toBe(true);
    expect(h.player('p8').alive).toBe(false);
    expect(h.player('p8').death?.causes).toEqual(['MODERATOR']);
    expect(h.state.timeline.some((e) => e.kind === 'MODERATOR_OVERRIDE' && e.secret)).toBe(true);
    h.expectError(MOD, { type: 'MOD_CONFIRM' }, 'ALREADY_CONFIRMED');
    h.run(MOD, { type: 'MOD_NEXT' });
    expect(h.phase.type).toBe('DAY_DISCUSSION');
  });

  it('vote results wait for confirmation and can be overridden', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.untilPhase('VOTING');
    h.vote('p1', 'p7');
    h.run(MOD, { type: 'MOD_NEXT' });
    expect(h.phase.type).toBe('VOTE_RESULT');
    expect(h.view({ kind: 'player', playerId: 'p2' }).phase.eliminatedId).toBeNull();
    h.run(MOD, { type: 'MOD_CONFIRM', override: { eliminatedId: null } });
    expect(h.player('p7').alive).toBe(true);
    h.run(MOD, { type: 'MOD_NEXT' });
    expect(h.phase.type).toBe('NIGHT');
  });

  it('lock, reopen and timer adjustments', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.run(MOD, { type: 'MOD_NEXT' });
    h.run(MOD, { type: 'MOD_LOCK' });
    h.expectError(h.as('p4'), { type: 'NIGHT_ACTION', phaseId: h.phase.id, action: { kind: 'GUARD_PROTECT', targetId: 'p7' } }, 'PHASE_LOCKED');
    h.run(MOD, { type: 'MOD_REOPEN', seconds: 20 });
    expect(h.phase.endsAt).toBe(h.now + 20_000);
    h.run(MOD, { type: 'MOD_ADJUST_TIMER', deltaSeconds: 30 });
    expect(h.phase.endsAt).toBe(h.now + 50_000);
    h.run(MOD, { type: 'MOD_ADJUST_TIMER', deltaSeconds: -600 });
    expect(h.phase.endsAt).toBe(h.now + 5_000);
    h.night('p4', { kind: 'GUARD_PROTECT', targetId: 'p7' });
  });

  it('players and AUTO games cannot use moderator commands', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.expectError(h.as('p1'), { type: 'MOD_NEXT' }, 'NOT_ALLOWED');
    const auto = new Harness([...BASIC]);
    auto.expectError(MOD, { type: 'MOD_NEXT' }, 'NOT_ALLOWED');
    auto.expectError(h.as('p1'), { type: 'TICK', phaseId: 1 }, 'NOT_ALLOWED');
  });

  it('moderator can end the game (aborted or with a winner)', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.run(MOD, { type: 'MOD_END', winner: null, reason: 'test' });
    expect(h.state.status).toBe('ABORTED');
    expect(h.phase.type).toBe('GAME_OVER');
  });
});

describe('pause / resume', () => {
  it('freezes the remaining time and restores it', () => {
    const h = new Harness([...BASIC], { mode: 'HUMAN' });
    h.now += 5_000;
    h.run(MOD, { type: 'MOD_PAUSE' });
    expect(h.phase.endsAt).toBeNull();
    h.expectError(h.as('p1'), { type: 'ACK_ROLE', phaseId: h.phase.id }, 'GAME_PAUSED');
    h.now += 60_000;
    h.run(MOD, { type: 'MOD_RESUME' });
    expect(h.phase.endsAt).toBe(h.now + 10_000);
  });

  it('system pause abandons the game after the configured delay', () => {
    const h = new Harness([...BASIC], { rules: { abandonAfterMinutes: 1 } });
    h.run(SYSTEM, { type: 'SYS_PAUSE', reason: 'ALL_DISCONNECTED' });
    expect(h.state.paused?.abandonAt).toBe(h.now + 60_000);
    h.now += 30_000;
    h.run(SYSTEM, { type: 'TICK', phaseId: h.phase.id });
    expect(h.state.status).toBe('RUNNING');
    h.now += 30_000;
    h.run(SYSTEM, { type: 'TICK', phaseId: h.phase.id });
    expect(h.state.status).toBe('ABORTED');
  });

  it('system resume restores a system pause', () => {
    const h = new Harness([...BASIC]);
    h.run(SYSTEM, { type: 'SYS_PAUSE', reason: 'ALL_DISCONNECTED' });
    h.run(SYSTEM, { type: 'SYS_RESUME' });
    expect(h.state.paused).toBeNull();
    expect(h.phase.endsAt).not.toBeNull();
  });
});
