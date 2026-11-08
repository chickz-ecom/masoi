'use client';

import { NIGHT_STEP_LABELS, ROLES, type GameView, type Winner } from '@masoi/engine';
import { STEP_NARRATION, WINNER_LABELS, narrate, type RoomView } from '@masoi/shared';
import { CheckCircle2, Circle, CircleHelp, FastForward, Flag, Lock, LockOpen, Minus, Pause, Play, Plus, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/input';
import type { RoomClient } from '@/lib/roomClient';
import { roleName, roleTeam, TEAM_STYLE } from '@/lib/roleVisuals';
import { usePrefs } from '@/lib/usePrefs';
import { cn } from '@/lib/utils';
import { GameOverView } from './PhaseViews';
import { PhaseBackground } from './PhaseBackground';
import { StatusBanners, TopBar, useNarration } from './GameScreen';
import { describeEntry, nameFn } from './timelineText';
import { useAction } from './useAction';

const CAUSE_LABEL: Record<string, string> = {
  WOLVES: 'Sói cắn',
  POISON: 'Độc',
  VOTE: 'Bị treo',
  HUNTER: 'Bị bắn',
  HEARTBREAK: 'Chết theo người yêu',
  WHITE_WOLF: 'Sói Trắng',
  MODERATOR: 'Quản trò',
};

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('panel p-4', className)}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-gold">{title}</h2>
      {children}
    </section>
  );
}

function ConfirmPanel({ view, client }: { view: GameView; client: RoomClient }) {
  const mod = view.moderator;
  const pending = mod?.pendingOutcome;
  const name = nameFn(view);
  const act = useAction();
  const alive = view.players.filter((p) => p.alive);
  const proposedDeaths = pending?.kind === 'NIGHT' ? pending.deaths.map((d) => d.playerId) : [];
  const [deaths, setDeaths] = useState<string[]>(proposedDeaths);
  const [eliminated, setEliminated] = useState<string | null>(pending?.kind === 'VOTE' ? pending.eliminatedId : null);
  const pendingKey = JSON.stringify(pending);
  useEffect(() => {
    if (pending?.kind === 'NIGHT') setDeaths(pending.deaths.map((d) => d.playerId));
    if (pending?.kind === 'VOTE') setEliminated(pending.eliminatedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);
  if (!pending) return null;

  if (pending.kind === 'NIGHT') {
    const changed = deaths.length !== proposedDeaths.length || deaths.some((d) => !proposedDeaths.includes(d));
    const d = pending.details;
    return (
      <Card title="Xác nhận kết quả đêm" className="border-team-special/50">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-ash">Sói tấn công</dt>
          <dd>{d.wolfTarget ? name(d.wolfTarget) : '—'}</dd>
          <dt className="text-ash">Bảo Vệ che</dt>
          <dd>{d.guardTarget ? name(d.guardTarget) : '—'}</dd>
          <dt className="text-ash">Bình cứu</dt>
          <dd>{d.healed ? 'Đã dùng' : '—'}</dd>
          <dt className="text-ash">Bình độc</dt>
          <dd>{d.poisonTarget ? name(d.poisonTarget) : '—'}</dd>
          {d.whiteWolfTarget ? (
            <>
              <dt className="text-ash">Sói Trắng</dt>
              <dd>{name(d.whiteWolfTarget)}</dd>
            </>
          ) : null}
          {d.elderShielded ? (
            <>
              <dt className="text-ash">Già Làng</dt>
              <dd>Chống chịu được</dd>
            </>
          ) : null}
        </dl>
        <p className="mt-3 text-sm">
          Đề xuất:{' '}
          {pending.deaths.length
            ? pending.deaths.map((x) => `${name(x.playerId)} (${x.causes.map((c) => CAUSE_LABEL[c]).join(', ')})`).join('; ')
            : 'không ai chết'}
        </p>
        <fieldset className="mt-3">
          <legend className="mb-1 text-xs text-ash">Điều chỉnh người chết (nếu cần):</legend>
          <div className="flex flex-wrap gap-1.5">
            {alive.map((p) => (
              <label key={p.id} className={cn('cursor-pointer rounded-lg border px-2 py-1 text-xs', deaths.includes(p.id) ? 'border-blood-bright bg-blood/25' : 'border-white/10')}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={deaths.includes(p.id)}
                  onChange={(e) => setDeaths((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
                {deaths.includes(p.id) ? '✕ ' : ''}
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          className="mt-4 w-full"
          variant={changed ? 'danger' : 'primary'}
          loading={act.pending}
          onClick={() => act.run(() => client.mod({ type: 'MOD_CONFIRM', ...(changed ? { override: { deaths } } : {}) }))}
        >
          {changed ? 'Xác nhận với điều chỉnh' : 'Công bố kết quả'}
        </Button>
        <FieldError>{act.error}</FieldError>
      </Card>
    );
  }

  const changed = eliminated !== pending.eliminatedId;
  return (
    <Card title="Xác nhận kết quả bỏ phiếu" className="border-team-special/50">
      <p className="text-sm">
        Kết quả tính toán: <strong>{pending.eliminatedId ? `${name(pending.eliminatedId)} bị loại` : 'không ai bị loại'}</strong>
      </p>
      <label htmlFor="override-elim" className="mt-3 block text-xs text-ash">
        Điều chỉnh (nếu cần):
      </label>
      <select
        id="override-elim"
        value={eliminated ?? ''}
        onChange={(e) => setEliminated(e.target.value || null)}
        className="mt-1 w-full rounded-lg border border-gold/25 bg-night-950 px-2 py-2 text-sm"
      >
        <option value="">Không ai bị loại</option>
        {alive.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button
        className="mt-4 w-full"
        variant={changed ? 'danger' : 'primary'}
        loading={act.pending}
        onClick={() => act.run(() => client.mod({ type: 'MOD_CONFIRM', ...(changed ? { override: { eliminatedId: eliminated } } : {}) }))}
      >
        {changed ? 'Xác nhận với điều chỉnh' : 'Công bố kết quả'}
      </Button>
      <FieldError>{act.error}</FieldError>
    </Card>
  );
}

function EndGameDialog({ client }: { client: RoomClient }) {
  const [winner, setWinner] = useState<Winner | ''>('');
  const act = useAction();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Flag className="h-4 w-4" aria-hidden /> Kết thúc trận
        </Button>
      </DialogTrigger>
      <DialogContent title="Kết thúc trận đấu" description="Hành động được ghi vào nhật ký quản trò.">
        <label htmlFor="end-winner" className="text-sm">
          Đội thắng
        </label>
        <select
          id="end-winner"
          value={winner}
          onChange={(e) => setWinner(e.target.value as Winner | '')}
          className="mt-1 w-full rounded-lg border border-gold/25 bg-night-950 px-2 py-2 text-sm"
        >
          <option value="">Hủy trận (không ai thắng)</option>
          {(Object.keys(WINNER_LABELS) as Winner[]).map((w) => (
            <option key={w} value={w}>
              {WINNER_LABELS[w]}
            </option>
          ))}
        </select>
        <Button
          variant="danger"
          className="mt-4 w-full"
          loading={act.pending}
          onClick={() => act.run(() => client.mod({ type: 'MOD_END', winner: winner || null }))}
        >
          Kết thúc
        </Button>
        <FieldError>{act.error}</FieldError>
      </DialogContent>
    </Dialog>
  );
}

export function ModeratorDashboard({
  view,
  room,
  client,
  connection,
}: {
  view: GameView;
  room: RoomView;
  client: RoomClient;
  connection: string;
}) {
  const [prefs] = usePrefs();
  useNarration(view, prefs.narration, prefs.sound, client.token);
  const mod = view.moderator;
  const name = nameFn(view);
  const act = useAction();
  const nextAct = useAction();
  const online = useMemo(() => new Set(room.members.filter((m) => m.connected).map((m) => m.id)), [room.members]);
  const phase = view.phase;
  if (!mod) return null;

  if (phase.type === 'GAME_OVER') {
    return (
      <div className="min-h-dvh">
        <PhaseBackground bg="moderator" />
        <TopBar view={view} client={client} />
        <main className="mx-auto max-w-5xl px-3 py-4">
          <GameOverView view={view} client={client} canRestart={room.you.isHost} />
        </main>
      </div>
    );
  }

  const night = mod.night;
  return (
    <div className="min-h-dvh pb-24">
      <PhaseBackground bg="moderator" dim={0.7} />
      <TopBar
        view={view}
        client={client}
        right={
          <>
            <Button asChild size="icon" variant="ghost" aria-label="Hướng dẫn cho quản trò">
              <Link href="/huong-dan#quan-tro" target="_blank">
                <CircleHelp className="h-4 w-4" />
              </Link>
            </Button>
            <Badge tone="violet">Quản trò</Badge>
          </>
        }
      />
      <StatusBanners view={view} connection={connection} />
      <main className="mx-auto grid max-w-6xl gap-3 px-3 py-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <Card title="Lời dẫn gợi ý">
            <p className="title-display text-xl leading-snug text-parchment">{narrate(view)}</p>
            {phase.type === 'NIGHT' && phase.step ? (
              <p className="mt-2 text-sm text-ash">
                {STEP_NARRATION[phase.step]} {mod.fakeStep ? <Badge className="ml-1">Bước giả — vai không còn hành động</Badge> : null}
              </p>
            ) : null}
          </Card>

          {mod.needsConfirmation ? <ConfirmPanel view={view} client={client} /> : null}

          <Card title="Trạng thái hành động">
            {mod.actionStatus.length ? (
              <ul className="space-y-1.5">
                {mod.actionStatus.map((a) => (
                  <li key={a.playerId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {a.done ? <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-label="Đã xong" /> : <Circle className="h-4 w-4 text-ash" aria-label="Chưa xong" />}
                      {name(a.playerId)} <span className="text-xs text-ash">({roleName(a.role)})</span>
                    </span>
                    <span className="text-xs text-parchment/80">{a.detail ?? (a.done ? 'Xong' : 'Đang chờ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ash">{mod.fakeStep ? 'Không có ai hành động ở bước này.' : 'Không có hành động nào cần chờ.'}</p>
            )}
          </Card>

          {night ? (
            <Card title={`Tóm tắt đêm ${night.number}`}>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-ash">Các bước</dt>
                <dd>{night.steps.map((s) => NIGHT_STEP_LABELS[s]).join(' → ')}</dd>
                <dt className="text-ash">Bảo Vệ</dt>
                <dd>{night.guardTarget ? name(night.guardTarget) : '—'}</dd>
                <dt className="text-ash">Phiếu Sói</dt>
                <dd>
                  {Object.entries(night.wolfVotes)
                    .map(([w, t]) => `${name(w)}→${t ? name(t) : 'không'}`)
                    .join(', ') || '—'}
                </dd>
                <dt className="text-ash">Mục tiêu Sói</dt>
                <dd>{night.wolfTarget ? name(night.wolfTarget) : '—'}</dd>
                <dt className="text-ash">Tiên Tri soi</dt>
                <dd>{night.seerTarget ? name(night.seerTarget) : '—'}</dd>
                <dt className="text-ash">Phù Thủy</dt>
                <dd>
                  {night.witchHeal ? 'Cứu ' : ''}
                  {night.witchPoisonTarget ? `Độc ${name(night.witchPoisonTarget)}` : ''}
                  {!night.witchHeal && !night.witchPoisonTarget ? '—' : ''}
                </dd>
              </dl>
            </Card>
          ) : null}

          <Card title="Nhật ký trận (kể cả bí mật)">
            <ol className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {[...view.timeline].reverse().map((e, i) => (
                <li key={i} className={cn(e.secret && 'text-gold-bright/90')}>
                  {describeEntry(e, name)}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-3">
          <Card title="Người chơi & vai">
            <ul className="space-y-1.5">
              {view.players.map((p) => {
                const role = mod.roles[p.id];
                const team = role ? roleTeam(role) : 'village';
                return (
                  <li key={p.id} className={cn('flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm', p.alive ? 'border-white/10' : 'border-white/5 opacity-60')}>
                    <span className="flex min-w-0 items-center gap-2">
                      {online.has(p.id) ? <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="Đang kết nối" /> : <WifiOff className="h-3.5 w-3.5 shrink-0 text-ash" aria-label="Mất kết nối" />}
                      <span className="w-5 text-xs text-ash">{p.seat}</span>
                      <span className={cn('truncate', !p.alive && 'line-through')}>{p.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn('text-xs font-semibold', TEAM_STYLE[team].text)}>{role ? ROLES[role].name : '?'}</span>
                      {!p.alive ? <Badge>{(p.deathCauses ?? []).map((c) => CAUSE_LABEL[c]).join(', ') || 'Chết'}</Badge> : null}
                      {mod.roleState.lovers?.includes(p.id) ? <Badge tone="violet">Cặp đôi</Badge> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            {(view.deck.witch ?? 0) > 0 ? (
              <p className="mt-3 text-xs text-ash">
                Phù Thủy: cứu {mod.roleState.witch.healUsed ? 'đã dùng' : 'còn'} · độc {mod.roleState.witch.poisonUsed ? 'đã dùng' : 'còn'}
              </p>
            ) : null}
          </Card>
          {mod.ballots ? (
            <Card title="Phiếu bầu (chỉ quản trò thấy)">
              <ul className="space-y-1 text-sm">
                {Object.entries(mod.ballots).map(([voter, b]) => (
                  <li key={voter}>
                    {name(voter)} → {b.targetId ? name(b.targetId) : 'trắng'} {b.locked ? <Lock className="inline h-3 w-3" aria-label="đã khóa" /> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-night-950/90 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          {view.paused ? (
            <Button variant="outline" size="sm" onClick={() => act.run(() => client.mod({ type: 'MOD_RESUME' }))}>
              <Play className="h-4 w-4" aria-hidden /> Tiếp tục
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => act.run(() => client.mod({ type: 'MOD_PAUSE' }))}>
              <Pause className="h-4 w-4" aria-hidden /> Tạm dừng
            </Button>
          )}
          <Button variant="subtle" size="sm" disabled={!phase.endsAt} onClick={() => act.run(() => client.mod({ type: 'MOD_ADJUST_TIMER', deltaSeconds: -30 }))} aria-label="Bớt 30 giây">
            <Minus className="h-4 w-4" /> 30s
          </Button>
          <Button variant="subtle" size="sm" disabled={!phase.endsAt} onClick={() => act.run(() => client.mod({ type: 'MOD_ADJUST_TIMER', deltaSeconds: 30 }))} aria-label="Thêm 30 giây">
            <Plus className="h-4 w-4" /> 30s
          </Button>
          {phase.locked ? (
            <Button variant="subtle" size="sm" onClick={() => act.run(() => client.mod({ type: 'MOD_REOPEN', seconds: 30 }))}>
              <LockOpen className="h-4 w-4" aria-hidden /> Mở lại 30s
            </Button>
          ) : (
            <Button variant="subtle" size="sm" onClick={() => act.run(() => client.mod({ type: 'MOD_LOCK' }))}>
              <Lock className="h-4 w-4" aria-hidden /> Khóa hành động
            </Button>
          )}
          <EndGameDialog client={client} />
          <div className="ml-auto flex items-center gap-2">
            <FieldError>{act.error ?? nextAct.error}</FieldError>
            <Button size="lg" disabled={!mod.canAdvance} loading={nextAct.pending} onClick={() => nextAct.run(() => client.mod({ type: 'MOD_NEXT' }))}>
              <FastForward className="h-5 w-5" aria-hidden /> {phase.type === 'VOTING' ? 'Đóng bỏ phiếu' : 'Giai đoạn tiếp'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
