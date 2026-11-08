'use client';

import { DEFAULT_TIMERS, ROLE_LIST, TIMER_LIMITS, deckSize, suggestDeck, type Deck, type RoleId, type RuleConfig, type TimerConfig } from '@masoi/engine';
import type { RoomView } from '@masoi/shared';
import { Minus, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { RoomClient } from '@/lib/roomClient';
import { TEAM_STYLE } from '@/lib/roleVisuals';
import { cn } from '@/lib/utils';
import { useAction } from './useAction';

const RULE_LABELS: [keyof RuleConfig, string, string?][] = [
  ['revealRoleOnDeath', 'Công khai vai khi chết'],
  ['deadCanSpectate', 'Người chết được quan sát'],
  ['allowVoteChange', 'Cho phép đổi phiếu trước khi khóa'],
  ['allowSkipDiscussion', 'Cho phép bỏ qua thảo luận khi mọi người đồng ý'],
  ['runoffOnTie', 'Bỏ phiếu lại khi hòa'],
  ['revealVotes', 'Công khai ai bỏ phiếu cho ai (sau khi đóng)'],
  ['allowSelfVote', 'Cho phép tự bỏ phiếu cho mình'],
  ['guardCanSelfProtect', 'Bảo Vệ được tự bảo vệ'],
  ['guardSameTargetConsecutive', 'Bảo Vệ được che cùng một người 2 đêm liền'],
  ['witchCanSelfHeal', 'Phù Thủy được tự cứu'],
  ['witchBothPotionsSameNight', 'Phù Thủy được dùng 2 bình cùng đêm'],
  ['wolvesCanTargetWolves', 'Sói được cắn đồng loại'],
  ['deadSeeAllRoles', 'Người chết thấy toàn bộ vai'],
  ['enableAdvancedRoles', 'Bật vai nâng cao (Cupid, Già Làng, Sói Trắng)'],
];

const TIMER_LABELS: [keyof TimerConfig, string][] = [
  ['roleReveal', 'Xem vai'],
  ['guard', 'Bảo Vệ'],
  ['werewolves', 'Bầy Sói'],
  ['seer', 'Tiên Tri'],
  ['witch', 'Phù Thủy'],
  ['cupid', 'Cupid'],
  ['whiteWolf', 'Sói Trắng'],
  ['dawn', 'Bình minh'],
  ['hunter', 'Thợ Săn'],
  ['discussion', 'Thảo luận'],
  ['voting', 'Bỏ phiếu'],
  ['runoff', 'Bỏ phiếu lại'],
  ['voteResult', 'Kết quả phiếu'],
];

export function RoomSettingsPanel({ room, client }: { room: RoomView; client: RoomClient }) {
  const editable = room.you.isHost && room.status === 'LOBBY';
  const { run, error, pending } = useAction();
  const s = room.settings;
  const playerCount = room.members.filter((m) => m.kind === 'PLAYER' && !m.left).length;
  const auto = deckSize(s.deck) === 0;
  const deck: Deck = auto ? suggestDeck(Math.max(4, playerCount)) : s.deck;
  const [tab, setTab] = useState<'deck' | 'rules' | 'timers'>('deck');

  const setCount = (role: RoleId, delta: number) => {
    const next: Deck = { ...deck, [role]: Math.max(0, (deck[role] ?? 0) + delta) };
    void run(() => client.updateSettings({ deck: next }));
  };

  return (
    <section className="panel p-4" aria-labelledby="settings-title">
      <div className="flex items-center justify-between">
        <h2 id="settings-title" className="title-display text-2xl font-semibold text-gold-bright">
          Thiết lập trận
        </h2>
        {!editable ? <span className="text-xs text-ash">Chỉ chủ phòng chỉnh được</span> : null}
      </div>
      <div className="mt-3 flex gap-1 rounded-xl bg-night-950/60 p-1" role="tablist">
        {(
          [
            ['deck', 'Bộ vai'],
            ['rules', 'Luật'],
            ['timers', 'Thời gian'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-medium', tab === id ? 'bg-gold/15 text-gold-bright' : 'text-ash hover:text-parchment')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'deck' ? (
        <div className="mt-4" role="tabpanel">
          <div className="mb-3 flex items-center justify-between gap-2 text-sm">
            <span>
              Tổng: <strong className={cn(deckSize(deck) === playerCount ? 'text-emerald-300' : 'text-blood-bright')}>{deckSize(deck)}</strong> /{' '}
              {playerCount} người chơi
            </span>
            {editable ? (
              <Button size="sm" variant={auto ? 'outline' : 'subtle'} onClick={() => run(() => client.updateSettings({ deck: {} }))} disabled={auto || pending}>
                <Sparkles className="h-4 w-4" aria-hidden /> {auto ? 'Đang tự động' : 'Tự động theo số người'}
              </Button>
            ) : auto ? (
              <span className="text-xs text-ash">Tự động theo số người</span>
            ) : null}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ROLE_LIST.filter((r) => !r.advanced || s.rules.enableAdvancedRoles || (deck[r.id] ?? 0) > 0).map((r) => {
              const n = deck[r.id] ?? 0;
              return (
                <li key={r.id} className={cn('flex items-center justify-between rounded-xl border bg-night-950/40 px-3 py-2', n > 0 ? TEAM_STYLE[r.team].ring : 'border-white/10')}>
                  <span className="text-sm">
                    <span className={cn('font-semibold', TEAM_STYLE[r.team].text)}>{r.name}</span>
                    {r.advanced ? <span className="ml-1 text-[10px] uppercase text-ash">nâng cao</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {editable ? (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCount(r.id, -1)} disabled={n === 0 || pending} aria-label={`Bớt ${r.name}`}>
                        <Minus className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <span className="w-5 text-center font-mono tabular-nums" aria-label={`${n} ${r.name}`}>
                      {n}
                    </span>
                    {editable ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setCount(r.id, 1)}
                        disabled={pending || (r.maxCount !== null && n >= r.maxCount)}
                        aria-label={`Thêm ${r.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {tab === 'rules' ? (
        <ul className="mt-4 space-y-2" role="tabpanel">
          <li className="flex items-center justify-between gap-3 rounded-xl bg-night-950/40 px-3 py-2.5">
            <label htmlFor="r-spectators" className="text-sm">Cho phép người xem</label>
            <Switch id="r-spectators" checked={s.allowSpectators} disabled={!editable || pending} onCheckedChange={(v) => run(() => client.updateSettings({ allowSpectators: v }))} />
          </li>
          <li className="flex items-center justify-between gap-3 rounded-xl bg-night-950/40 px-3 py-2.5">
            <label htmlFor="r-rejoin" className="text-sm">Cho phép vào lại phòng sau khi rời</label>
            <Switch id="r-rejoin" checked={s.allowRejoin} disabled={!editable || pending} onCheckedChange={(v) => run(() => client.updateSettings({ allowRejoin: v }))} />
          </li>
          {RULE_LABELS.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-3 rounded-xl bg-night-950/40 px-3 py-2.5">
              <label htmlFor={`r-${key}`} className="text-sm">{label}</label>
              <Switch
                id={`r-${key}`}
                checked={Boolean(s.rules[key])}
                disabled={!editable || pending}
                onCheckedChange={(v) => run(() => client.updateSettings({ rules: { [key]: v } }))}
              />
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 rounded-xl bg-night-950/40 px-3 py-2.5">
            <label htmlFor="r-tie" className="text-sm">Sói hòa phiếu</label>
            <select
              id="r-tie"
              value={s.rules.wolfTiePolicy}
              disabled={!editable || pending}
              onChange={(e) => run(() => client.updateSettings({ rules: { wolfTiePolicy: e.target.value as 'random' | 'no_kill' } }))}
              className="rounded-lg border border-gold/25 bg-night-950 px-2 py-1 text-sm"
            >
              <option value="random">Chọn ngẫu nhiên</option>
              <option value="no_kill">Không giết ai</option>
            </select>
          </li>
        </ul>
      ) : null}

      {tab === 'timers' ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2" role="tabpanel">
          {TIMER_LABELS.map(([key, label]) => {
            const [min, max] = TIMER_LIMITS[key];
            return (
              <li key={key} className="flex items-center justify-between gap-3 rounded-xl bg-night-950/40 px-3 py-2">
                <label htmlFor={`t-${key}`} className="text-sm">{label}</label>
                <span className="flex items-center gap-1">
                  <input
                    id={`t-${key}`}
                    type="number"
                    min={min}
                    max={max}
                    defaultValue={s.timers[key] ?? DEFAULT_TIMERS[key]}
                    key={`${key}-${s.timers[key]}`}
                    disabled={!editable}
                    onBlur={(e) => {
                      const v = Math.min(max, Math.max(min, Number(e.target.value) || DEFAULT_TIMERS[key]));
                      if (v !== s.timers[key]) void run(() => client.updateSettings({ timers: { [key]: v } }));
                    }}
                    className="w-20 rounded-lg border border-gold/25 bg-night-950 px-2 py-1 text-right font-mono text-sm tabular-nums"
                  />
                  <span className="text-xs text-ash">giây</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <FieldError>{error}</FieldError>
    </section>
  );
}
