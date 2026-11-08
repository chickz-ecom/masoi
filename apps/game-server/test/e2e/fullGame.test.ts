import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../../src/app';
import { FAST_TIMERS, cid, setupRoom, startServer, type Client } from '../helpers';

let app: App;
let url: string;
const clients: Client[] = [];

beforeAll(async () => {
  ({ app, url } = await startServer());
});
afterAll(async () => {
  clients.forEach((c) => c.close());
  await app.close();
});

const prisma = () => (app.services.rooms as unknown as { prisma: PrismaClient }).prisma;
const byRole = (cs: Client[], role: string) => cs.filter((c) => c.view.me?.role === role);

describe('full game — AUTOMATIC moderator', () => {
  it('plays from lobby to game over with 5 players, then returns to the lobby', async () => {
    const r = await setupRoom(url, 'AUTO', 5, {
      timers: FAST_TIMERS,
      deck: { werewolf: 1, seer: 1, villager: 3 },
    });
    clients.push(...r.all);
    for (const c of r.others) await c.must('lobby:ready', { ready: true });
    await r.host.waitFor(() => r.host.room?.canStart === true, 'canStart');
    await r.host.must('game:start');
    for (const c of r.all) await c.waitPhase('ROLE_REVEAL');

    // Role reveal → everyone acknowledges → night starts automatically.
    for (const c of r.all) await c.must('game:ackRole', { phaseId: c.view.phase.id });
    const [wolf] = byRole(r.all, 'werewolf') as [Client];
    const [seer] = byRole(r.all, 'seer') as [Client];
    const villagers = byRole(r.all, 'villager');
    expect(villagers).toHaveLength(3);
    const victim = villagers[0] as Client;

    await wolf.waitPhase('NIGHT', 'WEREWOLVES');
    expect(wolf.view.me?.prompt?.kind).toBe('WOLF_VOTE');
    expect(victim.view.me?.prompt).toBeNull();
    await wolf.must('game:nightAction', {
      phaseId: wolf.view.phase.id,
      clientActionId: cid(),
      action: { kind: 'WOLF_VOTE', targetId: victim.id },
    });

    await seer.waitPhase('NIGHT', 'SEER');
    await seer.must('game:nightAction', {
      phaseId: seer.view.phase.id,
      clientActionId: cid(),
      action: { kind: 'SEER_CHECK', targetId: wolf.id },
    });
    await seer.waitFor(() => seer.events.some((e) => e.type === 'SEER_RESULT'), 'seer result');
    expect(seer.events.find((e) => e.type === 'SEER_RESULT')?.payload).toEqual({ targetId: wolf.id, isWolf: true });
    // Nobody else received the seer result.
    for (const c of r.all.filter((x) => x !== seer)) expect(c.events.some((e) => e.type === 'SEER_RESULT')).toBe(false);

    // Dawn: the victim is announced dead (server timer, 3s).
    await victim.waitPhase('DAWN');
    expect(victim.view.phase.announcedDeaths).toEqual([{ playerId: victim.id, role: 'villager' }]);
    expect(victim.view.me?.alive).toBe(false);

    // Discussion: all living players skip → voting.
    const alive = r.all.filter((c) => c !== victim);
    for (const c of alive) await c.waitPhase('DAY_DISCUSSION');
    const deadSkip = await victim.emit('game:skipDiscussion', { phaseId: victim.view.phase.id });
    expect(deadSkip.ok).toBe(false);
    for (const c of alive) await c.must('game:skipDiscussion', { phaseId: c.view.phase.id });

    // Voting: dead player cannot vote; everyone else votes the wolf.
    for (const c of alive) await c.waitPhase('VOTING');
    const deadVote = await victim.emit('game:vote', { phaseId: victim.view.phase.id, clientActionId: cid(), targetId: wolf.id, lock: true });
    expect(!deadVote.ok && deadVote.error.code).toBe('PLAYER_DEAD');
    for (const c of alive) {
      const target = c === wolf ? seer.id : wolf.id;
      await c.must('game:vote', { phaseId: c.view.phase.id, clientActionId: cid(), targetId: target, lock: true });
    }

    await r.host.waitPhase('GAME_OVER', undefined, 20_000);
    const final = r.host.view;
    expect(final.winner).toBe('VILLAGE');
    expect(final.players.every((p) => p.role !== null)).toBe(true);
    expect(final.voteHistory[0]?.eliminatedId).toBe(wolf.id);
    expect(final.timeline.some((e) => e.kind === 'SEER_CHECKED')).toBe(true); // secrets revealed at the end

    const result = await prisma().gameResult.findUnique({ where: { gameId: final.gameId } });
    expect(result?.winner).toBe('VILLAGE');
    const events = await prisma().gameEvent.count({ where: { gameId: final.gameId } });
    expect(events).toBeGreaterThan(10);

    // Play again with the same group.
    await r.host.must('game:playAgain');
    await r.host.waitFor(() => r.host.room?.status === 'LOBBY', 'back to lobby');
    const history = await fetch(`${url}/api/me/history`, { headers: { authorization: `Bearer ${r.host.session.token}` } });
    const list = (await history.json()) as { winner: string }[];
    expect(list[0]?.winner).toBe('VILLAGE');
  });
});

describe('full game — HUMAN moderator', () => {
  it('moderator drives every transition, confirms results and overrides an elimination', async () => {
    const r = await setupRoom(url, 'HUMAN', 4, { deck: { werewolf: 1, seer: 1, villager: 2 } });
    clients.push(...r.all);
    const mod = r.host;
    const players = r.others;
    for (const c of players) await c.must('lobby:ready', { ready: true });
    await mod.waitFor(() => mod.room?.canStart === true, 'canStart');
    await mod.must('game:start');
    await mod.waitPhase('ROLE_REVEAL');
    for (const c of players) await c.waitPhase('ROLE_REVEAL');

    // The moderator sees every role; players do not see the moderator panel.
    expect(mod.view.moderator).not.toBeNull();
    expect(mod.view.players.every((p) => p.role !== null)).toBe(true);
    for (const c of players) {
      expect(c.view.moderator).toBeNull();
      const forbidden = await c.emit('mod:command', { clientActionId: cid(), command: { type: 'MOD_NEXT' } });
      expect(!forbidden.ok && forbidden.error.code).toBe('NOT_ALLOWED');
    }
    // Moderator is not a participant.
    const modVote = await mod.emit('game:ackRole', { phaseId: mod.view.phase.id });
    expect(!modVote.ok && modVote.error.code).toBe('NOT_PARTICIPANT');

    const next = () => mod.must('mod:command', { clientActionId: cid(), command: { type: 'MOD_NEXT' } });
    const confirm = (override?: unknown) =>
      mod.must('mod:command', { clientActionId: cid(), command: { type: 'MOD_CONFIRM', ...(override ? { override } : {}) } });

    for (const c of players) await c.must('game:ackRole', { phaseId: c.view.phase.id });
    // HUMAN: all acks do not advance by themselves.
    await new Promise((res) => setTimeout(res, 300));
    expect(mod.view.phase.type).toBe('ROLE_REVEAL');
    await next();

    const [wolf] = byRole(players, 'werewolf') as [Client];
    const [seer] = byRole(players, 'seer') as [Client];
    const [v1, v2] = byRole(players, 'villager') as [Client, Client];

    await wolf.waitPhase('NIGHT', 'WEREWOLVES');
    await wolf.must('game:nightAction', { phaseId: wolf.view.phase.id, clientActionId: cid(), action: { kind: 'WOLF_VOTE', targetId: v1.id } });
    await mod.waitFor(() => mod.view.moderator?.actionStatus.every((a) => a.done) === true, 'wolf done');
    await next();
    await seer.waitPhase('NIGHT', 'SEER');
    await seer.must('game:nightAction', { phaseId: seer.view.phase.id, clientActionId: cid(), action: { kind: 'SEER_CHECK', targetId: v2.id } });
    await next();

    // Dawn awaits confirmation: players see "awaiting moderator", moderator sees the proposal.
    await mod.waitPhase('DAWN');
    await v2.waitPhase('DAWN');
    expect(v2.view.phase.awaitingModerator).toBe(true);
    expect(mod.view.moderator?.pendingOutcome).toMatchObject({ kind: 'NIGHT', deaths: [{ playerId: v1.id }] });
    await confirm();
    await v1.waitFor(() => v1.view.me?.alive === false, 'v1 dead');
    await next();
    await mod.waitPhase('DAY_DISCUSSION');
    await next();
    await mod.waitPhase('VOTING');
    // Votes split; moderator closes voting, then overrides the result to eliminate the wolf.
    await wolf.waitPhase('VOTING');
    await wolf.must('game:vote', { phaseId: wolf.view.phase.id, clientActionId: cid(), targetId: seer.id, lock: true });
    await seer.must('game:vote', { phaseId: seer.view.phase.id, clientActionId: cid(), targetId: wolf.id, lock: true });
    await v2.must('game:vote', { phaseId: v2.view.phase.id, clientActionId: cid(), targetId: wolf.id, lock: true });
    await next();
    await mod.waitPhase('VOTE_RESULT');
    expect(mod.view.moderator?.pendingOutcome).toMatchObject({ kind: 'VOTE', eliminatedId: wolf.id });
    await confirm({ eliminatedId: wolf.id });
    await next();
    await mod.waitPhase('GAME_OVER');
    expect(mod.view.winner).toBe('VILLAGE');

    const logs = await prisma().moderatorAuditLog.findMany({ where: { gameId: mod.view.gameId } });
    expect(logs.length).toBeGreaterThanOrEqual(8);
    expect(logs.some((l) => l.command === 'MOD_CONFIRM')).toBe(true);
  });
});
