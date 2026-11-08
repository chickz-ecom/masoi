import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="title-display gold-text text-6xl font-bold">404</p>
      <p className="text-parchment/80">Con đường này lạc vào rừng sâu…</p>
      <Button asChild variant="outline">
        <Link href="/">Về làng</Link>
      </Button>
    </main>
  );
}
