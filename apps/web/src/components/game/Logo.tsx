import { LOGO } from '@/lib/assets';
import { cn } from '@/lib/utils';
import { GameImage } from './GameImage';

export function LogoEmblem({ className }: { className?: string }) {
  return (
    <GameImage
      asset={LOGO}
      priority
      className={cn('h-full w-full object-contain', className)}
      fallback={
        <svg viewBox="0 0 100 100" className={cn('h-full w-full text-gold', className)} aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
          <path d="M60 18a32 32 0 1 0 24 44A26 26 0 1 1 60 18z" fill="currentColor" opacity="0.9" />
          <path d="M36 62l6-14 4 6 4-10 4 10 4-6 6 14z" fill="#0a0c16" opacity="0.8" />
        </svg>
      }
    />
  );
}

export function Wordmark({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex flex-col items-center">
      <h1 className={cn('title-display gold-text font-bold leading-none', size === 'lg' ? 'text-6xl sm:text-7xl' : 'text-4xl')}>Ma Sói</h1>
      <p className="mt-2 text-[11px] uppercase tracking-[0.45em] text-ash">Online</p>
    </div>
  );
}
