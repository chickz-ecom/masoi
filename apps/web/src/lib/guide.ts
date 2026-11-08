import type { ActionPrompt, GameView, RoleId } from '@masoi/engine';

/**
 * Player-facing help content (Vietnamese). Shown on /huong-dan and in the in-game "?" dialog.
 * Rules themselves live in the engine; this file only explains how to play them in the UI.
 */

export const QUICK_START = [
  {
    title: 'Tạo phòng',
    text: 'Một người bấm “Tạo phòng mới”, chọn chế độ (Quản trò tự động hoặc Có quản trò) và đặt nickname.',
  },
  {
    title: 'Mời bạn bè',
    text: 'Gửi mã phòng 6 ký tự, link mời hoặc mã QR. Bạn bè mở link, nhập nickname là vào được — không cần tài khoản.',
  },
  {
    title: 'Sẵn sàng & bắt đầu',
    text: 'Mọi người bấm “Sẵn sàng”. Chủ phòng kiểm tra bộ vai (mặc định tự động theo số người) rồi bấm “Bắt đầu”.',
  },
];

export const ROUND_FLOW: { phase: string; what: string; you: string }[] = [
  {
    phase: 'Nhận vai',
    what: 'Mỗi người nhận một lá bài bí mật.',
    you: 'Che màn hình, chạm vào lá bài để lật, đọc kỹ kỹ năng rồi bấm “Tôi đã ghi nhớ vai”. Ma Sói sẽ thấy tên đồng đội.',
  },
  {
    phase: 'Ban đêm',
    what: 'Cả làng “ngủ”. Các vai có kỹ năng lần lượt được gọi dậy: Cupid (đêm 1) → Bảo Vệ → Bầy Sói → Tiên Tri → Phù Thủy.',
    you: 'Nếu tới lượt vai của bạn, màn hình sẽ hiện bảng chọn — chọn mục tiêu và xác nhận. Nếu không, bạn chỉ cần chờ (đừng nhìn màn hình người khác!).',
  },
  {
    phase: 'Bình minh',
    what: 'Hệ thống công bố ai đã chết trong đêm (không nói nguyên nhân). Vai của người chết có thể được lật tùy luật phòng.',
    you: 'Ghi nhớ thông tin. Nếu Thợ Săn chết vì Sói, Thợ Săn được bắn một người ngay lúc này.',
  },
  {
    phase: 'Thảo luận',
    what: 'Cả làng tranh luận để tìm ra Sói. Có đồng hồ đếm ngược.',
    you: 'Nói chuyện trực tiếp hoặc qua Discord. Khi mọi người còn sống đều bấm “Sẵn sàng bỏ phiếu”, giai đoạn sẽ kết thúc sớm.',
  },
  {
    phase: 'Bỏ phiếu',
    what: 'Mỗi người còn sống có một phiếu. Người nhiều phiếu nhất bị loại. Hòa → bỏ phiếu lại giữa những người hòa; vẫn hòa → không ai chết.',
    you: 'Chạm vào người bạn nghi ngờ rồi bấm “Khóa phiếu” (hoặc “Bỏ phiếu trắng”). Trước khi khóa bạn vẫn đổi được lựa chọn.',
  },
  {
    phase: 'Kết thúc',
    what: 'Làng thắng khi tất cả Sói bị loại. Sói thắng khi số Sói còn sống ≥ số người còn lại.',
    you: 'Mọi lá bài được lật, kèm diễn biến từng đêm. Chủ phòng có thể bấm “Chơi lại cùng nhóm” để chia vai mới.',
  },
];

export interface RoleGuide {
  how: string;
  tips: string[];
}

export const ROLE_GUIDE: Record<RoleId, RoleGuide> = {
  villager: {
    how: 'Bạn không có kỹ năng đêm. Vũ khí của bạn là lý lẽ và lá phiếu.',
    tips: [
      'Để ý ai nói mâu thuẫn, ai né tránh, ai bỏ phiếu theo đám đông vào phút chót.',
      'Đừng giả làm vai khác quá lộ — bạn có thể khiến Sói nhắm vào người có vai thật.',
    ],
  },
  werewolf: {
    how: 'Mỗi đêm, chọn một con mồi trên màn hình. Bạn thấy lựa chọn của đồng đội theo thời gian thực — cả bầy cần chọn cùng một người. Hết giờ, lựa chọn nhiều phiếu nhất được dùng.',
    tips: [
      'Ban ngày hãy hành xử như dân làng, đừng bảo vệ đồng đội quá lộ liễu.',
      'Ưu tiên loại bỏ người có vẻ là Tiên Tri hoặc người lý luận sắc bén.',
      'Có thể chọn “Đêm nay không giết” nếu cả bầy muốn gây nhiễu.',
    ],
  },
  seer: {
    how: 'Mỗi đêm chọn một người để soi. Kết quả hiện ngay trong một hộp thoại riêng: “thuộc phe Sói” hoặc “không phải Sói”. Xem lại mọi kết quả trong Sổ tay (nút thẻ bài ở thanh trên).',
    tips: [
      'Đừng lộ diện quá sớm — Sói sẽ săn bạn ngay đêm sau.',
      'Khi đã tìm ra Sói, hãy chọn thời điểm công bố để cả làng cùng bỏ phiếu.',
    ],
  },
  guardian: {
    how: 'Mỗi đêm chọn một người để che chở khỏi bầy Sói (có thể bỏ qua). Không được che cùng một người hai đêm liên tiếp.',
    tips: ['Che người có vẻ quan trọng (Tiên Tri lộ diện).', 'Bảo vệ không chặn được bình độc của Phù Thủy.'],
  },
  witch: {
    how: 'Bạn thấy ai bị Sói tấn công đêm đó. Chọn: dùng bình cứu, dùng bình độc lên một người, hoặc không làm gì. Mỗi bình chỉ dùng một lần cả trận, không dùng cả hai trong một đêm.',
    tips: ['Bình cứu quý nhất ở những đêm đầu.', 'Chỉ dùng bình độc khi khá chắc chắn ai là Sói.'],
  },
  hunter: {
    how: 'Nếu bạn chết vì Sói hoặc bị dân làng treo cổ, bạn được bắn một người ngay lập tức. Chết vì độc thì không được bắn.',
    tips: ['Hãy để ý ai đáng ngờ nhất từ sớm — bạn có thể phải quyết định trong vài giây.'],
  },
  cupid: {
    how: 'Đêm đầu tiên chọn hai người để ghép đôi (có thể gồm chính bạn). Một người chết, người kia chết theo.',
    tips: ['Ghép một Sói với một dân làng tạo ra phe Cặp Đôi — họ thắng nếu chỉ còn hai người họ.'],
  },
  elder: {
    how: 'Bị động: bạn sống sót qua lần đầu bị bầy Sói tấn công.',
    tips: ['Bạn có thể mạnh dạn dẫn dắt thảo luận — Sói khó hạ bạn ngay.'],
  },
  white_wolf: {
    how: 'Bạn săn cùng bầy Sói. Ở các đêm chẵn bạn có thêm lượt riêng để loại một Sói khác. Bạn thắng một mình nếu là người cuối cùng sống sót.',
    tips: ['Đừng phản bội quá sớm — bạn vẫn cần bầy để loại dân làng.'],
  },
};

export const MODERATOR_GUIDE = [
  ['Bảng điều khiển', 'Bạn thấy toàn bộ vai, trạng thái sống/chết, ai đã hành động, phiếu bầu và nhật ký bí mật. Người chơi không bao giờ thấy những thông tin này.'],
  ['Chuyển giai đoạn', 'Bấm “Giai đoạn tiếp” để gọi vai kế tiếp hoặc sang ngày/đêm. Hết giờ hệ thống chỉ khóa hành động — bạn quyết định khi nào đi tiếp.'],
  ['Lời dẫn gợi ý', 'Ô “Lời dẫn gợi ý” có sẵn câu để bạn đọc to cho cả làng.'],
  ['Xác nhận kết quả', 'Cuối đêm và sau khi bỏ phiếu, hệ thống đề xuất kết quả. Bạn có thể công bố ngay hoặc điều chỉnh (mọi điều chỉnh đều được ghi nhật ký).'],
  ['Đồng hồ', 'Tạm dừng / tiếp tục, ±30 giây, khóa hoặc mở lại lượt hành động khi cần.'],
  ['Kết thúc trận', 'Có thể kết thúc sớm với đội thắng tùy chọn hoặc hủy trận.'],
];

export const FAQ: [string, string][] = [
  ['Tôi lỡ tải lại trang hoặc mất mạng?', 'Cứ mở lại link phòng trên cùng trình duyệt — bạn sẽ quay về đúng nhân vật. Phiên được lưu trên máy của bạn.'],
  ['Tôi không kịp hành động trước khi hết giờ?', 'Hệ thống coi như bạn không dùng kỹ năng đêm đó (Sói: lấy lựa chọn nhiều phiếu nhất của bầy; bỏ phiếu: không tính).'],
  ['Chủ phòng thoát giữa trận thì sao?', 'Ở chế độ tự động, trận vẫn tiếp tục bình thường. Nếu tất cả mọi người mất kết nối, trận tạm dừng và tự tiếp tục khi có người quay lại.'],
  ['Có cần voice chat không?', 'Không bắt buộc. Hãy ngồi cùng nhau hoặc dùng Discord/Zalo để thảo luận ban ngày.'],
  ['Người chết làm gì?', 'Bạn tiếp tục xem diễn biến công khai (nếu phòng cho phép) nhưng không được nói, không bỏ phiếu và không dùng kỹ năng.'],
  ['Lời dẫn giọng nói không chạy?', 'Bấm biểu tượng micro ở thanh trên. Một số trình duyệt chưa có giọng tiếng Việt — khi đó lời dẫn vẫn hiển thị bằng chữ.'],
];

const PROMPT_HELP: Record<ActionPrompt['kind'], string> = {
  ACK_ROLE: 'Chạm lá bài để lật, đọc kỹ năng rồi bấm “Tôi đã ghi nhớ vai”.',
  CUPID_LINK: 'Chọn đúng hai người rồi bấm “Se duyên”. Họ sẽ biết nhau và sống chết có nhau.',
  GUARD_PROTECT: 'Chạm một người để bảo vệ rồi bấm “Bảo vệ”, hoặc bấm “Không bảo vệ ai”.',
  WOLF_VOTE: 'Chạm vào con mồi. Lựa chọn của đồng đội hiện ở phía trên — cả bầy cần thống nhất một người. Bạn có thể đổi lựa chọn đến khi hết giờ.',
  WHITE_WOLF_KILL: 'Chọn một Sói để loại, hoặc bấm “Bỏ qua”.',
  SEER_CHECK: 'Chạm một người rồi bấm “Soi”. Kết quả hiện ngay và được lưu trong Sổ tay.',
  WITCH_ACT: 'Xem ai bị tấn công. Bật “Bình cứu” để cứu họ, hoặc chọn một người để đầu độc, rồi bấm xác nhận. Không làm gì cũng được.',
  HUNTER_SHOOT: 'Bạn đã chết nhưng còn một viên đạn: chọn một người rồi bấm “Bắn”, hoặc “Hạ súng”.',
  SKIP_DISCUSSION: 'Thảo luận với cả làng. Khi bạn sẵn sàng, bấm “Sẵn sàng bỏ phiếu”.',
  VOTE: 'Chạm vào người bạn nghi ngờ rồi bấm “Khóa phiếu”, hoặc bấm “Bỏ phiếu trắng”.',
};

/** What should I do right now? */
export function contextualHelp(view: GameView): { title: string; lines: string[] } {
  const me = view.me;
  const prompt = me?.prompt;
  if (view.viewer === 'spectator') return { title: 'Bạn đang xem', lines: ['Bạn chỉ thấy thông tin công khai. Hãy thưởng thức trận đấu!'] };
  if (me && !me.alive && view.phase.type !== 'GAME_OVER' && view.phase.type !== 'HUNTER_SHOT') {
    return { title: 'Bạn đã chết', lines: ['Bạn không thể nói, bỏ phiếu hay dùng kỹ năng nữa.', 'Hãy theo dõi trận đấu và giữ bí mật những gì bạn biết.'] };
  }
  if (prompt) return { title: 'Đến lượt bạn!', lines: [PROMPT_HELP[prompt.kind], ...(me ? [ROLE_GUIDE[me.role].how] : [])] };
  const step = view.phase.type === 'NIGHT' ? view.phase.step : null;
  switch (view.phase.type) {
    case 'ROLE_REVEAL':
      return { title: 'Nhận vai', lines: ['Đợi những người khác xem vai xong.'] };
    case 'NIGHT':
      return {
        title: 'Ban đêm',
        lines: [
          me?.submitted ? 'Bạn đã hành động. Hãy chờ đến sáng.' : 'Không phải lượt của bạn. Hãy nhắm mắt chờ — đừng nhìn màn hình người khác.',
          step ? `Hiện tại vai đang được gọi: ${step === 'WEREWOLVES' ? 'Bầy Sói' : step === 'GUARD' ? 'Bảo Vệ' : step === 'SEER' ? 'Tiên Tri' : step === 'WITCH' ? 'Phù Thủy' : step === 'CUPID' ? 'Cupid' : 'Sói Trắng'}.` : '',
        ].filter(Boolean),
      };
    case 'DAWN':
      return { title: 'Bình minh', lines: ['Xem ai đã chết trong đêm. Thảo luận sẽ bắt đầu ngay sau đó.'] };
    case 'HUNTER_SHOT':
      return { title: 'Thợ Săn', lines: ['Thợ Săn đang chọn người để bắn. Hãy chờ.'] };
    case 'DAY_DISCUSSION':
      return { title: 'Thảo luận', lines: [PROMPT_HELP.SKIP_DISCUSSION] };
    case 'VOTING':
      return { title: 'Bỏ phiếu', lines: [me?.submitted ? 'Bạn đã khóa phiếu. Chờ mọi người.' : PROMPT_HELP.VOTE] };
    case 'VOTE_RESULT':
      return { title: 'Kết quả bỏ phiếu', lines: ['Xem kết quả. Nếu Thợ Săn bị loại, Thợ Săn được bắn trước khi trời tối.'] };
    case 'GAME_OVER':
      return { title: 'Kết thúc', lines: ['Xem lại vai của mọi người và diễn biến trận. Chủ phòng có thể bắt đầu ván mới.'] };
  }
}
