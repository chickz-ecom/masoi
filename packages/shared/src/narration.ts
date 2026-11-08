import { NIGHT_STEP_LABELS, ROLES, type GameView, type NightStepId, type Winner } from '@masoi/engine';

/** Vietnamese narration lines used for on-screen text and Speech Synthesis (vi-VN). */
export const STEP_NARRATION: Record<NightStepId, string> = {
  CUPID: 'Cupid hãy thức dậy, chọn hai người sẽ gắn kết số phận với nhau.',
  GUARD: 'Bảo Vệ hãy thức dậy, chọn một người để bảo vệ đêm nay.',
  WEREWOLVES: 'Bầy Sói hãy thức dậy, cùng nhau chọn con mồi đêm nay.',
  WHITE_WOLF: 'Sói Trắng hãy thức dậy. Ngươi có muốn loại bỏ một con Sói khác không?',
  SEER: 'Tiên Tri hãy thức dậy, chọn một người để nhìn thấu bản chất.',
  WITCH: 'Phù Thủy hãy thức dậy. Ngươi muốn dùng bình thuốc nào đêm nay?',
};

export const PHASE_TITLES: Record<GameView['phase']['type'], string> = {
  ROLE_REVEAL: 'Nhận vai',
  NIGHT: 'Ban đêm',
  DAWN: 'Bình minh',
  HUNTER_SHOT: 'Phát súng của Thợ Săn',
  DAY_DISCUSSION: 'Thảo luận',
  VOTING: 'Bỏ phiếu',
  VOTE_RESULT: 'Kết quả bỏ phiếu',
  GAME_OVER: 'Kết thúc',
};

export const WINNER_LABELS: Record<Winner, string> = {
  VILLAGE: 'Phe Dân Làng chiến thắng!',
  WEREWOLF: 'Phe Ma Sói chiến thắng!',
  LOVERS: 'Cặp đôi chiến thắng!',
  WHITE_WOLF: 'Sói Trắng chiến thắng!',
  DRAW: 'Hòa — không ai sống sót.',
};

function names(view: GameView, ids: string[]): string {
  const list = ids.map((id) => view.players.find((p) => p.id === id)?.name ?? '?');
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} và ${list[list.length - 1]}`;
}

/** Narration text for the current phase of a view. */
export function narrate(view: GameView): string {
  const phase = view.phase;
  switch (phase.type) {
    case 'ROLE_REVEAL':
      return 'Mỗi người hãy lật bài để xem vai của mình. Tuyệt đối giữ bí mật!';
    case 'NIGHT':
      return phase.step
        ? `Đêm thứ ${view.nightNumber}. ${STEP_NARRATION[phase.step]}`
        : `Đêm thứ ${view.nightNumber} buông xuống.`;
    case 'DAWN': {
      if (!phase.confirmed) return 'Trời sắp sáng… Quản trò đang xác nhận những gì đã xảy ra.';
      const dead = phase.announcedDeaths;
      if (dead.length === 0) return 'Trời đã sáng. Đêm qua ngôi làng bình yên, không ai thiệt mạng.';
      return `Trời đã sáng. Đêm qua, ${names(view, dead.map((d) => d.playerId))} đã không qua khỏi.`;
    }
    case 'HUNTER_SHOT': {
      const hunter = names(view, phase.hunterId ? [phase.hunterId] : []);
      if (phase.hunterResolved) {
        return phase.hunterTargetId
          ? `Thợ Săn ${hunter} đã nổ súng hạ ${names(view, [phase.hunterTargetId])}.`
          : `Thợ Săn ${hunter} đã hạ súng xuống.`;
      }
      return `Thợ Săn ${hunter} đang giương súng trước khi gục ngã…`;
    }
    case 'DAY_DISCUSSION':
      return `Ngày thứ ${view.dayNumber}. Cả làng hãy thảo luận để tìm ra Ma Sói.`;
    case 'VOTING':
      return phase.round === 2
        ? `Hòa phiếu! Bỏ phiếu lại giữa ${names(view, phase.candidates ?? [])}.`
        : 'Đã đến lúc bỏ phiếu. Hãy chọn người mà bạn nghi ngờ nhất.';
    case 'VOTE_RESULT': {
      if (!phase.confirmed) return 'Quản trò đang xác nhận kết quả bỏ phiếu…';
      if (!phase.eliminatedId) return 'Dân làng không đi đến thống nhất. Không ai bị treo cổ hôm nay.';
      const role = phase.announcedDeaths.find((d) => d.playerId === phase.eliminatedId)?.role;
      return `${names(view, [phase.eliminatedId])} đã bị dân làng loại${role ? ` — đó là ${ROLES[role].name}` : ''}.`;
    }
    case 'GAME_OVER':
      return view.winner ? WINNER_LABELS[view.winner] : 'Trận đấu đã bị hủy.';
  }
}

export function stepLabel(step: NightStepId | null): string {
  return step ? NIGHT_STEP_LABELS[step] : '';
}

// ---------------------------------------------------------------------------
// Pre-recorded narration clips (no player names → a finite set). Generated once with VieNeu
// (`npm run narration:generate -w @masoi/web`) and shipped as static mp3, so production needs no TTS server.
// ---------------------------------------------------------------------------

const ORDINAL = ['', 'nhất', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'mười một', 'mười hai'];
const COUNT = ['', 'một', 'hai', 'ba', 'bốn'];
export const MAX_NUMBERED_CLIP = ORDINAL.length - 1;
const NUMBERS = Array.from({ length: MAX_NUMBERED_CLIP }, (_, i) => i + 1);

/** Clip id → spoken text. Changing a text regenerates only that clip. */
export const NARRATION_CLIPS: Record<string, string> = {
  'role-reveal': 'Mỗi người hãy lật bài để xem vai của mình. Tuyệt đối giữ bí mật!',
  ...Object.fromEntries(NUMBERS.map((n) => [`night-${n}`, `Đêm thứ ${ORDINAL[n]}.`])),
  ...Object.fromEntries((Object.keys(STEP_NARRATION) as NightStepId[]).map((s) => [`step-${s}`, STEP_NARRATION[s]])),
  'dawn-wait': 'Trời sắp sáng. Quản trò đang xác nhận những gì đã xảy ra.',
  'dawn-peaceful': 'Trời đã sáng. Đêm qua ngôi làng bình yên, không ai thiệt mạng.',
  ...Object.fromEntries([1, 2, 3, 4].map((k) => [`dawn-deaths-${k}`, `Trời đã sáng. Đêm qua, ${COUNT[k]} người đã không qua khỏi.`])),
  'dawn-deaths-many': 'Trời đã sáng. Đêm qua, nhiều người đã không qua khỏi.',
  'hunter-aim': 'Thợ Săn đang giương súng trước khi gục ngã.',
  'hunter-shot': 'Thợ Săn đã nổ súng.',
  'hunter-holster': 'Thợ Săn đã hạ súng xuống.',
  ...Object.fromEntries(NUMBERS.map((n) => [`day-${n}`, `Ngày thứ ${ORDINAL[n]}.`])),
  discussion: 'Cả làng hãy thảo luận để tìm ra Ma Sói.',
  voting: 'Đã đến lúc bỏ phiếu. Hãy chọn người mà bạn nghi ngờ nhất.',
  runoff: 'Hòa phiếu! Hãy bỏ phiếu lại giữa những người có số phiếu bằng nhau.',
  'vote-wait': 'Quản trò đang xác nhận kết quả bỏ phiếu.',
  'vote-none': 'Dân làng không đi đến thống nhất. Không ai bị treo cổ hôm nay.',
  'vote-eliminated': 'Dân làng đã quyết định loại một người.',
  ...Object.fromEntries(Object.values(ROLES).map((r) => [`role-is-${r.id}`, `Đó là ${r.name}.`])),
  ...Object.fromEntries((Object.keys(WINNER_LABELS) as Winner[]).map((w) => [`win-${w}`, WINNER_LABELS[w]])),
  aborted: 'Trận đấu đã bị hủy.',
};

/** Clip ids to play, in order, for the current phase (generic version of `narrate`). */
export function narrationClips(view: GameView): string[] {
  const phase = view.phase;
  const numbered = (prefix: string, n: number) => (n >= 1 && n <= MAX_NUMBERED_CLIP ? [`${prefix}-${n}`] : []);
  switch (phase.type) {
    case 'ROLE_REVEAL':
      return ['role-reveal'];
    case 'NIGHT':
      return [...numbered('night', view.nightNumber), ...(phase.step ? [`step-${phase.step}`] : [])];
    case 'DAWN': {
      if (!phase.confirmed) return ['dawn-wait'];
      const k = phase.announcedDeaths.length;
      if (k === 0) return ['dawn-peaceful'];
      return [k <= 4 ? `dawn-deaths-${k}` : 'dawn-deaths-many'];
    }
    case 'HUNTER_SHOT':
      if (!phase.hunterResolved) return ['hunter-aim'];
      return [phase.hunterTargetId ? 'hunter-shot' : 'hunter-holster'];
    case 'DAY_DISCUSSION':
      return [...numbered('day', view.dayNumber), 'discussion'];
    case 'VOTING':
      return [phase.round === 2 ? 'runoff' : 'voting'];
    case 'VOTE_RESULT': {
      if (!phase.confirmed) return ['vote-wait'];
      if (!phase.eliminatedId) return ['vote-none'];
      const role = phase.announcedDeaths.find((d) => d.playerId === phase.eliminatedId)?.role;
      return ['vote-eliminated', ...(role ? [`role-is-${role}`] : [])];
    }
    case 'GAME_OVER':
      return [view.winner ? `win-${view.winner}` : 'aborted'];
  }
}
