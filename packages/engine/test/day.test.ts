import { describe, expect, it } from 'vitest';
import { checkWinner } from '../src';
import { Harness } from './helpers';

const BASIC = ['werewolf', 'werewolf', 'seer', 'guardian', 'witch', 'hunter', 'villager', 'villager'] as const;

/** Reach day-1 voting with nobody dead. */
function toVoting(h: Harness) {
  h.ackAll();
  h.untilPhase('VOTING');
}

describe('discussion', () => {
  it('ends early when every living player skips', () => {
    const h = new Harness([...BASIC]);
    h.ackAll();
    h.untilPhase('DAY_DISCUSSION');
    for (const p of h.state.players) {
      expect(h.phase.type).toBe('DAY_DISCUSSION');
      h.run(h.as(p.id), { type: 'SKIP_DISCUSSION', phaseId: h.phase.id });
    }
    expect(h.phase.type).toBe('VOTING');
  });

  it('respects allowSkipDiscussion=false', () => {
    const h = new Harness([...BASIC], { rules: { allowSkipDiscussion: false } });
    h.ackAll();
    h.untilPhase('DAY_DISCUSSION');
    h.expectError(h.as('p1'), { type: 'SKIP_DISCUSSION', phaseId: h.phase.id }, 'NOT_ALLOWED');
  });
});

describe('voting', () => {
  it('eliminates the plurality target', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', 'p7');
    h.vote('p2', 'p7');
    h.vote('p3', 'p1');
    h.timeout();
    expect(h.phase.type).toBe('VOTE_RESULT');
    expect(h.player('p7').alive).toBe(false);
    expect(h.player('p7').death?.causes).toEqual(['VOTE']);
    expect(h.state.voteHistory[0]?.outcome).toBe('ELIMINATED');
  });

  it('closes early when every living voter locked', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    for (const p of h.state.players) h.vote(p.id, p.id === 'p1' ? 'p2' : 'p1');
    expect(h.phase.type).toBe('VOTE_RESULT');
    expect(h.player('p1').alive).toBe(false);
  });

  it('tie → one runoff between tied candidates → still tied → nobody dies', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', 'p7');
    h.vote('p2', 'p8');
    h.timeout();
    expect(h.phase.type).toBe('VOTING');
    if (h.phase.type !== 'VOTING') return;
    expect(h.phase.round).toBe(2);
    expect(h.phase.candidates).toEqual(['p7', 'p8']);
    h.expectError(h.as('p3'), { type: 'VOTE', phaseId: h.phase.id, targetId: 'p1', lock: true }, 'INVALID_TARGET');
    h.vote('p3', 'p7');
    h.vote('p4', 'p8');
    h.timeout();
    expect(h.phase.type).toBe('VOTE_RESULT');
    expect(h.state.players.every((p) => p.alive)).toBe(true);
    expect(h.state.voteHistory.map((r) => r.outcome)).toEqual(['TIE_RUNOFF', 'TIE_NO_ELIMINATION']);
  });

  it('runoff resolves the tie', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', 'p7');
    h.vote('p2', 'p8');
    h.timeout();
    h.vote('p3', 'p7');
    h.timeout();
    expect(h.player('p7').alive).toBe(false);
  });

  it('no valid votes (all abstain) → nobody dies', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', null);
    h.vote('p2', null);
    h.timeout();
    expect(h.phase.type).toBe('VOTE_RESULT');
    expect(h.state.voteHistory[0]?.outcome).toBe('NO_VOTES');
    expect(h.state.players.every((p) => p.alive)).toBe(true);
  });

  it('dead players, self votes and locked votes are rejected', () => {
    const h = new Harness([...BASIC]);
    h.ackAll();
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p8' });
    h.untilPhase('VOTING');
    h.expectError(h.as('p8'), { type: 'VOTE', phaseId: h.phase.id, targetId: 'p1', lock: true }, 'PLAYER_DEAD');
    h.expectError(h.as('p1'), { type: 'VOTE', phaseId: h.phase.id, targetId: 'p1', lock: true }, 'INVALID_TARGET');
    h.expectError(h.as('p1'), { type: 'VOTE', phaseId: h.phase.id, targetId: 'p8', lock: true }, 'INVALID_TARGET');
    h.vote('p1', 'p3', true);
    h.expectError(h.as('p1'), { type: 'VOTE', phaseId: h.phase.id, targetId: 'p4', lock: true }, 'ALREADY_ACTED');
  });

  it('allows changing an unlocked vote, unless allowVoteChange is off', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', 'p3', false);
    h.vote('p1', 'p4', false);
    expect(h.phase.type === 'VOTING' && h.phase.ballots.p1).toEqual({ targetId: 'p4', locked: false });

    const strict = new Harness([...BASIC], { rules: { allowVoteChange: false } });
    toVoting(strict);
    strict.vote('p1', 'p3', false);
    strict.expectError(strict.as('p1'), { type: 'VOTE', phaseId: strict.phase.id, targetId: 'p4', lock: false }, 'ALREADY_ACTED');
  });

  it('keeps individual ballots secret while voting is open', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', 'p7', true);
    const pub = h.eventsOf('VOTE_SUBMITTED').filter((e) => e.visibility.scope === 'public');
    expect(pub[0]?.payload).toEqual({ lockedCount: 1, votedCount: 1, total: 8 });
    const other = h.view({ kind: 'player', playerId: 'p3' });
    expect(JSON.stringify(other)).not.toContain('"p7","locked"');
    expect(other.phase.progress).toEqual({ done: 1, total: 8 });
  });
});

describe('hunter', () => {
  it('shoots when killed by wolves, before discussion', () => {
    const h = new Harness([...BASIC]);
    h.ackAll();
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p6' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p6' });
    h.untilPhase('DAWN');
    h.timeout();
    expect(h.phase.type).toBe('HUNTER_SHOT');
    const prompt = h.view({ kind: 'player', playerId: 'p6' }).me?.prompt;
    expect(prompt?.kind).toBe('HUNTER_SHOOT');
    h.expectError(h.as('p7'), { type: 'HUNTER_SHOOT', phaseId: h.phase.id, targetId: 'p1' }, 'NOT_ALLOWED');
    h.run(h.as('p6'), { type: 'HUNTER_SHOOT', phaseId: h.phase.id, targetId: 'p1' });
    expect(h.player('p1').alive).toBe(false);
    expect(h.player('p1').death?.causes).toEqual(['HUNTER']);
    expect(h.phase.type).toBe('DAY_DISCUSSION');
  });

  it('does not shoot when poisoned (even if also attacked)', () => {
    const h = new Harness([...BASIC]);
    h.ackAll();
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p6' });
    h.night('p2', { kind: 'WOLF_VOTE', targetId: 'p6' });
    h.untilStep('WITCH');
    h.night('p5', { kind: 'WITCH_ACT', heal: false, poisonTargetId: 'p6' });
    expect(h.player('p6').death?.causes.sort()).toEqual(['POISON', 'WOLVES']);
    h.timeout();
    expect(h.phase.type).toBe('DAY_DISCUSSION');
  });

  it('shoots when voted out, then night continues', () => {
    const h = new Harness([...BASIC]);
    toVoting(h);
    h.vote('p1', 'p6');
    h.timeout();
    expect(h.phase.type).toBe('VOTE_RESULT');
    h.timeout();
    expect(h.phase.type).toBe('HUNTER_SHOT');
    h.timeout(); // hunter idles → no shot
    expect(h.phase.type).toBe('NIGHT');
    expect(h.state.players.filter((p) => !p.alive).map((p) => p.id)).toEqual(['p6']);
  });

  it('win check waits for the hunter shot (chain deaths resolved first)', () => {
    // 1 wolf, hunter, villager, villager. Wolves kill a villager at night 1 → 1 wolf vs 2.
    // Day 1: village votes out the hunter → 1 wolf vs 1 villager would be a wolf win,
    // but the hunter shoots the wolf first → village wins.
    const h = new Harness(['werewolf', 'hunter', 'villager', 'villager']);
    h.ackAll();
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p4' });
    h.untilPhase('VOTING');
    h.vote('p3', 'p2');
    h.timeout();
    h.timeout();
    expect(h.phase.type).toBe('HUNTER_SHOT');
    expect(h.state.status).toBe('RUNNING');
    h.run(h.as('p2'), { type: 'HUNTER_SHOOT', phaseId: h.phase.id, targetId: 'p1' });
    expect(h.state.status).toBe('ENDED');
    expect(h.state.winner).toBe('VILLAGE');
  });
});

describe('win conditions', () => {
  it('wolves win at parity', () => {
    const h = new Harness(['werewolf', 'villager', 'villager', 'seer']);
    h.ackAll();
    h.untilStep('WEREWOLVES');
    h.night('p1', { kind: 'WOLF_VOTE', targetId: 'p2' });
    h.untilPhase('VOTING');
    h.vote('p1', 'p3');
    h.vote('p4', 'p3');
    h.timeout();
    h.timeout();
    expect(h.state.winner).toBe('WEREWOLF');
    expect(h.phase.type).toBe('GAME_OVER');
    expect(h.state.winnerIds).toEqual(['p1']);
    // Everyone sees all roles at game over.
    expect(h.view({ kind: 'player', playerId: 'p2' }).players.every((p) => p.role !== null)).toBe(true);
  });

  it('village wins when all wolves are eliminated', () => {
    const h = new Harness(['werewolf', 'villager', 'villager', 'seer']);
    h.ackAll();
    h.untilPhase('VOTING');
    h.vote('p2', 'p1');
    h.timeout();
    h.timeout();
    expect(h.state.winner).toBe('VILLAGE');
    expect(h.state.winnerIds.sort()).toEqual(['p2', 'p3', 'p4']);
  });

  it('draw when nobody survives', () => {
    const h = new Harness(['werewolf', 'villager', 'villager', 'villager']);
    for (const p of h.state.players) p.alive = false;
    expect(checkWinner(h.state)).toBe('DRAW');
  });

  it('rejects commands after game over', () => {
    const h = new Harness(['werewolf', 'villager', 'villager', 'seer']);
    h.ackAll();
    h.untilPhase('VOTING');
    h.vote('p2', 'p1');
    h.timeout();
    h.timeout();
    h.expectError(h.as('p2'), { type: 'VOTE', phaseId: h.phase.id, targetId: 'p3', lock: true }, 'GAME_OVER');
  });
});
