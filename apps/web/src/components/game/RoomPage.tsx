'use client';

import type { RoomPublicInfo } from '@masoi/shared';
import { DoorOpen, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { RoomClient } from '@/lib/roomClient';
import { clearSession, getSession, saveSession, type StoredSession } from '@/lib/session';
import { GameScreen } from './GameScreen';
import { Lobby } from './Lobby';
import { ModeratorDashboard } from './ModeratorDashboard';
import { PhaseBackground } from './PhaseBackground';

function FullScreenMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <PhaseBackground bg="landing" dim={0.6} />
      <h1 className="title-display gold-text text-4xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (s: StoredSession) => void }) {
  const [info, setInfo] = useState<RoomPublicInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.roomInfo(code).then(setInfo, (e: unknown) => setLoadError(e instanceof ApiError ? e.message : 'Không tải được phòng.'));
  }, [code]);

  const join = async (asSpectator: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.joinRoom(code, { nickname, asSpectator });
      saveSession(s, nickname.trim());
      onJoined({ ...s, nickname: nickname.trim(), savedAt: Date.now() });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không vào được phòng.');
      setLoading(false);
    }
  };

  if (loadError) {
    return (
      <FullScreenMessage title="Không tìm thấy phòng">
        <p className="text-ash">{loadError}</p>
        <Button asChild variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </FullScreenMessage>
    );
  }
  if (!info) return <FullScreenMessage title="Đang mở cửa làng…"><Loader2 className="h-6 w-6 animate-spin text-gold" aria-label="Đang tải" /></FullScreenMessage>;

  const canPlay = info.status === 'LOBBY' && info.playerCount < info.maxPlayers;
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <PhaseBackground bg="landing" dim={0.55} />
      <form
        className="panel ornate space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void join(!canPlay);
        }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-ash">Lời mời vào làng</p>
        <h1 className="title-display gold-text text-4xl font-bold">{info.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge tone="gold">{info.mode === 'AUTO' ? 'Quản trò tự động' : 'Có quản trò'}</Badge>
          <Badge>
            {info.playerCount}/{info.maxPlayers} người chơi
          </Badge>
          {info.status === 'IN_GAME' ? <Badge tone="blood">Đang chơi</Badge> : null}
          <Badge className="font-mono tracking-widest">{info.code}</Badge>
        </div>
        <div>
          <Label htmlFor="nick">Nickname</Label>
          <Input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} autoFocus autoComplete="nickname" placeholder="Tên hiển thị trong làng" />
        </div>
        <FieldError>{error}</FieldError>
        {canPlay ? (
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={nickname.trim().length < 2}>
            <DoorOpen className="h-5 w-5" aria-hidden /> Vào làng
          </Button>
        ) : (
          <p className="text-sm text-ash">{info.status === 'IN_GAME' ? 'Trận đấu đang diễn ra.' : 'Phòng đã đủ người.'}</p>
        )}
        {info.allowSpectators ? (
          <Button type="button" variant="outline" className="w-full" disabled={nickname.trim().length < 2 || loading} onClick={() => join(true)}>
            <Eye className="h-4 w-4" aria-hidden /> Vào xem
          </Button>
        ) : null}
      </form>
    </main>
  );
}

function ConnectedRoom({ session, onExit }: { session: StoredSession; onExit: (clear: boolean) => void }) {
  const client = useMemo(() => new RoomClient(session.token), [session.token]);
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, [client]);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);

  if (state.status === 'revoked') {
    return (
      <FullScreenMessage title="Phiên đã kết thúc">
        <p className="text-ash">{state.error ?? 'Bạn không còn ở trong phòng này.'}</p>
        <Button onClick={() => onExit(true)}>Về trang chủ</Button>
      </FullScreenMessage>
    );
  }
  if (!state.room) {
    return (
      <FullScreenMessage title={state.status === 'error' ? 'Không kết nối được' : 'Đang kết nối…'}>
        {state.error ? <p className="text-ash">{state.error}</p> : <Loader2 className="h-6 w-6 animate-spin text-gold" aria-label="Đang kết nối" />}
      </FullScreenMessage>
    );
  }
  const room = state.room;
  const game = state.game;
  if (room.status === 'IN_GAME' && game) {
    if (game.view.viewer === 'moderator') {
      return <ModeratorDashboard view={game.view} room={room} client={client} connection={state.status} />;
    }
    return <GameScreen view={game.view} room={room} client={client} connection={state.status} events={state.events} onLeave={() => onExit(true)} />;
  }
  return <Lobby room={room} client={client} onLeave={() => onExit(true)} />;
}

export function RoomPage({ code }: { code: string }) {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  useEffect(() => setSession(getSession(code)), [code]);

  if (session === undefined) return <FullScreenMessage title="Đang mở cửa làng…" />;
  if (!session) return <JoinForm code={code} onJoined={setSession} />;
  return (
    <ConnectedRoom
      session={session}
      onExit={(clear) => {
        if (clear) clearSession(code);
        router.push('/');
      }}
    />
  );
}
