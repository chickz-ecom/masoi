'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PhaseBackground } from '@/components/game/PhaseBackground';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <PhaseBackground bg="landing" dim={0.6} />
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-ash hover:text-parchment">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Trang chủ
      </Link>
      <form
        className="panel ornate space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) router.push(`/r/${code}`);
        }}
      >
        <h1 className="title-display gold-text text-4xl font-bold">Vào phòng</h1>
        <div>
          <Label htmlFor="code">Mã phòng</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            className="text-center font-mono text-xl tracking-[0.4em]"
            autoComplete="off"
            autoFocus
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6}>
          Tiếp tục
        </Button>
      </form>
    </main>
  );
}
