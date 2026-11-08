import { ROLES, type GameView, type RoleId, type TimelineEntry } from '@masoi/engine';

type Names = (id: unknown) => string;

export function nameFn(view: GameView): Names {
  const map = new Map(view.players.map((p) => [p.id, p.name] as const));
  return (id) => (typeof id === 'string' ? (map.get(id) ?? '?') : '—');
}

function deathList(deaths: unknown, name: Names): string {
  const list = (deaths as { playerId: string; role: RoleId | null }[] | undefined) ?? [];
  return list.map((d) => `${name(d.playerId)}${d.role ? ` (${ROLES[d.role].name})` : ''}`).join(', ');
}

const OUTCOME: Record<string, string> = {
  ELIMINATED: 'có người bị loại',
  TIE_RUNOFF: 'hòa — bỏ phiếu lại',
  TIE_NO_ELIMINATION: 'vẫn hòa — không ai bị loại',
  NO_VOTES: 'không có phiếu hợp lệ',
};

/** Vietnamese, human-readable description of a timeline entry. */
export function describeEntry(e: TimelineEntry, name: Names): string {
  const d = e.data;
  switch (e.kind) {
    case 'GAME_STARTED':
      return `Trận đấu bắt đầu với ${String(d.players)} người chơi.`;
    case 'NIGHT_STARTED':
      return `Đêm ${String(d.night)} buông xuống.`;
    case 'LOVERS_LINKED':
      return `Cupid ghép đôi ${name(d.a)} và ${name(d.b)}.`;
    case 'GUARD_PROTECTED':
      return `Bảo Vệ che chở ${name(d.targetId)}.`;
    case 'WOLVES_TARGETED':
      return d.targetId ? `Bầy Sói chọn tấn công ${name(d.targetId)}${d.tieBroken ? ' (hòa phiếu, chọn ngẫu nhiên)' : ''}.` : 'Bầy Sói không tấn công ai.';
    case 'WHITE_WOLF_TARGETED':
      return `Sói Trắng ra tay với ${name(d.targetId)}.`;
    case 'SEER_CHECKED':
      return `Tiên Tri soi ${name(d.targetId)}: ${d.isWolf ? 'thuộc phe Sói' : 'không phải Sói'}.`;
    case 'WITCH_HEALED':
      return `Phù Thủy dùng bình cứu cho ${name(d.targetId)}.`;
    case 'WITCH_POISONED':
      return `Phù Thủy đầu độc ${name(d.targetId)}.`;
    case 'ELDER_SHIELDED':
      return 'Già Làng chống chịu được đòn tấn công của bầy Sói.';
    case 'NIGHT_DEATHS': {
      const list = deathList(d.deaths, name);
      return list ? `Sáng ngày ${String(d.night)}: ${list} đã chết.` : `Đêm ${String(d.night)} trôi qua bình yên.`;
    }
    case 'DAY_STARTED':
      return `Ngày ${String(d.day)} bắt đầu.`;
    case 'HUNTER_SHOT':
      return d.targetId ? `Thợ Săn ${name(d.hunterId)} bắn hạ ${name(d.targetId)}.` : `Thợ Săn ${name(d.hunterId)} không bắn.`;
    case 'VOTE_CLOSED': {
      const tally = (d.tally as Record<string, number>) ?? {};
      const parts = Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${name(id)}: ${n}`)
        .join(', ');
      return `Bỏ phiếu vòng ${String(d.round)} — ${OUTCOME[String(d.outcome)] ?? ''}${parts ? ` (${parts})` : ''}.`;
    }
    case 'PLAYER_ELIMINATED':
      return d.playerId ? `${name(d.playerId)} bị dân làng loại${d.role ? ` — ${ROLES[d.role as RoleId].name}` : ''}.` : 'Không ai bị loại hôm nay.';
    case 'MODERATOR_OVERRIDE':
      return d.action === 'END_GAME' ? 'Quản trò kết thúc trận đấu.' : 'Quản trò điều chỉnh kết quả.';
    case 'PAUSED':
      return d.by === 'system' ? 'Trận đấu tạm dừng (mất kết nối).' : 'Quản trò tạm dừng trận đấu.';
    case 'RESUMED':
      return 'Trận đấu tiếp tục.';
    case 'GAME_ENDED':
      return 'Trận đấu kết thúc.';
  }
}
