'use client';

import type { GameView } from '@masoi/engine';
import { CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { contextualHelp, ROLE_GUIDE } from '@/lib/guide';
import { roleName } from '@/lib/roleVisuals';

/** In-game "what do I do now?" help, specific to the current phase and the player's role. */
export function HelpDialog({ view }: { view: GameView }) {
  const help = contextualHelp(view);
  const me = view.me;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Hướng dẫn: bây giờ tôi làm gì?">
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent title={help.title} description="Bây giờ bạn cần làm gì?">
        <ul className="space-y-2 text-sm leading-relaxed">
          {help.lines.map((l) => (
            <li key={l} className="rounded-lg bg-night-950/50 px-3 py-2">
              {l}
            </li>
          ))}
        </ul>
        {me ? (
          <div className="mt-4 rounded-xl border border-gold/20 p-3 text-sm">
            <p className="font-semibold text-gold-bright">Mẹo cho {roleName(me.role)}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-parchment/80">
              {ROLE_GUIDE[me.role].tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Link href="/huong-dan" target="_blank" className="mt-4 inline-block text-sm text-gold-bright underline-offset-4 hover:underline">
          Xem hướng dẫn đầy đủ ↗
        </Link>
      </DialogContent>
    </Dialog>
  );
}
