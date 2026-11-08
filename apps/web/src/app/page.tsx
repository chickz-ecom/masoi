'use client';

import { BookOpen, CircleHelp, DoorOpen, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoEmblem, Wordmark } from '@/components/game/Logo';
import { PhaseBackground } from '@/components/game/PhaseBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recentSessions, type StoredSession } from '@/lib/session';

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [recent, setRecent] = useState<StoredSession[]>([]);
  useEffect(() => setRecent(recentSessions().slice(0, 3)), []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length === 6) router.push(`/r/${c}`);
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <PhaseBackground bg="landing" dim={0.35} />
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="h-28 w-28 drop-shadow-[0_0_30px_rgb(201_162_92/0.35)]">
          <LogoEmblem />
        </div>
        <div className="mt-4">
          <Wordmark />
        </div>
        <p className="mt-5 max-w-sm text-balance text-parchment/80">
          Khi màn đêm buông xuống, ai sẽ sống sót? Tụ họp bạn bè, nhận vai bí mật và lật mặt bầy Sói.
        </p>

        <div className="panel ornate mt-8 w-full space-y-4 p-5">
          <Button asChild size="lg" className="w-full">
            <Link href="/create">
              <PlusCircle className="h-5 w-5" aria-hidden /> Tạo phòng mới
            </Link>
          </Button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ash">
            <span className="divider-ornament flex-1" /> hoặc <span className="divider-ornament flex-1" />
          </div>
          <form onSubmit={go} className="flex gap-2" aria-label="Vào phòng bằng mã">
            <label htmlFor="room-code" className="sr-only">
              Mã phòng
            </label>
            <Input
              id="room-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="Mã phòng (6 ký tự)"
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              className="text-center font-mono text-lg tracking-[0.35em]"
            />
            <Button type="submit" variant="outline" size="lg" disabled={code.length !== 6} aria-label="Vào phòng">
              <DoorOpen className="h-5 w-5" aria-hidden />
            </Button>
          </form>
        </div>

        {recent.length > 0 ? (
          <div className="mt-6 w-full text-left">
            <p className="mb-2 text-xs uppercase tracking-widest text-ash">Phòng gần đây</p>
            <ul className="space-y-2">
              {recent.map((s) => (
                <li key={s.roomCode}>
                  <Link
                    href={`/r/${s.roomCode}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-night-900/60 px-4 py-3 text-sm hover:border-gold/40"
                  >
                    <span className="font-mono tracking-widest text-gold-bright">{s.roomCode}</span>
                    <span className="text-ash">{s.nickname}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/huong-dan" className="inline-flex items-center gap-2 font-medium text-gold-bright hover:underline">
            <CircleHelp className="h-4 w-4" aria-hidden /> Hướng dẫn chơi cho người mới
          </Link>
          <Link href="/rules" className="inline-flex items-center gap-2 text-ash hover:text-gold-bright">
            <BookOpen className="h-4 w-4" aria-hidden /> Luật chơi & các vai
          </Link>
        </div>
      </div>
    </main>
  );
}
