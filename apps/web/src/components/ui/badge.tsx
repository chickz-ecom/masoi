import { cn } from '@/lib/utils';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'gold' | 'blood' | 'violet' | 'green' }) {
  const tones = {
    neutral: 'border-white/15 bg-white/5 text-parchment/80',
    gold: 'border-gold/40 bg-gold/10 text-gold-bright',
    blood: 'border-blood-bright/40 bg-blood/20 text-[#ff9aa5]',
    violet: 'border-team-special/40 bg-team-special/10 text-[#d7c6ff]',
    green: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  } as const;
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}
      {...props}
    />
  );
}
