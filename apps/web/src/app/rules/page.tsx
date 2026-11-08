import { ROLE_LIST } from '@masoi/engine';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RoleArt } from '@/components/game/RoleCard';
import { Badge } from '@/components/ui/badge';
import { TEAM_LABEL, TEAM_STYLE } from '@/lib/roleVisuals';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Luật chơi & vai trò' };

const FLOW = [
  ['Nhận vai', 'Mỗi người lật bài xem vai bí mật. Sói biết đồng đội.'],
  ['Ban đêm', 'Các vai lần lượt thức dậy: Cupid (đêm 1) → Bảo Vệ → Bầy Sói → Tiên Tri → Phù Thủy.'],
  ['Bình minh', 'Công bố người chết (không công bố nguyên nhân). Thợ Săn có thể bắn.'],
  ['Thảo luận', 'Cả làng tranh luận. Mọi người còn sống đồng ý thì bỏ qua sớm.'],
  ['Bỏ phiếu', 'Người nhiều phiếu nhất bị loại. Hòa → bỏ lại một lần giữa các ứng viên hòa; vẫn hòa → không ai chết.'],
  ['Kết thúc', 'Làng thắng khi hết Sói. Sói thắng khi số Sói ≥ số người còn lại.'],
];

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-ash hover:text-parchment">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Trang chủ
      </Link>
      <h1 className="title-display gold-text text-5xl font-bold">Luật chơi</h1>
      <p className="mt-2 max-w-2xl text-parchment/80">
        Ruleset <code className="text-gold-bright">classic-v1</code>. Các biến thể (tự bảo vệ, tự cứu, đổi phiếu…) do chủ phòng cấu hình trước trận. Mới chơi lần đầu?{' '}
        <Link href="/huong-dan" className="text-gold-bright underline-offset-4 hover:underline">
          Xem hướng dẫn chơi
        </Link>
        .
      </p>
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW.map(([title, text], i) => (
          <li key={title} className="panel p-4">
            <p className="text-xs uppercase tracking-widest text-gold">Bước {i + 1}</p>
            <p className="title-display mt-1 text-2xl font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-parchment/80">{text}</p>
          </li>
        ))}
      </ol>

      <h2 className="title-display gold-text mt-14 text-4xl font-bold">Các vai trò</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {ROLE_LIST.map((r) => {
          const style = TEAM_STYLE[r.team];
          return (
            <article key={r.id} className="panel flex gap-4 overflow-hidden p-3">
              <div className={cn('aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl border-2', style.ring)}>
                <RoleArt role={r.id} />
              </div>
              <div className="min-w-0 py-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="title-display text-2xl font-bold">{r.name}</h3>
                  <Badge tone={r.team === 'werewolf' ? 'blood' : r.team === 'special' ? 'violet' : 'gold'}>{TEAM_LABEL[r.team]}</Badge>
                  {r.advanced ? <Badge>Nâng cao</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-parchment/85">{r.ability}</p>
                <dl className="mt-2 space-y-0.5 text-xs text-ash">
                  <div><dt className="inline font-semibold text-parchment/70">Lượt dùng: </dt><dd className="inline">{r.usage}</dd></div>
                  <div><dt className="inline font-semibold text-parchment/70">Mục tiêu: </dt><dd className="inline">{r.targetRules}</dd></div>
                  <div><dt className="inline font-semibold text-parchment/70">Thắng: </dt><dd className="inline">{r.winCondition}</dd></div>
                </dl>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
