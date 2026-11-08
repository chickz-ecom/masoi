'use client';

import type { PlayerView } from '@masoi/engine';
import { Check, Heart, Skull, WifiOff } from 'lucide-react';
import { ROLE_GLYPH, roleName, roleTeam, TEAM_STYLE } from '@/lib/roleVisuals';
import { cn } from '@/lib/utils';

/**
 * A player seat. State is conveyed with icons + text, not color alone:
 * dead (skull + "Đã chết"), selected (check), teammate (paw), lover (heart), offline.
 */
export function PlayerToken({
  player,
  selected,
  selectable,
  onSelect,
  badge,
  offline,
  showRole = true,
}: {
  player: PlayerView;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  badge?: React.ReactNode;
  offline?: boolean;
  showRole?: boolean;
}) {
  const role = showRole ? player.role : null;
  const team = role ? roleTeam(role) : null;
  const Glyph = role ? ROLE_GLYPH[role] : null;
  const Comp = selectable ? 'button' : 'div';
  return (
    <Comp
      type={selectable ? 'button' : undefined}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      aria-label={`${player.name}${player.alive ? '' : ', đã chết'}${role ? `, ${roleName(role)}` : ''}${selected ? ', đang chọn' : ''}`}
      className={cn(
        'relative flex min-h-[92px] w-full flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition-all',
        player.alive ? 'border-white/10 bg-night-900/70' : 'border-white/5 bg-night-950/70 opacity-60',
        selectable && 'hover:border-gold/60 hover:bg-night-800/80 active:scale-[0.97]',
        selected && 'border-gold bg-gold/15 shadow-[0_0_24px_-6px_rgb(201_162_92/0.7)]',
        player.isMe && !selected && 'border-gold/35',
      )}
    >
      <span
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-full border-2 bg-night-800 text-sm font-bold',
          team ? TEAM_STYLE[team].ring : 'border-gold/30',
        )}
      >
        {!player.alive ? (
          <Skull className="h-5 w-5 text-ash" aria-hidden />
        ) : Glyph ? (
          <Glyph className={cn('h-5 w-5', team && TEAM_STYLE[team].text)} aria-hidden />
        ) : (
          <span className="text-parchment/80">{player.seat}</span>
        )}
        {selected ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-night-950">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className={cn('max-w-full truncate text-[13px] font-medium', !player.alive && 'line-through decoration-ash/70')}>
        {player.name}
        {player.isMe ? <span className="text-gold-bright"> (bạn)</span> : null}
      </span>
      <span className="flex flex-wrap items-center justify-center gap-1 text-[11px] text-ash">
        {!player.alive ? <span>Đã chết</span> : null}
        {role ? <span className={cn(team && TEAM_STYLE[team].text)}>{roleName(role)}</span> : null}
        {player.isTeammate ? <span className="text-team-werewolf">· đồng đội</span> : null}
        {player.isLover ? (
          <span className="inline-flex items-center gap-0.5 text-pink-300">
            <Heart className="h-3 w-3" aria-hidden /> người yêu
          </span>
        ) : null}
        {offline ? (
          <span className="inline-flex items-center gap-0.5">
            <WifiOff className="h-3 w-3" aria-hidden /> mất kết nối
          </span>
        ) : null}
      </span>
      {badge ? <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">{badge}</span> : null}
    </Comp>
  );
}

export function PlayerGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">{children}</div>;
}
