'use client';

import { ArrowLeft, Bot, Crown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PhaseBackground } from '@/components/game/PhaseBackground';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { saveSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const MODES = [
  {
    id: 'AUTO' as const,
    icon: Bot,
    title: 'Quản trò tự động',
    desc: 'Tất cả mọi người đều chơi. Hệ thống chia vai, dẫn truyện, hẹn giờ và xử lý kết quả.',
  },
  {
    id: 'HUMAN' as const,
    icon: Crown,
    title: 'Có quản trò',
    desc: 'Bạn làm quản trò: xem toàn bộ vai, điều khiển ngày/đêm và xác nhận kết quả.',
  },
];

export default function CreateRoomPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [name, setName] = useState('Làng Sương Mù');
  const [mode, setMode] = useState<'AUTO' | 'HUMAN'>('AUTO');
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await api.createRoom({ nickname, name, mode, maxPlayers });
      saveSession(session, nickname.trim());
      router.push(`/r/${session.roomCode}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo phòng.');
      setLoading(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8">
      <PhaseBackground bg="landing" dim={0.6} />
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-ash hover:text-parchment">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Trang chủ
      </Link>
      <h1 className="title-display gold-text text-4xl font-bold">Tạo phòng</h1>
      <p className="mt-1 text-sm text-ash">Bộ vai, thời gian và luật chi tiết có thể chỉnh trong phòng chờ.</p>

      <form onSubmit={submit} className="panel ornate mt-6 space-y-5 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-parchment/85">Chế độ chơi</legend>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all',
                  mode === m.id ? 'border-gold bg-gold/10 shadow-[0_0_24px_-8px_rgb(201_162_92/0.7)]' : 'border-white/10 bg-night-950/40 hover:border-gold/40',
                )}
              >
                <m.icon className={cn('h-6 w-6', mode === m.id ? 'text-gold-bright' : 'text-ash')} aria-hidden />
                <p className="mt-2 font-semibold">{m.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ash">{m.desc}</p>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="nickname">{mode === 'HUMAN' ? 'Tên quản trò' : 'Nickname của bạn'}</Label>
          <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} required minLength={2} autoComplete="nickname" placeholder="VD: Tiếp" />
        </div>
        <div>
          <Label htmlFor="room-name">Tên phòng</Label>
          <Input id="room-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        </div>
        <div>
          <Label htmlFor="max-players">Số người chơi tối đa: {maxPlayers}</Label>
          <input
            id="max-players"
            type="range"
            min={4}
            max={20}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full accent-[var(--color-gold)]"
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={nickname.trim().length < 2}>
          Tạo phòng
        </Button>
      </form>
    </main>
  );
}
