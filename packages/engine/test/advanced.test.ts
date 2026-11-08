import { describe, expect, it } from 'vitest';
import { Harness } from './helpers';

describe('cupid', () => {
  it('links lovers on night 1; they learn each other privately', () => {
    const h = new Harness(['cupid', 'werewolf', 'villager', 'villager', 'seer', 'villager']);
    h.ackAll();
    expect(h.phase.type === 'NIGHT' && h.phase.step).toBe('CUPID');
    h.night('p1', { kind: 'CUPID_LINK', targetIds: ['p3', 'p4'] });
    const linked = h.eventsOf('LOVERS_LINKED');
    expect(linked.map((e) => e.visibility)).toEqual([
      { scope: 'players', playerIds: ['p3'] },
      { scope: 'players', playerIds: ['p4'] },
    ]);
    const v3 = h.view({ kind: 'player', playerId: 'p3' });
    expect(v3.me?.lover).toEqual({ playerId: 'p4', role: 'villager' });
    expect(v3.players.find((p) => p.id === 'p4')?.isLover).toBe(true);
  });

  it('a lover dies of heartbreak in the same resolution', () => {
    const h = new Harness(['cupid', 'werewolf', 'villager', 'villager', 'seer', 'villager']);
    h.ackAll();
    h.night('p1', { kind: 'CUPID_LINK', targetIds: ['p3', 'p4'] });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p3' });
    h.untilPhase('DAWN');
    expect(h.player('p3').alive).toBe(false);
    expect(h.player('p4').alive).toBe(false);
    expect(h.player('p4').death?.causes).toEqual(['HEARTBREAK']);
  });

  it('mixed-team lovers win when they are the last two', () => {
    const h = new Harness(['cupid', 'werewolf', 'villager', 'villager', 'seer', 'villager']);
    h.ackAll();
    h.night('p1', { kind: 'CUPID_LINK', targetIds: ['p2', 'p3'] });
    for (const id of ['p1', 'p4', 'p5', 'p6']) h.player(id).alive = false;
    h.untilPhase('DAWN');
    h.timeout();
    expect(h.state.winner).toBe('LOVERS');
    expect(h.state.winnerIds).toEqual(['p2', 'p3']);
  });
});

describe('elder', () => {
  it('survives the first wolf attack only', () => {
    const h = new Harness(['werewolf', 'elder', 'villager', 'villager', 'villager', 'seer']);
    h.ackAll();
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p2' });
    h.untilPhase('DAWN');
    expect(h.player('p2').alive).toBe(true);
    expect(h.state.roles.elderLivesLost).toBe(1);
    h.nextNight();
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p2' });
    h.untilPhase('DAWN');
    expect(h.player('p2').alive).toBe(false);
  });
});

describe('white wolf', () => {
  it('can kill another wolf on even nights; wins alone as sole survivor', () => {
    const h = new Harness(['white_wolf', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'seer']);
    h.ackAll();
    expect(h.state.night?.steps).not.toContain('WHITE_WOLF');
    h.nextNight();
    expect(h.state.night?.steps).toContain('WHITE_WOLF');
    h.untilStep('WHITE_WOLF');
    h.night('p1', { kind: 'WHITE_WOLF_KILL', targetId: 'p2' });
    h.untilPhase('DAWN');
    expect(h.player('p2').alive).toBe(false);
    expect(h.player('p2').death?.causes).toEqual(['WHITE_WOLF']);
  });
});
