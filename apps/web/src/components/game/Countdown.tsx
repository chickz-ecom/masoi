'use client';

import { useEffect, useRef, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { playCue } from '@/lib/sound';
import { cn } from '@/lib/utils';

/** Countdown driven by the server deadline (endsAt) and the measured clock offset. */
export function Countdown({
  endsAt,
  now,
  warnAt = 10,
  sound = false,
  label = 'Thời gian còn lại',
  className,
}: {
  endsAt: number | null;
  now: () => number;
  warnAt?: number;
  sound?: boolean;
  label?: string;
  className?: string;
}) {
  const [left, setLeft] = useState(() => (endsAt ? Math.max(0, endsAt - now()) : null));
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    const update = () => {
      const ms = Math.max(0, endsAt - now());
      setLeft(ms);
      const s = Math.ceil(ms / 1000);
      if (sound && s <= 5 && s > 0 && lastTick.current !== s) {
        lastTick.current = s;
        playCue('tick');
      }
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [endsAt, now, sound]);

  if (left === null) return null;
  const secs = Math.ceil(left / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const warn = secs <= warnAt;
  return (
    <div
      role="timer"
      aria-label={`${label}: ${secs} giây`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm tabular-nums',
        warn ? 'border-blood-bright/60 bg-blood/25 text-[#ffb3bc]' : 'border-gold/30 bg-night-950/50 text-gold-bright',
        className,
      )}
    >
      <Hourglass className={cn('h-3.5 w-3.5', warn && 'animate-pulse')} aria-hidden />
      {mm}:{ss}
      {warn ? <span className="sr-only">Sắp hết giờ</span> : null}
    </div>
  );
}
