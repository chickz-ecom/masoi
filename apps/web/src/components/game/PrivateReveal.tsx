'use client';

import type { GameView, RoleId } from '@masoi/engine';
import type { ServerEvent } from '@masoi/shared';
import { Eye, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { roleName } from '@/lib/roleVisuals';
import { nameFn } from './timelineText';

type Reveal = { kind: 'SEER'; targetId: string; isWolf: boolean } | { kind: 'LOVER'; partnerId: string; partnerRole: RoleId };

/**
 * Private, persistent pop-ups for secret information (seer result, lovers). In AUTO mode the night
 * may move on immediately after the action, so the result must not live only inside the step UI.
 */
export function PrivateReveal({ events, view }: { events: ServerEvent[]; view: GameView }) {
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [queue, setQueue] = useState<Reveal[]>([]);
  const name = nameFn(view);

  useEffect(() => {
    // Don't replay events received before this screen mounted.
    if (!initialized.current) {
      events.forEach((e) => seen.current.add(e.id));
      initialized.current = true;
      return;
    }
    const fresh: Reveal[] = [];
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (e.type === 'SEER_RESULT') fresh.push({ kind: 'SEER', targetId: String(e.payload.targetId), isWolf: Boolean(e.payload.isWolf) });
      if (e.type === 'LOVERS_LINKED') fresh.push({ kind: 'LOVER', partnerId: String(e.payload.partnerId), partnerRole: e.payload.partnerRole as RoleId });
    }
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [events]);

  const current = queue[0];
  const close = () => setQueue((q) => q.slice(1));
  if (!current) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent title={current.kind === 'SEER' ? 'Quả cầu pha lê' : 'Mũi tên của Cupid'} description="Chỉ mình bạn nhìn thấy thông tin này.">
        {current.kind === 'SEER' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Eye className="h-12 w-12 text-moon" aria-hidden />
            <p className="text-lg">
              <strong>{name(current.targetId)}</strong>{' '}
              {current.isWolf ? <strong className="text-blood-bright">thuộc phe Sói</strong> : <strong className="text-emerald-200">không phải Sói</strong>}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <Heart className="h-12 w-12 text-pink-300" aria-hidden />
            <p className="text-lg">
              Bạn đã được ghép đôi với <strong>{name(current.partnerId)}</strong> ({roleName(current.partnerRole)}). Một người chết, người kia chết theo.
            </p>
          </div>
        )}
        <Button className="mt-5 w-full" onClick={close}>
          Đã ghi nhớ
        </Button>
      </DialogContent>
    </Dialog>
  );
}
