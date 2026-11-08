import type { RoleId } from '@masoi/engine';
import availability from '@/generated/asset-availability.json';

/**
 * Asset manifest — the ONLY place that knows asset paths, sizes and priorities.
 * Masters are produced with ChatGPT (see docs/chatgpt-image-prompts.md) and dropped into
 * public/assets/<folder>/. `npm run assets:optimize` creates WebP variants in `_generated/`,
 * `npm run assets:check` validates sizes and writes src/generated/asset-availability.json.
 * Missing artwork falls back to a technical CSS placeholder (never stock images or emoji).
 */
export const ASSET_VERSION = 1;

export type Priority = 'P0' | 'P1' | 'P2';
export interface AssetEntry {
  key: string;
  /** Path of the master file under /public. */
  src: string;
  width: number;
  height: number;
  priority: Priority;
  alt: string;
}

const card = (file: string, alt: string, priority: Priority): AssetEntry => ({
  key: `cards/${file}`,
  src: `/assets/cards/${file}.png`,
  width: 1024,
  height: 1536,
  priority,
  alt,
});

export const ROLE_CARDS: Record<RoleId, AssetEntry> = {
  villager: card('villager', 'Dân Làng', 'P0'),
  werewolf: card('werewolf', 'Ma Sói', 'P0'),
  seer: card('seer', 'Tiên Tri', 'P0'),
  witch: card('witch', 'Phù Thủy', 'P0'),
  guardian: card('guardian', 'Bảo Vệ', 'P0'),
  hunter: card('hunter', 'Thợ Săn', 'P0'),
  cupid: card('cupid', 'Cupid', 'P2'),
  elder: card('elder', 'Già Làng', 'P2'),
  white_wolf: card('white-wolf', 'Sói Trắng', 'P2'),
};

export const CARD_BACK: AssetEntry = {
  key: 'card-backs/card-back',
  src: '/assets/card-backs/card-back.png',
  width: 1024,
  height: 1536,
  priority: 'P0',
  alt: 'Mặt sau lá bài Ma Sói',
};

export const BACKGROUND_KEYS = [
  'landing',
  'lobby',
  'role-reveal',
  'night',
  'day',
  'discussion',
  'voting',
  'elimination',
  'victory-village',
  'victory-werewolf',
  'moderator',
] as const;
export type BackgroundKey = (typeof BACKGROUND_KEYS)[number];

export interface BackgroundAsset {
  desktop: AssetEntry;
  mobile: AssetEntry;
}

export const BACKGROUNDS: Record<BackgroundKey, BackgroundAsset> = Object.fromEntries(
  BACKGROUND_KEYS.map((k) => [
    k,
    {
      desktop: { key: `backgrounds/${k}`, src: `/assets/backgrounds/${k}.png`, width: 1536, height: 1024, priority: 'P0', alt: '' },
      mobile: {
        key: `backgrounds/${k}-mobile`,
        src: `/assets/backgrounds/${k}-mobile.png`,
        width: 1024,
        height: 1536,
        priority: 'P1',
        alt: '',
      },
    },
  ]),
) as Record<BackgroundKey, BackgroundAsset>;

const icon = (folder: string, file: string, alt: string, priority: Priority, size = 1024): AssetEntry => ({
  key: `${folder}/${file}`,
  src: `/assets/${folder}/${file}.png`,
  width: size,
  height: size,
  priority,
  alt,
});

export const ROLE_ICONS: Record<RoleId, AssetEntry> = {
  villager: icon('icons', 'role-villager', 'Dân Làng', 'P0'),
  werewolf: icon('icons', 'role-werewolf', 'Ma Sói', 'P0'),
  seer: icon('icons', 'role-seer', 'Tiên Tri', 'P0'),
  witch: icon('icons', 'role-witch', 'Phù Thủy', 'P0'),
  guardian: icon('icons', 'role-guardian', 'Bảo Vệ', 'P0'),
  hunter: icon('icons', 'role-hunter', 'Thợ Săn', 'P0'),
  cupid: icon('icons', 'role-cupid', 'Cupid', 'P2'),
  elder: icon('icons', 'role-elder', 'Già Làng', 'P2'),
  white_wolf: icon('icons', 'role-white-wolf', 'Sói Trắng', 'P2'),
};

export const TEAM_ICONS = {
  village: icon('icons', 'team-village', 'Phe Làng', 'P0'),
  werewolf: icon('icons', 'team-werewolf', 'Phe Sói', 'P0'),
  special: icon('icons', 'team-special', 'Phe Đặc biệt', 'P2'),
} as const;

export const EFFECTS = {
  moonFull: icon('effects', 'moon-full', 'Trăng tròn', 'P0'),
  moonBlood: icon('effects', 'moon-blood', 'Trăng máu', 'P1'),
  transitionDusk: { ...icon('effects', 'transition-dusk', '', 'P1'), width: 1536, height: 1024 },
  transitionDawn: { ...icon('effects', 'transition-dawn', '', 'P1'), width: 1536, height: 1024 },
  potionHeal: icon('effects', 'potion-heal', 'Bình cứu', 'P1'),
  potionPoison: icon('effects', 'potion-poison', 'Bình độc', 'P1'),
  voteToken: icon('effects', 'vote-token', 'Phiếu bầu', 'P1'),
  shield: icon('effects', 'shield', 'Khiên bảo vệ', 'P1'),
  victoryEmblem: icon('effects', 'victory-emblem', 'Chiến thắng', 'P1'),
  defeatEmblem: icon('effects', 'defeat-emblem', 'Thất bại', 'P1'),
  borderOrnament: { ...icon('effects', 'border-ornament', '', 'P1'), width: 1536, height: 1024 },
  fogOverlay: { ...icon('effects', 'fog-overlay', '', 'P1'), width: 1536, height: 1024 },
} as const;

export const LOGO = icon('logos', 'logo-emblem', 'Biểu tượng Ma Sói', 'P0');

type Availability = Record<string, { master: boolean; webp: number[] }>;
const AVAILABLE = availability as Availability;

/** Resolved, optimized sources for an asset, or null when the artwork has not been delivered yet. */
export function resolveAsset(entry: AssetEntry): { src: string; srcSet: string | null } | null {
  const info = AVAILABLE[entry.key];
  if (!info?.master) return null;
  const v = `?v=${ASSET_VERSION}`;
  if (info.webp.length === 0) return { src: `${entry.src}${v}`, srcSet: null };
  const base = entry.src.replace(/\/([^/]+)\.png$/, '/_generated/$1');
  const srcSet = info.webp.map((w) => `${base}-${w}.webp${v} ${w}w`).join(', ');
  return { src: `${base}-${info.webp[info.webp.length - 1]}.webp${v}`, srcSet };
}

/** Every manifest entry (used by the asset scripts via a JSON export). */
export function allAssets(): AssetEntry[] {
  return [
    ...Object.values(ROLE_CARDS),
    CARD_BACK,
    ...Object.values(BACKGROUNDS).flatMap((b) => [b.desktop, b.mobile]),
    ...Object.values(ROLE_ICONS),
    ...Object.values(TEAM_ICONS),
    ...Object.values(EFFECTS),
    LOGO,
  ];
}
