import type { SessionResponse } from '@masoi/shared';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { Client, FAST_TIMERS, api, startServer } from './helpers';

/**
 * Two game-server instances sharing Postgres + Redis (as behind a load balancer).
 * Players are split across instances; events must reach everyone (Redis adapter) and
 * each timer must fire exactly once (atomic Lua pop).
 */
let a: { app: App; url: string; prefix: string };
let b: { app: App; url: string };
const clients: Client[] = [];

beforeAll(async () => {
  a = await startServer();
  b = await startServer(a.prefix);
});
afterAll(async () => {
  clients.forEach((c) => c.close());
  await b.app.close();
  await a.app.close();
});

describe('multiple game-server instances', () => {
  it('runs one game across two instances without duplicate processing', async () => {
    const created = await api<SessionResponse>(a.url, '/api/rooms', {
      nickname: 'Chủ A',
      mode: 'AUTO',
      name: 'Hai máy chủ',
      settings: { timers: FAST_TIMERS, deck: { werewolf: 1, seer: 1, villager: 2 } },
    });
    const host = await new Client(a.url, created.data, 'host@A').connect();
    clients.push(host);
    const others: Client[] = [];
    for (let i = 0; i < 3; i++) {
      const url = i % 2 === 0 ? b.url : a.url;
      const joined = await api<SessionResponse>(url, `/api/rooms/${created.data.roomCode}/join`, { nickname: `Khách ${i}` });
      const c = await new Client(url, joined.data, `p${i}@${url === a.url ? 'A' : 'B'}`).connect();
      others.push(c);
      clients.push(c);
    }
    // Lobby state propagates across instances.
    await host.waitFor(() => host.room?.members.length === 4, 'all members visible on A');
    for (const c of others) await c.must('lobby:ready', { ready: true });
    await host.waitFor(() => host.room?.canStart === true, 'canStart');
    await host.must('game:start');
    const all = [host, ...others];
    for (const c of all) await c.waitPhase('ROLE_REVEAL');

    // Let the role-reveal timer (5s) fire: exactly one NIGHT transition must happen.
    for (const c of all) await c.waitPhase('NIGHT', undefined, 15_000);
    const gameId = host.view.gameId;
    const prisma = (a.app.services.rooms as unknown as { prisma: PrismaClient }).prisma;
    const phases = await prisma.gamePhase.findMany({ where: { gameId }, orderBy: { phaseId: 'asc' } });
    const ids = phases.map((p) => p.phaseId);
    expect(new Set(ids).size).toBe(ids.length);
    const nightStarts = await prisma.gameEvent.count({ where: { gameId, type: 'PHASE_CHANGED', payload: { path: ['type'], equals: 'NIGHT' } } });
    expect(nightStarts).toBe(1);
    // Every client (on both instances) received its own role privately.
    for (const c of all) expect(c.events.filter((e) => e.type === 'ROLE_ASSIGNED')).toHaveLength(1);
  });
});
