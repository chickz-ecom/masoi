'use client';

import { Check, Copy, QrCode, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function InvitePanel({ code }: { code: string }) {
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/r/${code}`;
    setUrl(link);
    QRCode.toDataURL(link, { margin: 1, width: 320, color: { dark: '#0a0c16', light: '#efe7d3' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : url);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="panel p-4" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-xs uppercase tracking-[0.3em] text-ash">
        Mời bạn bè
      </h2>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => copy('code')}
          className="title-display text-left font-mono text-4xl font-bold tracking-[0.3em] text-gold-bright"
          aria-label={`Mã phòng ${code.split('').join(' ')}. Nhấn để sao chép`}
        >
          {code}
        </button>
        <div className="flex gap-1.5">
          <Button size="icon" variant="subtle" onClick={() => copy('link')} aria-label="Sao chép link mời">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="subtle" onClick={() => setShowQr((v) => !v)} aria-label="Hiện mã QR" aria-expanded={showQr}>
            <QrCode className="h-4 w-4" />
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <Button
              size="icon"
              variant="subtle"
              aria-label="Chia sẻ"
              onClick={() => navigator.share({ title: 'Vào chơi Ma Sói!', url }).catch(() => undefined)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 truncate text-xs text-ash">{copied ? (copied === 'code' ? 'Đã sao chép mã phòng' : 'Đã sao chép link mời') : url}</p>
      {showQr && qr ? (
        <img src={qr} alt={`Mã QR để vào phòng ${code}`} width={320} height={320} className="mx-auto mt-3 w-48 rounded-xl" />
      ) : null}
    </section>
  );
}
