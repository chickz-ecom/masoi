import type { RoomPublicInfo, SessionResponse } from '@masoi/shared';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { Client, FAST_TIMERS, api, cid, setupRoom, startServer } from './helpers';

let app: App;
let url: string;
let prefix: string;
const clients: Client[] = [];

beforeAll(async () => {
  ({ app, url, prefix } = await startServer());
});
afterAll(async () => {
  clients.forEach((c) => c.close());
  await app.close();
});

async function waitUntil(fn: () => Promise<boolean>, label: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await fn())) {
    if (Date.now() > deadline) throw new Error(`timeout: ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

function track<T extends { all: Client[] }>(r: T): T {
  clients.push(...r.all);
  return r;
}

async function startedAutoGame(n = 5) {
  const r = track(await setupRoom(url, 'AUTO', n, { timers: FAST_TIMERS }));
  for (const c of r.others) await c.must('lobby:ready', { ready: true });
  await r.host.waitFor(() => r.host.room?.canStart === true, 'canStart');
  await r.host.must('game:start');
  for (const c of r.all) await c.waitPhase('ROLE_REVEAL');
  return r;
}

describe('REST', () => {
  it('health reports db and redis', async () => {
    const res = await api<{ ok: boolean }>(url, '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it('validates input and enforces unique nicknames / capacity', async () => {
    expect((await api(url, '/api/rooms', { nickname: 'x', mode: 'AUTO', name: 'a' })).status).toBe(400);
    expect((await api(url, '/api/rooms', { nickname: 'Hợp lệ', mode: 'AUTO', name: 'a', isAdmin: true })).status).toBe(400);
    expect((await api(url, '/api/rooms/AAAA10')).status).toBe(400);
    expect((await api(url, '/api/rooms/ZZZZZZ')).status).toBe(404);

    const created = await api<SessionResponse>(url, '/api/rooms', { nickname: 'Chủ', mode: 'AUTO', name: 'Nhỏ', maxPlayers: 4 });
    const code = created.data.roomCode;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.data.token.length).toBeGreaterThan(40);
    const dup = await api<{ code: string }>(url, `/api/rooms/${code}/join`, { nickname: 'chủ' });
    expect(dup.status).toBe(409);
    expect(dup.data.code).toBe('NICKNAME_TAKEN');
    for (let i = 0; i < 3; i++) expect((await api(url, `/api/rooms/${code}/join`, { nickname: `Khách ${i}` })).status).toBe(201);
    const full = await api<{ code: string }>(url, `/api/rooms/${code}/join`, { nickname: 'Thừa' });
    expect(full.data.code).toBe('ROOM_FULL');
    const spec = await api<{ code: string }>(url, `/api/rooms/${code}/join`, { nickname: 'Xem', asSpectator: true });
    expect(spec.data.code).toBe('SPECTATORS_DISABLED');
    const info = await api<RoomPublicInfo>(url, `/api/rooms/${code}`);
    expect(info.data).toMatchObject({ code, name: 'Nhỏ', playerCount: 4, maxPlayers: 4, status: 'LOBBY' });
  });

  it('never stores raw session tokens', async () => {
    const created = await api<SessionResponse>(url, '/api/rooms', { nickname: 'Bí Mật', mode: 'AUTO', name: 'Token' });
    const prisma = (app.services.rooms as unknown as { prisma: PrismaClient }).prisma;
    const rows = await prisma.playerSession.findMany({ where: { playerId: created.data.memberId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toContain(created.data.token);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('socket auth & lobby', () => {
  it('rejects bad tokens', async () => {
    const bad = new Client(url, { token: 'x'.repeat(43), memberId: 'nope', roomCode: 'AAAAAA' }, 'bad');
    await expect(bad.connect()).rejects.toThrow();
  });

  it('syncs the lobby, ready flags and host-only actions', async () => {
    const r = track(await setupRoom(url, 'AUTO', 4));
    const [p1, p2] = r.others as [Client, Client];
    await p1.waitFor(() => p1.room?.members.length === 4, 'members');
    expect(p1.room?.you).toEqual({ id: p1.id, kind: 'PLAYER', isHost: false });
    expect((await p1.emit('game:start')).ok).toBe(false);
    const notHost = await p1.emit('lobby:updateSettings', { patch: { name: 'Hack' } });
    expect(!notHost.ok && notHost.error.code).toBe('NOT_HOST');
    const invalid = await r.host.emit('lobby:updateSettings', { patch: { timers: { discussion: 1 } } });
    expect(!invalid.ok && invalid.error.code).toBe('INVALID_PAYLOAD');
    await r.host.must('lobby:updateSettings', { patch: { name: 'Làng Mới' } });
    await p2.waitFor(() => p2.room?.settings.name === 'Làng Mới', 'settings sync');
    // Not everyone ready → cannot start
    const early = await r.host.emit('game:start');
    expect(!early.ok && early.error.code).toBe('NOT_READY');
    // Kick revokes the session
    await r.host.must('lobby:kick', { memberId: p2.id });
    await p2.waitFor(() => p2.revoked === 'KICKED', 'revoked');
    const again = new Client(url, p2.session, 'kicked-again');
    await expect(again.connect()).rejects.toThrow();
  });

  it('transfers host when the host leaves the lobby', async () => {
    const r = track(await setupRoom(url, 'AUTO', 4));
    const p1 = r.others[0] as Client;
    await r.host.must('room:leave');
    await p1.waitFor(() => p1.room?.you.isHost === true, 'became host');
  });
});

describe('game start, secrecy and permissions', () => {
  it('each player only ever receives their own role', async () => {
    const r = await startedAutoGame(6);
    for (const c of r.all) {
      const visible = c.view.players.filter((p) => p.role !== null);
      const me = c.view.me;
      expect(me).not.toBeNull();
      const expected = me?.role === 'werewolf' ? 1 + (me?.teammates.length ?? 0) : 1;
      expect(visible).toHaveLength(expected);
      // Events received by this client: ROLE_ASSIGNED only for themselves.
      const assigned = c.events.filter((e) => e.type === 'ROLE_ASSIGNED');
      expect(assigned).toHaveLength(1);
      expect(assigned[0]?.payload.role).toBe(me?.role);
      expect(c.view.moderator).toBeNull();
    }
  });

  it('rejects spectators/moderator commands from players, invalid & stale payloads', async () => {
    const r = await startedAutoGame(5);
    const p = r.others[0] as Client;
    const mod = await p.emit('mod:command', { clientActionId: cid(), command: { type: 'MOD_NEXT' } });
    expect(!mod.ok && mod.error.code).toBe('NOT_ALLOWED');
    const bad = await p.emit('game:nightAction', { phaseId: 1, clientActionId: cid(), action: { kind: 'NUKE' } });
    expect(!bad.ok && bad.error.code).toBe('INVALID_PAYLOAD');
    const wrong = await p.emit('game:vote', { phaseId: p.view.phase.id, clientActionId: cid(), targetId: null, lock: true });
    expect(!wrong.ok && wrong.error.code).toBe('WRONG_PHASE');
    const stale = await p.emit('game:ackRole', { phaseId: p.view.phase.id + 5 });
    expect(!stale.ok && stale.error.code).toBe('STALE_PHASE');
  });

  it('handles concurrent submissions and idempotent retries', async () => {
    const r = await startedAutoGame(6);
    // Everyone acks at the same time.
    await Promise.all(r.all.map((c) => c.must('game:ackRole', { phaseId: c.view.phase.id })));
    await r.host.waitPhase('NIGHT');
    // Werewolves vote concurrently; the same clientActionId twice must be applied once.
    const wolves = r.all.filter((c) => c.view.me?.role === 'werewolf');
    const target = r.all.find((c) => c.view.me?.role !== 'werewolf') as Client;
    const wolf = wolves[0] as Client;
    await wolf.waitPhase('NIGHT', 'WEREWOLVES', 30_000);
    const id = cid();
    const payload = { phaseId: wolf.view.phase.id, clientActionId: id, action: { kind: 'WOLF_VOTE', targetId: target.id } };
    const [a, b] = await Promise.all([wolf.emit('game:nightAction', payload), wolf.emit('game:nightAction', payload)]);
    expect(a.ok && b.ok).toBe(true);
    const prisma = (app.services.rooms as unknown as { prisma: PrismaClient }).prisma;
    const rows = await prisma.gameAction.findMany({ where: { actorPlayerId: wolf.id, clientActionId: id } });
    expect(rows).toHaveLength(1);
  });
});

describe('reconnect & restart', () => {
  it('a refreshed client gets the same identity and role back', async () => {
    const r = await startedAutoGame(5);
    const p = r.others[1] as Client;
    const role = p.view.me?.role;
    p.close();
    const again = await new Client(url, p.session, 'p-again').connect();
    clients.push(again);
    const synced = await again.must<{ game: { view: { me: { role: string; playerId: string } } } }>('room:sync');
    expect(synced.game.view.me.role).toBe(role);
    expect(synced.game.view.me.playerId).toBe(p.id);
  });

  it('pauses when every participant disconnects and resumes when one returns', async () => {
    const r = await startedAutoGame(4);
    const gameId = r.host.view.gameId;
    const paused = async () => (await app.services.games.loadState(gameId))?.state.paused ?? null;
    r.all.forEach((c) => c.close());
    await waitUntil(async () => (await paused()) !== null, 'paused');
    expect((await paused())?.by).toBe('system');
    const back = await new Client(url, r.host.session, 'host-back').connect();
    clients.push(back);
    await waitUntil(async () => (await paused()) === null, 'resumed');
  });

  it('timers survive a server restart (reconciled from Postgres)', async () => {
    const r = await startedAutoGame(4);
    const code = r.code;
    r.all.forEach((c) => c.close());
    await app.close();
    // Wipe Redis timers to prove reconciliation from Postgres works.
    ({ app, url } = await startServer(prefix));
    const back = await new Client(url, r.host.session, 'after-restart').connect();
    clients.push(back);
    const s = await back.must<{ game: { view: { phase: { type: string } } } }>('room:sync');
    expect(['ROLE_REVEAL', 'NIGHT']).toContain(s.game.view.phase.type);
    await back.waitFor(() => back.sync?.view.phase.type === 'NIGHT', 'night after restart', 15_000);
    const info = await api<RoomPublicInfo>(url, `/api/rooms/${code}`);
    expect(info.data.status).toBe('IN_GAME');
  });
});
