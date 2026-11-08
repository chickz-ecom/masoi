'use client';

import type { GameView } from '@masoi/engine';
import { PHASE_TITLES, narrate, stepLabel, type RoomView, type ServerEvent } from '@masoi/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { History, IdCard, LogOut, Pause, Skull, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import type { BackgroundKey } from '@/lib/assets';
import { serverTtsAvailable, speakView, speechSupported, stopSpeaking } from '@/lib/narration';
import type { RoomClient } from '@/lib/roomClient';
import { playCue, unlockAudio } from '@/lib/sound';
import { usePrefs } from '@/lib/usePrefs';
import { cn } from '@/lib/utils';
import { Countdown } from './Countdown';
import { PhaseBackground } from './PhaseBackground';
import {
  DawnView,
  DiscussionView,
  GameOverView,
  HunterView,
  NightView,
  RoleRevealView,
  VoteResultView,
  VotingView,
} from './PhaseViews';
import { HelpDialog } from './HelpDialog';
import { PrivateReveal } from './PrivateReveal';
import { RoleCard } from './RoleCard';
import { describeEntry, nameFn } from './timelineText';

export function backgroundFor(view: GameView): BackgroundKey {
  switch (view.phase.type) {
    case 'ROLE_REVEAL':
      return 'role-reveal';
    case 'NIGHT':
      return 'night';
    case 'DAWN':
      return view.phase.announcedDeaths.length ? 'elimination' : 'day';
    case 'HUNTER_SHOT':
      return 'elimination';
    case 'DAY_DISCUSSION':
      return 'discussion';
    case 'VOTING':
      return 'voting';
    case 'VOTE_RESULT':
      return view.phase.eliminatedId ? 'elimination' : 'voting';
    case 'GAME_OVER':
      return view.winner === 'WEREWOLF' || view.winner === 'WHITE_WOLF' ? 'victory-werewolf' : 'victory-village';
  }
}

/** Speaks narration and plays cues when the phase (or its confirmed state) changes. */
export function useNarration(view: GameView, enabled: boolean, sound: boolean, token?: string) {
  const lastKey = useRef<string | null>(null);
  const lastType = useRef<string | null>(null);
  const key = `${view.phase.id}:${view.phase.confirmed}:${view.phase.hunterResolved}`;
  useEffect(() => {
    if (lastKey.current === key) return;
    const first = lastKey.current === null;
    lastKey.current = key;
    const prevType = lastType.current;
    lastType.current = view.phase.type;
    if (first) return;
    if (sound) {
      if (view.phase.type === 'NIGHT' && prevType !== 'NIGHT') playCue('night');
      else if (view.phase.type === 'DAWN' && view.phase.confirmed) playCue(view.phase.announcedDeaths.length ? 'death' : 'day');
      else if (view.phase.type === 'VOTING') playCue('vote');
      else if (view.phase.type === 'GAME_OVER') playCue('victory');
    }
    if (enabled) void speakView(view, token);
  }, [key, view, enabled, sound, token]);
  useEffect(() => () => stopSpeaking(), []);
}

export function TopBar({
  view,
  client,
  right,
}: {
  view: GameView;
  client: RoomClient;
  right?: React.ReactNode;
}) {
  const [prefs, setPrefs] = usePrefs();
  const [narrationAvailable, setNarrationAvailable] = useState(() => speechSupported());
  useEffect(() => {
    void serverTtsAvailable().then((ok) => ok && setNarrationAvailable(true));
  }, []);
  const phase = view.phase;
  const title = phase.type === 'NIGHT' ? `Đêm ${view.nightNumber} · ${stepLabel(phase.step)}` : PHASE_TITLES[phase.type];
  return (
    <header className="sticky top-0 z-30 border-b border-gold/10 bg-night-950/75 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-ash">{view.dayNumber > 0 ? `Ngày ${view.dayNumber}` : 'Khởi đầu'}</p>
          <h1 className="title-display text-xl font-semibold leading-tight text-gold-bright sm:truncate sm:text-2xl">{title}</h1>
        </div>
        <Countdown endsAt={view.paused ? null : phase.endsAt} now={() => client.now()} sound={prefs.sound} />
        <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
        {narrationAvailable ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              unlockAudio();
              if (prefs.narration) stopSpeaking();
              setPrefs({ narration: !prefs.narration });
            }}
            aria-pressed={prefs.narration}
            aria-label={prefs.narration ? 'Tắt lời dẫn giọng nói' : 'Bật lời dẫn giọng nói'}
          >
            {prefs.narration ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            unlockAudio();
            setPrefs({ sound: !prefs.sound });
          }}
          aria-pressed={prefs.sound}
          aria-label={prefs.sound ? 'Tắt âm thanh' : 'Bật âm thanh'}
        >
          {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        {right}
        </div>
      </div>
    </header>
  );
}

export function TimelineDialog({ view }: { view: GameView }) {
  const name = nameFn(view);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Diễn biến trận đấu">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent title="Diễn biến">
        <ol className="space-y-1.5 text-sm">
          {[...view.timeline].reverse().map((e, i) => (
            <li key={i} className={cn(e.secret && 'text-gold-bright/90')}>
              {describeEntry(e, name)}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

export function StatusBanners({ view, connection }: { view: GameView; connection: string }) {
  return (
    <div className="mx-auto max-w-5xl space-y-2 px-3 pt-3" aria-live="polite">
      {connection === 'reconnecting' ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Mất kết nối — đang kết nối lại…</p>
      ) : null}
      {view.paused ? (
        <p className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold-bright">
          <Pause className="h-4 w-4" aria-hidden />
          {view.paused.by === 'system' ? 'Trận đấu tạm dừng vì mất kết nối. Sẽ tiếp tục khi mọi người quay lại.' : 'Quản trò đã tạm dừng trận đấu.'}
        </p>
      ) : null}
      {view.phase.awaitingModerator && !view.paused ? (
        <p className="rounded-xl border border-team-special/30 bg-team-special/10 px-4 py-2 text-sm text-[#d7c6ff]">Đang chờ quản trò…</p>
      ) : null}
      {view.phase.locked && !view.phase.awaitingModerator && view.phase.type !== 'GAME_OVER' ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-ash">Đã hết thời gian hành động.</p>
      ) : null}
    </div>
  );
}

/** Private notebook: teammates, lover, seer results, potions. */
function MyNotes({ view }: { view: GameView }) {
  const me = view.me;
  const name = nameFn(view);
  if (!me) return null;
  const items: React.ReactNode[] = [];
  if (me.teammates.length) items.push(<li key="t">Đồng đội Sói: {me.teammates.map(name).join(', ')}</li>);
  if (me.lover) items.push(<li key="l">Người yêu: {name(me.lover.playerId)}</li>);
  if (me.potions) items.push(<li key="p">Bình cứu: {me.potions.heal ? 'còn' : 'đã dùng'} · Bình độc: {me.potions.poison ? 'còn' : 'đã dùng'}</li>);
  for (const r of me.seerResults) {
    items.push(
      <li key={`s${r.night}`}>
        Đêm {r.night}: {name(r.targetId)} — {r.isWolf ? <strong className="text-blood-bright">thuộc phe Sói</strong> : <strong className="text-emerald-200">không phải Sói</strong>}
      </li>,
    );
  }
  if (!items.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-night-950/50 p-3">
      <p className="mb-1 text-xs uppercase tracking-widest text-gold">Sổ tay bí mật</p>
      <ul className="space-y-1 text-sm">{items}</ul>
    </div>
  );
}

export function GameScreen({
  view,
  room,
  client,
  connection,
  events,
  onLeave,
}: {
  view: GameView;
  room: RoomView;
  client: RoomClient;
  connection: string;
  events: ServerEvent[];
  onLeave: () => void;
}) {
  const [prefs] = usePrefs();
  const reduce = useReducedMotion();
  useNarration(view, prefs.narration, prefs.sound, client.token);
  const offline = useMemo(() => new Set(room.members.filter((m) => !m.connected).map((m) => m.id)), [room.members]);
  const me = view.me;
  const phase = view.phase;

  let content: React.ReactNode;
  if (me?.restricted) {
    content = (
      <div className="panel ornate mx-auto max-w-md p-8 text-center">
        <Skull className="mx-auto h-12 w-12 text-ash" aria-hidden />
        <p className="title-display mt-3 text-3xl font-semibold">Bạn đã chết</p>
        <p className="mt-2 text-sm text-ash">Phòng không cho người chết quan sát. Hãy chờ trận đấu kết thúc — và đừng tiết lộ gì nhé!</p>
      </div>
    );
  } else {
    switch (phase.type) {
      case 'ROLE_REVEAL':
        content = <RoleRevealView view={view} client={client} />;
        break;
      case 'NIGHT':
        content = <NightView view={view} client={client} />;
        break;
      case 'DAWN':
        content = <DawnView view={view} client={client} />;
        break;
      case 'HUNTER_SHOT':
        content = <HunterView view={view} client={client} />;
        break;
      case 'DAY_DISCUSSION':
        content = <DiscussionView view={view} client={client} offline={offline} />;
        break;
      case 'VOTING':
        content = <VotingView view={view} client={client} />;
        break;
      case 'VOTE_RESULT':
        content = <VoteResultView view={view} client={client} />;
        break;
      case 'GAME_OVER':
        content = <GameOverView view={view} client={client} canRestart={room.you.isHost} />;
        break;
    }
  }

  return (
    <div className="min-h-dvh">
      <PhaseBackground bg={backgroundFor(view)} dim={phase.type === 'NIGHT' ? 0.45 : 0.55} />
      <TopBar
        view={view}
        client={client}
        right={
          <>
            {me ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Xem vai của tôi">
                    <IdCard className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent title="Vai của bạn" description="Che màn hình trước khi mở!">
                  <div className="flex justify-center">
                    <RoleCard role={me.role} revealed size="md" />
                  </div>
                  <MyNotes view={view} />
                </DialogContent>
              </Dialog>
            ) : null}
            <HelpDialog view={view} />
            <TimelineDialog view={view} />
            {phase.type === 'GAME_OVER' ? (
              <Button size="icon" variant="ghost" aria-label="Rời phòng" onClick={async () => (await client.leave()).ok && onLeave()}>
                <LogOut className="h-4 w-4" />
              </Button>
            ) : null}
          </>
        }
      />
      <StatusBanners view={view} connection={connection} />
      <PrivateReveal events={events} view={view} />
      {view.viewer === 'spectator' ? <p className="mx-auto mt-2 max-w-5xl px-3 text-xs text-ash">Bạn đang xem trận đấu (không tham gia).</p> : null}
      <main className="mx-auto max-w-5xl px-3 py-4">
        <p className="sr-only" aria-live="polite">
          {narrate(view)}
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase.type}-${phase.step ?? ''}-${phase.round ?? ''}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
        {phase.type !== 'GAME_OVER' && phase.type !== 'ROLE_REVEAL' ? (
          <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-white/5 bg-night-950/50 px-4 py-3 text-center text-sm italic text-parchment/75">
            “{narrate(view)}”
          </p>
        ) : null}
      </main>
    </div>
  );
}
