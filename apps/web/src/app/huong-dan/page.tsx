import { ROLE_LIST } from '@masoi/engine';
import { ArrowLeft, BookOpen, ChevronDown, Crown, Moon, PlusCircle, Sun, Users, Vote } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PhaseBackground } from '@/components/game/PhaseBackground';
import { RoleArt } from '@/components/game/RoleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FAQ, MODERATOR_GUIDE, QUICK_START, ROLE_GUIDE, ROUND_FLOW } from '@/lib/guide';
import { TEAM_LABEL, TEAM_STYLE } from '@/lib/roleVisuals';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Hướng dẫn chơi',
  description: 'Cách chơi Ma Sói Online: tạo phòng, nhận vai, ban đêm, thảo luận, bỏ phiếu và mẹo cho từng vai.',
};

const FLOW_ICONS = [BookOpen, Moon, Sun, Users, Vote, Crown];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="title-display gold-text mt-16 scroll-mt-20 text-4xl font-bold sm:text-5xl">
      {children}
    </h2>
  );
}

export default function GuidePage() {
  return (
    <main className="relative mx-auto max-w-5xl px-4 pb-24 pt-8">
      <PhaseBackground bg="landing" dim={0.75} />
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-ash hover:text-parchment">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Trang chủ
      </Link>

      <header className="mt-6">
        <p className="text-xs uppercase tracking-[0.35em] text-ash">Dành cho người mới</p>
        <h1 className="title-display gold-text mt-1 text-5xl font-bold sm:text-6xl">Hướng dẫn chơi Ma Sói</h1>
        <p className="mt-3 max-w-2xl text-lg text-parchment/85">
          Ngôi làng có những con Sói đội lốt người. Ban đêm chúng săn mồi, ban ngày dân làng phải tìm ra và treo cổ chúng trước khi quá muộn.
        </p>
        <nav aria-label="Mục lục" className="mt-6 flex flex-wrap gap-2 text-sm">
          {[
            ['bat-dau', 'Bắt đầu nhanh'],
            ['muc-tieu', 'Mục tiêu'],
            ['mot-van', 'Một ván diễn ra thế nào'],
            ['vai-tro', 'Cách chơi từng vai'],
            ['quan-tro', 'Dành cho quản trò'],
            ['hoi-dap', 'Hỏi đáp'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-gold/30 bg-night-950/50 px-3 py-1.5 text-gold-bright hover:bg-gold/10">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <H2 id="bat-dau">Bắt đầu nhanh</H2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {QUICK_START.map((s, i) => (
          <li key={s.title} className="panel ornate p-5">
            <span className="title-display text-5xl font-bold text-gold/60">{i + 1}</span>
            <p className="title-display mt-1 text-2xl font-semibold">{s.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-parchment/80">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/create">
            <PlusCircle className="h-4 w-4" aria-hidden /> Tạo phòng ngay
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/join">Tôi có mã phòng</Link>
        </Button>
      </div>
      <p className="mt-4 text-sm text-ash">
        Cần ít nhất <strong className="text-parchment">4 người chơi</strong> (tối đa 20). Mỗi người dùng điện thoại hoặc máy tính riêng. Hay nhất là ngồi cùng
        nhau, hoặc gọi Discord/Zalo để thảo luận.
      </p>

      <H2 id="muc-tieu">Mục tiêu của mỗi phe</H2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="panel border-team-village/40 p-5">
          <Badge tone="gold">Phe Làng</Badge>
          <p className="title-display mt-2 text-2xl font-semibold">Tìm và loại hết Sói</p>
          <p className="mt-1 text-sm text-parchment/80">Dân Làng, Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn… thắng khi không còn con Sói nào sống.</p>
        </div>
        <div className="panel border-team-werewolf/40 p-5">
          <Badge tone="blood">Phe Sói</Badge>
          <p className="title-display mt-2 text-2xl font-semibold">Áp đảo ngôi làng</p>
          <p className="mt-1 text-sm text-parchment/80">Ma Sói thắng khi số Sói còn sống bằng hoặc nhiều hơn số người còn lại.</p>
        </div>
      </div>

      <H2 id="mot-van">Một ván diễn ra thế nào</H2>
      <ol className="relative mt-6 space-y-4 border-l border-gold/25 pl-6">
        {ROUND_FLOW.map((step, i) => {
          const Icon = FLOW_ICONS[i] ?? Moon;
          return (
            <li key={step.phase} className="relative">
              <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border border-gold/50 bg-night-900">
                <Icon className="h-3.5 w-3.5 text-gold" aria-hidden />
              </span>
              <div className="panel p-4">
                <p className="title-display text-2xl font-semibold">{step.phase}</p>
                <p className="mt-1 text-sm text-parchment/80">{step.what}</p>
                <p className="mt-2 rounded-lg bg-gold/5 px-3 py-2 text-sm text-gold-bright/90">
                  <strong>Bạn làm gì:</strong> {step.you}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-ash">
        Vòng Đêm → Bình minh → Thảo luận → Bỏ phiếu lặp lại cho đến khi một phe thắng. Trong trận, bấm nút <strong className="text-parchment">?</strong> trên
        thanh trên cùng để xem bạn cần làm gì ở giai đoạn hiện tại.
      </p>

      <H2 id="vai-tro">Cách chơi từng vai</H2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {ROLE_LIST.map((r) => {
          const g = ROLE_GUIDE[r.id];
          return (
            <article key={r.id} className="panel flex gap-4 overflow-hidden p-3">
              <div className={cn('aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border-2', TEAM_STYLE[r.team].ring)}>
                <RoleArt role={r.id} />
              </div>
              <div className="min-w-0 py-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="title-display text-2xl font-bold">{r.name}</h3>
                  <Badge tone={r.team === 'werewolf' ? 'blood' : r.team === 'special' ? 'violet' : 'gold'}>{TEAM_LABEL[r.team]}</Badge>
                  {r.advanced ? <Badge>Nâng cao</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-parchment/85">{g.how}</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-ash">
                  {g.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ash">
        Luật chi tiết (thứ tự xử lý, hòa phiếu, các biến thể) ở trang{' '}
        <Link href="/rules" className="text-gold-bright underline-offset-4 hover:underline">
          Luật chơi
        </Link>
        .
      </p>

      <H2 id="quan-tro">Dành cho quản trò</H2>
      <p className="mt-2 text-parchment/80">Ở chế độ “Có quản trò”, người tạo phòng không nhận vai mà điều khiển cả ván.</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {MODERATOR_GUIDE.map(([title, text]) => (
          <div key={title} className="panel p-4">
            <dt className="font-semibold text-gold-bright">{title}</dt>
            <dd className="mt-1 text-sm text-parchment/80">{text}</dd>
          </div>
        ))}
      </dl>

      <H2 id="hoi-dap">Hỏi đáp</H2>
      <div className="mt-6 space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="panel group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
              {q}
              <ChevronDown className="h-4 w-4 shrink-0 text-gold transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 text-sm text-parchment/80">{a}</p>
          </details>
        ))}
      </div>

      <section className="panel ornate mt-16 p-6 text-center">
        <p className="title-display text-3xl font-semibold">Sẵn sàng đối mặt với màn đêm?</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/create">Tạo phòng</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/join">Vào phòng</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
