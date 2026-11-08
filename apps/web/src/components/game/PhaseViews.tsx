'use client';

import { ROLES, type ActionPrompt, type GameView, type PlayerView } from '@masoi/engine';
import { WINNER_LABELS, narrate } from '@masoi/shared';
import { motion, useReducedMotion } from 'motion/react';
import { Ban, Check, Crosshair, Eye, FlaskConical, Lock, Moon, Skull, SkipForward, Sparkles, Vote } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/input';
import type { RoomClient } from '@/lib/roomClient';
import { roleName } from '@/lib/roleVisuals';
import { cn } from '@/lib/utils';
import { PlayerGrid, PlayerToken } from './PlayerToken';
import { RoleCard } from './RoleCard';
import { TargetPicker } from './TargetPicker';
import { describeEntry, nameFn } from './timelineText';
import { useAction } from './useAction';

interface Props {
  view: GameView;
  client: RoomClient;
}

function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('panel ornate p-4 sm:p-6', className)}>
      {title ? <h2 className="title-display mb-4 text-center text-3xl font-semibold text-gold-bright">{title}</h2> : null}
      {children}
    </section>
  );
}

function Submitted({ text }: { text: string }) {
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-200" role="status">
      <Check className="h-4 w-4" aria-hidden /> {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Role reveal
// ---------------------------------------------------------------------------

export function RoleRevealView({ view, client }: Props) {
  const me = view.me;
  const [flipped, setFlipped] = useState(false);
  const ack = useAction();
  if (!me) return <Section title="Các người chơi đang xem vai">{null}</Section>;
  const def = ROLES[me.role];
  const name = nameFn(view);
  return (
    <div className="flex flex-col items-center gap-6">
      <RoleCard role={me.role} revealed={flipped} onFlip={() => setFlipped(true)} />
      {flipped ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel max-w-md p-5 text-center">
          <p className="text-sm leading-relaxed text-parchment/90">{def.description}</p>
          <p className="mt-2 text-sm text-gold-bright">{def.ability}</p>
          {me.teammates.length > 0 ? (
            <p className="mt-3 text-sm text-team-werewolf">Đồng đội Sói: {me.teammates.map(name).join(', ')}</p>
          ) : null}
          {me.prompt?.kind === 'ACK_ROLE' ? (
            <Button className="mt-4 w-full" loading={ack.pending} onClick={() => ack.run(() => client.ackRole(view.phase.id))}>
              Tôi đã ghi nhớ vai
            </Button>
          ) : (
            <Submitted text="Đang chờ những người khác…" />
          )}
          <FieldError>{ack.error}</FieldError>
        </motion.div>
      ) : (
        <p className="text-sm text-ash">Hãy đảm bảo không ai nhìn màn hình của bạn.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Night
// ---------------------------------------------------------------------------

function NightAction({ view, client, prompt }: Props & { prompt: ActionPrompt }) {
  const act = useAction();
  const [sel, setSel] = useState<string[]>([]);
  const [heal, setHeal] = useState(false);
  const players = view.players;
  const name = nameFn(view);
  const me = view.me;
  const phaseId = view.phase.id;
  useEffect(() => {
    setSel([]);
    setHeal(false);
  }, [phaseId]);

  const toggleOne = (id: string) => setSel((s) => (s[0] === id ? [] : [id]));

  switch (prompt.kind) {
    case 'CUPID_LINK':
      return (
        <Section title="Cupid — chọn cặp đôi">
          <p className="mb-3 text-center text-sm text-ash">Chọn hai người. Họ sẽ sống chết có nhau.</p>
          <TargetPicker
            players={players}
            targets={prompt.targets}
            selected={sel}
            onToggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)))}
          />
          <Button
            className="mt-4 w-full"
            disabled={sel.length !== 2}
            loading={act.pending}
            onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'CUPID_LINK', targetIds: [sel[0] as string, sel[1] as string] }))}
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Se duyên
          </Button>
          <FieldError>{act.error}</FieldError>
        </Section>
      );
    case 'GUARD_PROTECT':
      return (
        <Section title="Bảo Vệ — chọn người để che chở">
          {prompt.lastTargetId ? (
            <p className="mb-3 text-center text-sm text-ash">Không thể bảo vệ {name(prompt.lastTargetId)} hai đêm liên tiếp.</p>
          ) : null}
          <TargetPicker players={players} targets={prompt.targets} selected={sel} onToggle={toggleOne} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" loading={act.pending} onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'GUARD_PROTECT', targetId: null }))}>
              <Ban className="h-4 w-4" aria-hidden /> Không bảo vệ ai
            </Button>
            <Button disabled={sel.length !== 1} loading={act.pending} onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'GUARD_PROTECT', targetId: sel[0] ?? null }))}>
              Bảo vệ {sel[0] ? name(sel[0]) : ''}
            </Button>
          </div>
          <FieldError>{act.error}</FieldError>
        </Section>
      );
    case 'WOLF_VOTE': {
      const votes = view.wolfVotes ?? {};
      const badges: Record<string, React.ReactNode> = {};
      const counts: Record<string, number> = {};
      for (const t of Object.values(votes)) if (t) counts[t] = (counts[t] ?? 0) + 1;
      for (const [id, n] of Object.entries(counts)) {
        badges[id] = <Badge tone="blood">{n}</Badge>;
      }
      const teamIds = [me?.playerId, ...(me?.teammates ?? [])].filter(Boolean) as string[];
      const aliveTeam = teamIds.filter((id) => players.find((p) => p.id === id)?.alive);
      const choices = aliveTeam.map((id) => (id in votes ? votes[id] : undefined));
      const consensus = choices.every((c) => c !== undefined) && new Set(choices).size === 1;
      return (
        <Section title="Bầy Sói — chọn con mồi" className="border-blood-bright/30">
          <ul className="mb-3 flex flex-wrap justify-center gap-2 text-xs">
            {aliveTeam.map((id) => (
              <li key={id}>
                <Badge tone="blood">
                  {name(id)}: {id in votes ? (votes[id] ? name(votes[id]) : 'không giết') : 'đang chọn…'}
                </Badge>
              </li>
            ))}
          </ul>
          <TargetPicker
            players={players}
            targets={prompt.targets}
            selected={prompt.current ? [prompt.current] : []}
            badges={badges}
            onToggle={(id) => act.run(() => client.nightAction(phaseId, { kind: 'WOLF_VOTE', targetId: id }))}
            disabled={act.pending}
          />
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'WOLF_VOTE', targetId: null }))}
            aria-pressed={prompt.current === null}
          >
            <Ban className="h-4 w-4" aria-hidden /> Đêm nay không giết
          </Button>
          <p className="mt-3 text-center text-sm text-ash" role="status">
            {consensus ? 'Cả bầy đã thống nhất.' : 'Cả bầy cần chọn cùng một mục tiêu. Hết giờ sẽ lấy lựa chọn nhiều phiếu nhất.'}
          </p>
          <FieldError>{act.error}</FieldError>
        </Section>
      );
    }
    case 'WHITE_WOLF_KILL':
      return (
        <Section title="Sói Trắng — loại bỏ một con Sói?">
          <TargetPicker players={players} targets={prompt.targets} selected={sel} onToggle={toggleOne} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" loading={act.pending} onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'WHITE_WOLF_KILL', targetId: null }))}>
              Bỏ qua
            </Button>
            <Button variant="danger" disabled={sel.length !== 1} loading={act.pending} onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'WHITE_WOLF_KILL', targetId: sel[0] ?? null }))}>
              Ra tay
            </Button>
          </div>
          <FieldError>{act.error}</FieldError>
        </Section>
      );
    case 'SEER_CHECK':
      return (
        <Section title="Tiên Tri — nhìn thấu một linh hồn">
          <TargetPicker players={players} targets={prompt.targets} selected={sel} onToggle={toggleOne} />
          <Button className="mt-4 w-full" disabled={sel.length !== 1} loading={act.pending} onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'SEER_CHECK', targetId: sel[0] as string }))}>
            <Eye className="h-4 w-4" aria-hidden /> Soi {sel[0] ? name(sel[0]) : ''}
          </Button>
          <FieldError>{act.error}</FieldError>
        </Section>
      );
    case 'WITCH_ACT': {
      const poison = sel[0] ?? null;
      return (
        <Section title="Phù Thủy — hai bình thuốc">
          <div className="mb-4 rounded-xl border border-white/10 bg-night-950/50 p-3 text-center text-sm">
            {prompt.attackedId ? (
              <>
                Đêm nay bầy Sói tấn công <strong className="text-blood-bright">{name(prompt.attackedId)}</strong>.
              </>
            ) : (
              'Đêm nay không ai bị bầy Sói tấn công.'
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!prompt.canHeal}
              aria-pressed={heal}
              onClick={() => {
                setHeal((h) => !h);
                if (!prompt.canUseBoth) setSel([]);
              }}
              className={cn(
                'rounded-xl border p-3 text-left transition-all disabled:opacity-40',
                heal ? 'border-emerald-300 bg-emerald-500/15' : 'border-white/10 bg-night-950/40 hover:border-emerald-300/50',
              )}
            >
              <span className="flex items-center gap-2 font-semibold text-emerald-200">
                <FlaskConical className="h-5 w-5" aria-hidden /> Bình cứu {me?.potions?.heal ? '' : '(đã dùng)'}
              </span>
              <span className="mt-1 block text-xs text-ash">{prompt.canHeal ? 'Cứu người bị tấn công.' : 'Không thể dùng đêm nay.'}</span>
            </button>
            <div className={cn('rounded-xl border p-3', poison ? 'border-blood-bright bg-blood/20' : 'border-white/10 bg-night-950/40')}>
              <span className="flex items-center gap-2 font-semibold text-[#ff9aa5]">
                <Skull className="h-5 w-5" aria-hidden /> Bình độc {me?.potions?.poison ? '' : '(đã dùng)'}
              </span>
              <span className="mt-1 block text-xs text-ash">
                {prompt.poisonTargets.length ? (poison ? `Đầu độc ${name(poison)}` : 'Chọn một người bên dưới.') : 'Không còn bình độc.'}
              </span>
            </div>
          </div>
          {prompt.poisonTargets.length ? (
            <div className="mt-4">
              <TargetPicker
                players={players}
                targets={prompt.poisonTargets}
                selected={sel}
                onToggle={(id) => {
                  toggleOne(id);
                  if (!prompt.canUseBoth) setHeal(false);
                }}
              />
            </div>
          ) : null}
          <Button
            className="mt-4 w-full"
            loading={act.pending}
            onClick={() => act.run(() => client.nightAction(phaseId, { kind: 'WITCH_ACT', heal, poisonTargetId: poison }))}
          >
            {heal || poison ? 'Dùng thuốc' : 'Không làm gì đêm nay'}
          </Button>
          <FieldError>{act.error}</FieldError>
        </Section>
      );
    }
    default:
      return null;
  }
}

export function NightView({ view, client }: Props) {
  const me = view.me;
  const reduce = useReducedMotion();
  const prompt = me?.prompt;
  const latestSeer = me?.seerResults.filter((r) => r.night === view.nightNumber).at(-1);
  const name = nameFn(view);

  if (prompt && prompt.kind !== 'ACK_ROLE') return <NightAction view={view} client={client} prompt={prompt} />;

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-moon/10 shadow-[0_0_80px_10px_rgb(217_225_255/0.12)]"
      >
        <Moon className="h-12 w-12 text-moon" aria-hidden />
      </motion.div>
      <div>
        <p className="title-display text-3xl font-semibold text-moon">{me ? (me.alive ? 'Hãy nhắm mắt…' : 'Linh hồn bạn lặng lẽ dõi theo') : 'Màn đêm bao trùm ngôi làng'}</p>
        <p className="mt-2 text-sm text-ash">{narrate(view)}</p>
      </div>
      {me?.submitted ? <Submitted text="Lựa chọn của bạn đã được ghi nhận." /> : null}
      {latestSeer ? (
        <div className="panel px-5 py-3" role="status">
          <p className="text-sm">
            Quả cầu pha lê cho thấy <strong>{name(latestSeer.targetId)}</strong>{' '}
            {latestSeer.isWolf ? <strong className="text-blood-bright">thuộc phe Sói</strong> : <strong className="text-emerald-200">không phải Sói</strong>}.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dawn / hunter
// ---------------------------------------------------------------------------

function DeathReveal({ view, deaths }: { view: GameView; deaths: GameView['phase']['announcedDeaths'] }) {
  const name = nameFn(view);
  if (deaths.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-4">
      {deaths.map((d) => (
        <li key={d.playerId} className="flex flex-col items-center gap-2">
          {d.role ? <RoleCard role={d.role} revealed size="sm" /> : <div className="flex aspect-[2/3] w-28 items-center justify-center rounded-2xl border border-white/10 bg-night-950/70"><Skull className="h-8 w-8 text-ash" aria-hidden /></div>}
          <span className="font-semibold">{name(d.playerId)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DawnView({ view }: Props) {
  const phase = view.phase;
  if (!phase.confirmed) {
    return <Section title="Bình minh đang ló dạng…"><p className="text-center text-ash">Quản trò đang xác nhận những gì đã xảy ra trong đêm.</p></Section>;
  }
  return (
    <Section title={phase.announcedDeaths.length ? 'Đêm qua có người đã ra đi' : 'Một đêm bình yên'}>
      <p className="mb-5 text-center text-parchment/85">{narrate(view)}</p>
      <DeathReveal view={view} deaths={phase.announcedDeaths} />
    </Section>
  );
}

export function HunterView({ view, client }: Props) {
  const prompt = view.me?.prompt;
  const act = useAction();
  const [sel, setSel] = useState<string[]>([]);
  if (prompt?.kind === 'HUNTER_SHOOT') {
    return (
      <Section title="Phát súng cuối cùng" className="border-blood-bright/30">
        <p className="mb-3 text-center text-sm text-ash">Bạn đã gục ngã. Hãy chọn người sẽ đi cùng bạn — hoặc hạ súng.</p>
        <TargetPicker players={view.players} targets={prompt.targets} selected={sel} onToggle={(id) => setSel((s) => (s[0] === id ? [] : [id]))} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" loading={act.pending} onClick={() => act.run(() => client.hunterShoot(view.phase.id, null))}>
            Hạ súng
          </Button>
          <Button variant="danger" disabled={!sel[0]} loading={act.pending} onClick={() => act.run(() => client.hunterShoot(view.phase.id, sel[0] ?? null))}>
            <Crosshair className="h-4 w-4" aria-hidden /> Bắn
          </Button>
        </div>
        <FieldError>{act.error}</FieldError>
      </Section>
    );
  }
  return (
    <Section title="Thợ Săn">
      <p className="mb-5 text-center text-parchment/85">{narrate(view)}</p>
      <DeathReveal view={view} deaths={view.phase.announcedDeaths} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Day
// ---------------------------------------------------------------------------

export function DiscussionView({ view, client, offline }: Props & { offline: Set<string> }) {
  const prompt = view.me?.prompt;
  const act = useAction();
  const progress = view.phase.progress;
  return (
    <Section title={`Ngày ${view.dayNumber} — Hội đồng làng`}>
      <p className="mb-4 text-center text-sm text-ash">Thảo luận trực tiếp hoặc qua Discord. Ai là Sói?</p>
      <PlayerGrid>
        {view.players.map((p) => (
          <PlayerToken key={p.id} player={p} offline={offline.has(p.id)} />
        ))}
      </PlayerGrid>
      {prompt?.kind === 'SKIP_DISCUSSION' ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            variant={prompt.skipped ? 'outline' : 'subtle'}
            disabled={prompt.skipped}
            loading={act.pending}
            onClick={() => act.run(() => client.skipDiscussion(view.phase.id))}
          >
            <SkipForward className="h-4 w-4" aria-hidden /> {prompt.skipped ? 'Bạn đã sẵn sàng bỏ phiếu' : 'Sẵn sàng bỏ phiếu'}
          </Button>
          {progress ? (
            <p className="text-xs text-ash" role="status">
              {progress.done}/{progress.total} người muốn bỏ phiếu ngay
            </p>
          ) : null}
          <FieldError>{act.error}</FieldError>
        </div>
      ) : null}
    </Section>
  );
}

export function VotingView({ view, client }: Props) {
  const prompt = view.me?.prompt;
  const act = useAction();
  const phase = view.phase;
  const progress = phase.progress;
  const current = prompt?.kind === 'VOTE' ? prompt.current : null;
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(null), [phase.id]);
  const choice = sel ?? current?.targetId ?? null;
  const name = nameFn(view);
  const locked = Boolean(current?.locked);

  return (
    <Section title={phase.round === 2 ? 'Bỏ phiếu lại' : `Ngày ${view.dayNumber} — Bỏ phiếu`} className="border-blood/40">
      {phase.round === 2 && phase.candidates ? (
        <p className="mb-3 text-center text-sm text-ash">Chỉ được chọn giữa: {phase.candidates.map(name).join(', ')}</p>
      ) : null}
      {prompt?.kind === 'VOTE' ? (
        <>
          <TargetPicker
            players={view.players}
            targets={prompt.targets}
            selected={choice ? [choice] : []}
            disabled={locked}
            onToggle={(id) => {
              setSel(id);
              if (prompt.canChange) void act.run(() => client.vote(phase.id, id, false));
            }}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={locked}
              loading={act.pending}
              onClick={() => act.run(() => client.vote(phase.id, null, true))}
            >
              <Ban className="h-4 w-4" aria-hidden /> Bỏ phiếu trắng
            </Button>
            <Button
              variant="danger"
              disabled={locked || !choice}
              loading={act.pending}
              onClick={() => act.run(() => client.vote(phase.id, choice, true))}
            >
              <Lock className="h-4 w-4" aria-hidden /> {locked ? 'Đã khóa phiếu' : `Khóa phiếu${choice ? `: ${name(choice)}` : ''}`}
            </Button>
          </div>
          {locked ? <Submitted text={current?.targetId ? `Bạn đã bỏ phiếu cho ${name(current.targetId)}.` : 'Bạn đã bỏ phiếu trắng.'} /> : null}
          <FieldError>{act.error}</FieldError>
        </>
      ) : (
        <PlayerGrid>
          {view.players.map((p) => (
            <PlayerToken key={p.id} player={p} />
          ))}
        </PlayerGrid>
      )}
      {progress ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-ash" role="status">
          <Vote className="h-4 w-4" aria-hidden /> {progress.done}/{progress.total} phiếu đã khóa
        </p>
      ) : null}
    </Section>
  );
}

export function VoteResultView({ view }: Props) {
  const phase = view.phase;
  const name = nameFn(view);
  const tally = phase.tally ?? {};
  const max = Math.max(1, ...Object.values(tally));
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return (
    <Section title="Phán quyết của dân làng">
      {entries.length ? (
        <ul className="mx-auto mb-5 max-w-md space-y-2" aria-label="Kết quả kiểm phiếu">
          {entries.map(([id, n]) => (
            <li key={id}>
              <div className="flex justify-between text-sm">
                <span>{name(id)}</span>
                <span className="font-mono tabular-nums">{n} phiếu</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-night-950">
                <motion.div className="h-full bg-gradient-to-r from-blood to-blood-bright" initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-center text-parchment/90">{narrate(view)}</p>
      {phase.confirmed ? <div className="mt-5"><DeathReveal view={view} deaths={phase.announcedDeaths} /></div> : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

export function GameOverView({ view, client, canRestart }: Props & { canRestart: boolean }) {
  const name = nameFn(view);
  const again = useAction();
  const meWon = view.me ? view.winnerIds.includes(view.me.playerId) : null;
  const wolfWin = view.winner === 'WEREWOLF' || view.winner === 'WHITE_WOLF';
  const timeline = useMemo(() => view.timeline.filter((e) => e.kind !== 'GAME_STARTED'), [view.timeline]);
  return (
    <div className="space-y-4">
      <Section>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-ash">
            {view.nightNumber} đêm · {view.dayNumber} ngày
          </p>
          <h2 className={cn('title-display mt-2 text-4xl font-bold sm:text-5xl', wolfWin ? 'text-blood-bright' : 'gold-text')}>
            {view.winner ? WINNER_LABELS[view.winner] : 'Trận đấu đã bị hủy'}
          </h2>
          {meWon !== null && view.winner ? (
            <p className="mt-2 text-lg">{meWon ? 'Bạn đã chiến thắng!' : 'Bạn đã thất bại.'}</p>
          ) : null}
          {canRestart ? (
            <Button className="mt-5" size="lg" loading={again.pending} onClick={() => again.run(() => client.playAgain())}>
              Chơi lại cùng nhóm
            </Button>
          ) : (
            <p className="mt-4 text-sm text-ash">Chờ chủ phòng bắt đầu ván mới…</p>
          )}
          <FieldError>{again.error}</FieldError>
        </div>
      </Section>
      <Section title="Lật bài">
        <PlayerGrid>
          {view.players.map((p: PlayerView) => (
            <PlayerToken key={p.id} player={p} badge={view.winnerIds.includes(p.id) ? <Badge tone="gold">Thắng</Badge> : undefined} />
          ))}
        </PlayerGrid>
      </Section>
      {view.voteHistory.length ? (
        <Section title="Các lần bỏ phiếu">
          <ul className="space-y-3 text-sm">
            {view.voteHistory.map((r, i) => (
              <li key={i} className="rounded-xl border border-white/10 bg-night-950/40 p-3">
                <p className="font-semibold">
                  Ngày {r.day}, vòng {r.round}: {r.eliminatedId ? `${name(r.eliminatedId)} bị loại` : 'không ai bị loại'}
                </p>
                <p className="mt-1 text-ash">
                  {Object.entries(r.ballots)
                    .map(([voter, b]) => `${name(voter)} → ${b.targetId ? name(b.targetId) : 'trắng'}`)
                    .join(' · ') || 'Không có phiếu.'}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Diễn biến trận đấu">
        <ol className="space-y-1.5 text-sm">
          {timeline.map((e, i) => (
            <li key={i} className={cn('flex gap-2', e.secret && 'text-gold-bright/90')}>
              <span className="w-16 shrink-0 text-xs text-ash">{e.night > 0 ? `Đ${e.night}${e.day ? `·N${e.day}` : ''}` : 'Mở đầu'}</span>
              <span>
                {describeEntry(e, name)}
                {e.secret ? <span className="sr-only"> (bí mật)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </Section>
      {view.me ? <p className="text-center text-xs text-ash">Vai của bạn: {roleName(view.me.role)}</p> : null}
    </div>
  );
}
