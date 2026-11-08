'use client';

import type { RoomView } from '@masoi/shared';
import { CircleHelp, Crown, LogOut, Play, ShieldCheck, UserMinus, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/input';
import type { RoomClient } from '@/lib/roomClient';
import { cn } from '@/lib/utils';
import { InvitePanel } from './InvitePanel';
import { PhaseBackground } from './PhaseBackground';
import { RoomSettingsPanel } from './RoomSettingsPanel';
import { useAction } from './useAction';

export function Lobby({ room, client, onLeave }: { room: RoomView; client: RoomClient; onLeave: () => void }) {
  const me = room.members.find((m) => m.id === room.you.id);
  const players = room.members.filter((m) => m.kind === 'PLAYER' && !m.left);
  const others = room.members.filter((m) => m.kind !== 'PLAYER' && !m.left);
  const readyCount = players.filter((p) => p.ready || p.isHost).length;
  const start = useAction();
  const ready = useAction();
  const manage = useAction();

  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-28 pt-6">
      <PhaseBackground bg="lobby" dim={0.6} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ash">Phòng chờ</p>
          <h1 className="title-display gold-text text-4xl font-bold sm:text-5xl">{room.settings.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="gold">{room.mode === 'AUTO' ? 'Quản trò tự động' : 'Có quản trò'}</Badge>
            <Badge>
              {players.length}/{room.settings.maxPlayers} người chơi
            </Badge>
            {room.you.kind === 'SPECTATOR' ? <Badge tone="violet">Bạn đang xem</Badge> : null}
          </div>
        </div>
        <Button variant="ghost" onClick={async () => (await client.leave()).ok && onLeave()}>
          <LogOut className="h-4 w-4" aria-hidden /> Rời phòng
        </Button>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="panel p-4" aria-labelledby="players-title">
            <div className="flex items-center justify-between">
              <h2 id="players-title" className="title-display text-2xl font-semibold text-gold-bright">
                Dân làng tụ họp
              </h2>
              <span className="text-sm text-ash">
                {readyCount}/{players.length} sẵn sàng
              </span>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {[...others, ...players].map((m) => (
                <li
                  key={m.id}
                  className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5', m.id === room.you.id ? 'border-gold/40 bg-gold/5' : 'border-white/10 bg-night-950/40')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {m.connected ? <Wifi className="h-4 w-4 shrink-0 text-emerald-300" aria-label="Đang kết nối" /> : <WifiOff className="h-4 w-4 shrink-0 text-ash" aria-label="Mất kết nối" />}
                    <span className="truncate font-medium">{m.nickname}</span>
                    {m.isHost ? <Crown className="h-4 w-4 shrink-0 text-gold" aria-label="Chủ phòng" /> : null}
                    {m.kind === 'MODERATOR' ? <Badge tone="violet">Quản trò</Badge> : null}
                    {m.kind === 'SPECTATOR' ? <Badge>Người xem</Badge> : null}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {m.kind === 'PLAYER' ? (
                      m.ready || m.isHost ? (
                        <Badge tone="green">
                          <ShieldCheck className="h-3 w-3" aria-hidden /> Sẵn sàng
                        </Badge>
                      ) : (
                        <Badge>Chưa sẵn sàng</Badge>
                      )
                    ) : null}
                    {room.you.isHost && m.id !== room.you.id ? (
                      <>
                        {m.kind === 'PLAYER' ? (
                          <Button size="sm" variant="ghost" onClick={() => manage.run(() => client.transferHost(m.id))} aria-label={`Chuyển quyền chủ phòng cho ${m.nickname}`}>
                            <Crown className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => manage.run(() => client.kick(m.id))} aria-label={`Mời ${m.nickname} ra khỏi phòng`}>
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <FieldError>{manage.error}</FieldError>
          </section>
          <RoomSettingsPanel room={room} client={client} />
        </div>
        <aside className="space-y-4">
          <InvitePanel code={room.code} />
          <Link href="/huong-dan" target="_blank" className="panel flex items-center gap-3 p-4 hover:border-gold/50">
            <CircleHelp className="h-6 w-6 shrink-0 text-gold" aria-hidden />
            <span className="text-sm">
              <strong className="block text-gold-bright">Lần đầu chơi Ma Sói?</strong>
              Xem hướng dẫn nhanh trong 2 phút.
            </span>
          </Link>
          {room.you.isHost && room.deckIssues.length > 0 ? (
            <section className="panel p-4" aria-live="polite">
              <h2 className="text-sm font-semibold text-blood-bright">Chưa thể bắt đầu</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-parchment/80">
                {room.deckIssues.map((i) => (
                  <li key={i.code + i.message}>{i.message}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gold/15 bg-night-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          <div className="mr-auto min-w-0 text-sm">
            <FieldError>{start.error ?? ready.error}</FieldError>
          </div>
          {me?.kind === 'PLAYER' && !me.isHost ? (
            <Button
              variant={me.ready ? 'outline' : 'primary'}
              size="lg"
              loading={ready.pending}
              onClick={() => ready.run(() => client.ready(!me.ready))}
              aria-pressed={me.ready}
            >
              <ShieldCheck className="h-5 w-5" aria-hidden /> {me.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
            </Button>
          ) : null}
          {room.you.isHost ? (
            <Button size="lg" disabled={!room.canStart} loading={start.pending} onClick={() => start.run(() => client.start())}>
              <Play className="h-5 w-5" aria-hidden /> Bắt đầu
            </Button>
          ) : (
            <p className="text-sm text-ash">Chờ chủ phòng bắt đầu…</p>
          )}
        </div>
      </div>
    </main>
  );
}
