'use client';

import { ROLES, type RoleId } from '@masoi/engine';
import { motion, useReducedMotion } from 'motion/react';
import { CARD_BACK, ROLE_CARDS } from '@/lib/assets';
import { ROLE_GLYPH, TEAM_LABEL, TEAM_STYLE } from '@/lib/roleVisuals';
import { cn } from '@/lib/utils';
import { GameImage } from './GameImage';

function CardBackFace() {
  return (
    <GameImage
      asset={CARD_BACK}
      priority
      className="h-full w-full object-cover"
      fallback={
        <div className="relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#2a1f4d,#0a0c16_70%)]">
          <div className="absolute inset-3 rounded-xl border border-gold/40" />
          <div className="absolute inset-5 rounded-lg border border-gold/15" />
          <svg viewBox="0 0 100 100" className="h-1/2 w-1/2 text-gold/80" aria-hidden>
            <path d="M58 12a38 38 0 1 0 30 52A30 30 0 1 1 58 12z" fill="currentColor" opacity="0.85" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          </svg>
          <span className="absolute bottom-4 text-[10px] uppercase tracking-[0.3em] text-ash/50">placeholder</span>
        </div>
      }
    />
  );
}

export function RoleArt({ role, className }: { role: RoleId; className?: string }) {
  const def = ROLES[role];
  const style = TEAM_STYLE[def.team];
  const Glyph = ROLE_GLYPH[role];
  return (
    <GameImage
      asset={ROLE_CARDS[role]}
      sizes="(max-width: 640px) 70vw, 320px"
      className={cn('h-full w-full object-cover object-top', className)}
      fallback={
        <div className={cn('relative flex h-full w-full items-start justify-center bg-gradient-to-b to-night-950 pt-[18%]', style.from)}>
          <Glyph className={cn('h-2/5 w-2/5 opacity-80', style.text)} strokeWidth={1.1} aria-hidden />
          <span className="absolute left-2 top-2 rounded bg-black/40 px-1 py-0.5 text-[8px] uppercase tracking-wide text-ash/60">
            placeholder
          </span>
        </div>
      }
    />
  );
}

/**
 * Premium role card: artwork + HTML-rendered name/ability (never baked into art), team-colored frame.
 * `revealed=false` shows the card back; flipping animates in 3D (disabled with reduced motion).
 */
export function RoleCard({
  role,
  revealed,
  onFlip,
  size = 'lg',
  className,
}: {
  role: RoleId | null;
  revealed: boolean;
  onFlip?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const reduce = useReducedMotion();
  const def = role ? ROLES[role] : null;
  const style = def ? TEAM_STYLE[def.team] : TEAM_STYLE.village;
  const widths = { sm: 'w-28', md: 'w-44', lg: 'w-[min(72vw,300px)]' } as const;
  const interactive = Boolean(onFlip);
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={onFlip}
      aria-label={interactive ? (revealed ? `Vai của bạn: ${def?.name}` : 'Lật bài để xem vai') : undefined}
      className={cn('group relative aspect-[2/3] [perspective:1200px]', widths[size], interactive && 'cursor-pointer', className)}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-gold/40 shadow-2xl [backface-visibility:hidden]">
          <CardBackFace />
          {interactive && !revealed ? (
            <span className="absolute inset-x-0 bottom-6 text-center text-sm font-medium text-gold-bright/90">Chạm để lật bài</span>
          ) : null}
        </div>
        <div
          className={cn(
            'absolute inset-0 overflow-hidden rounded-2xl border-2 bg-night-950 [backface-visibility:hidden] [transform:rotateY(180deg)]',
            style.ring,
            style.glow,
          )}
        >
          {role && def ? (
            <>
              <RoleArt role={role} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-950 via-night-950/90 to-transparent px-3 pb-3 pt-10 text-left">
                <p className={cn('text-[10px] font-semibold uppercase tracking-[0.25em]', style.text)}>{TEAM_LABEL[def.team]}</p>
                <h3 className={cn('title-display font-bold leading-tight text-parchment', size === 'sm' ? 'text-lg' : 'text-3xl')}>{def.name}</h3>
                {size !== 'sm' ? <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-parchment/80">{def.ability}</p> : null}
              </div>
              <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/10" />
            </>
          ) : null}
        </div>
      </motion.div>
    </Wrapper>
  );
}
