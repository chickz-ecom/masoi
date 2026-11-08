import type { NightStepId, RoleId, Team } from './types';

/**
 * Declarative role definitions (Role Engine).
 * Resolution logic lives in night.ts / deaths.ts and reads these definitions;
 * UI only reads names/descriptions — never rules.
 */
export interface RoleDefinition {
  id: RoleId;
  name: string; // Vietnamese display name
  nameEn: string;
  team: Team;
  /** Counted as wolf for win conditions and seer checks. */
  isWolf: boolean;
  description: string;
  ability: string;
  /** Night step in which this role acts (collection order), if any. */
  nightStep: NightStepId | null;
  /** Lower = applied earlier at dawn resolution. */
  resolutionPriority: number | null;
  /** Max copies in a deck (null = unlimited). */
  maxCount: number | null;
  usage: string;
  targetRules: string;
  /** Requires `enableAdvancedRoles`. */
  advanced: boolean;
  /** Visibility of this role to other players. */
  visibility: string;
  winCondition: string;
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  villager: {
    id: 'villager',
    name: 'Dân Làng',
    nameEn: 'Villager',
    team: 'village',
    isWolf: false,
    description: 'Người dân bình thường của ngôi làng, không có năng lực đặc biệt.',
    ability: 'Thảo luận, suy luận và bỏ phiếu vào ban ngày.',
    nightStep: null,
    resolutionPriority: null,
    maxCount: null,
    usage: 'Không có kỹ năng.',
    targetRules: '—',
    advanced: false,
    visibility: 'Chỉ bản thân biết vai.',
    winCondition: 'Phe Làng thắng khi tất cả Sói bị loại.',
  },
  werewolf: {
    id: 'werewolf',
    name: 'Ma Sói',
    nameEn: 'Werewolf',
    team: 'werewolf',
    isWolf: true,
    description: 'Kẻ săn mồi ẩn mình giữa dân làng. Ban ngày giả làm người, ban đêm cùng bầy đi săn.',
    ability: 'Mỗi đêm cùng bầy Sói thống nhất chọn một người để tấn công.',
    nightStep: 'WEREWOLVES',
    resolutionPriority: 10,
    maxCount: null,
    usage: 'Mỗi đêm.',
    targetRules: 'Một người còn sống không thuộc phe Sói.',
    advanced: false,
    visibility: 'Các Sói biết nhau.',
    winCondition: 'Phe Sói thắng khi số Sói còn sống ≥ số người còn lại.',
  },
  seer: {
    id: 'seer',
    name: 'Tiên Tri',
    nameEn: 'Seer',
    team: 'village',
    isWolf: false,
    description: 'Người có thiên nhãn, nhìn thấu bản chất của người khác qua quả cầu pha lê.',
    ability: 'Mỗi đêm kiểm tra một người: biết người đó có thuộc phe Sói hay không.',
    nightStep: 'SEER',
    resolutionPriority: null,
    maxCount: 1,
    usage: 'Một lần mỗi đêm.',
    targetRules: 'Một người còn sống khác bản thân.',
    advanced: false,
    visibility: 'Chỉ bản thân biết vai.',
    winCondition: 'Phe Làng thắng khi tất cả Sói bị loại.',
  },
  guardian: {
    id: 'guardian',
    name: 'Bảo Vệ',
    nameEn: 'Guardian',
    team: 'village',
    isWolf: false,
    description: 'Hiệp sĩ canh gác ngôi làng trong đêm tối.',
    ability: 'Mỗi đêm bảo vệ một người khỏi đòn tấn công của bầy Sói.',
    nightStep: 'GUARD',
    resolutionPriority: 5,
    maxCount: 1,
    usage: 'Một lần mỗi đêm, không bảo vệ cùng một người hai đêm liên tiếp.',
    targetRules: 'Một người còn sống (có thể là bản thân theo cấu hình).',
    advanced: false,
    visibility: 'Chỉ bản thân biết vai.',
    winCondition: 'Phe Làng thắng khi tất cả Sói bị loại.',
  },
  witch: {
    id: 'witch',
    name: 'Phù Thủy',
    nameEn: 'Witch',
    team: 'village',
    isWolf: false,
    description: 'Bà lão thông thạo thảo dược, giữ hai bình thuốc quyền năng.',
    ability: 'Một bình cứu (cứu người bị Sói tấn công) và một bình độc (giết một người) cho cả trận.',
    nightStep: 'WITCH',
    resolutionPriority: 20,
    maxCount: 1,
    usage: 'Mỗi bình một lần trong cả trận; không dùng cả hai bình trong cùng một đêm.',
    targetRules: 'Bình cứu: người bị Sói tấn công đêm đó. Bình độc: người còn sống khác bản thân.',
    advanced: false,
    visibility: 'Chỉ bản thân biết vai.',
    winCondition: 'Phe Làng thắng khi tất cả Sói bị loại.',
  },
  hunter: {
    id: 'hunter',
    name: 'Thợ Săn',
    nameEn: 'Hunter',
    team: 'village',
    isWolf: false,
    description: 'Tay thợ săn lão luyện, không bao giờ ra đi một mình.',
    ability: 'Khi bị Sói giết hoặc bị dân làng treo cổ, được bắn chết một người.',
    nightStep: null,
    resolutionPriority: 40,
    maxCount: 1,
    usage: 'Một lần, khi chết vì Sói hoặc bỏ phiếu (không kích hoạt khi chết vì độc).',
    targetRules: 'Một người còn sống.',
    advanced: false,
    visibility: 'Chỉ bản thân biết vai.',
    winCondition: 'Phe Làng thắng khi tất cả Sói bị loại.',
  },
  cupid: {
    id: 'cupid',
    name: 'Cupid',
    nameEn: 'Cupid',
    team: 'village',
    isWolf: false,
    description: 'Cung thủ bí ẩn se duyên định mệnh.',
    ability: 'Đêm đầu tiên ghép hai người thành cặp đôi. Một người chết, người kia chết theo.',
    nightStep: 'CUPID',
    resolutionPriority: 30,
    maxCount: 1,
    usage: 'Một lần ở đêm đầu tiên.',
    targetRules: 'Hai người còn sống khác nhau (có thể gồm bản thân).',
    advanced: true,
    visibility: 'Cặp đôi biết nhau và biết vai của nhau.',
    winCondition: 'Theo phe gốc; cặp đôi khác phe thắng khi chỉ còn hai người họ.',
  },
  elder: {
    id: 'elder',
    name: 'Già Làng',
    nameEn: 'Elder',
    team: 'village',
    isWolf: false,
    description: 'Trưởng lão từng trải, sống sót qua nhiều mùa trăng máu.',
    ability: 'Sống sót qua lần đầu tiên bị bầy Sói tấn công.',
    nightStep: null,
    resolutionPriority: 15,
    maxCount: 1,
    usage: 'Bị động, một lần.',
    targetRules: '—',
    advanced: true,
    visibility: 'Chỉ bản thân biết vai.',
    winCondition: 'Phe Làng thắng khi tất cả Sói bị loại.',
  },
  white_wolf: {
    id: 'white_wolf',
    name: 'Sói Trắng',
    nameEn: 'White Wolf',
    team: 'special',
    isWolf: true,
    description: 'Sói đầu đàn lông trắng, chỉ trung thành với chính mình.',
    ability: 'Săn cùng bầy Sói; mỗi đêm chẵn có thể giết thêm một Sói khác.',
    nightStep: 'WHITE_WOLF',
    resolutionPriority: 25,
    maxCount: 1,
    usage: 'Đêm chẵn (2, 4, …).',
    targetRules: 'Một Sói khác còn sống.',
    advanced: true,
    visibility: 'Bầy Sói thấy Sói Trắng như một Sói thường.',
    winCondition: 'Thắng một mình khi là người sống sót duy nhất (hoặc thắng cùng phe Sói).',
  },
};

export const ROLE_LIST: RoleDefinition[] = Object.values(ROLES);

export function isWolfRole(role: RoleId): boolean {
  return ROLES[role].isWolf;
}

/** Night steps in collection order and which roles act in each. */
export const NIGHT_STEP_ROLES: Record<NightStepId, RoleId[]> = {
  CUPID: ['cupid'],
  GUARD: ['guardian'],
  WEREWOLVES: ['werewolf', 'white_wolf'],
  WHITE_WOLF: ['white_wolf'],
  SEER: ['seer'],
  WITCH: ['witch'],
};

export const NIGHT_STEP_LABELS: Record<NightStepId, string> = {
  CUPID: 'Cupid',
  GUARD: 'Bảo Vệ',
  WEREWOLVES: 'Bầy Sói',
  WHITE_WOLF: 'Sói Trắng',
  SEER: 'Tiên Tri',
  WITCH: 'Phù Thủy',
};
