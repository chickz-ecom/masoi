import { ROLES, type RoleId, type Team } from '@masoi/engine';
import { Crosshair, Crown, Eye, FlaskConical, Heart, House, PawPrint, Shield, Snowflake, type LucideIcon } from 'lucide-react';

/** Technical placeholder glyphs (used until the official artwork is delivered). */
export const ROLE_GLYPH: Record<RoleId, LucideIcon> = {
  villager: House,
  werewolf: PawPrint,
  seer: Eye,
  guardian: Shield,
  witch: FlaskConical,
  hunter: Crosshair,
  cupid: Heart,
  elder: Crown,
  white_wolf: Snowflake,
};

export const TEAM_LABEL: Record<Team, string> = {
  village: 'Phe Làng',
  werewolf: 'Phe Sói',
  special: 'Phe Đặc biệt',
};

export const TEAM_STYLE: Record<Team, { ring: string; text: string; glow: string; from: string }> = {
  village: { ring: 'border-team-village/70', text: 'text-team-village', glow: 'shadow-[0_0_40px_-8px_rgb(210_176_106/0.55)]', from: 'from-[#3a2f17]' },
  werewolf: { ring: 'border-team-werewolf/70', text: 'text-team-werewolf', glow: 'shadow-[0_0_40px_-8px_rgb(214_64_79/0.6)]', from: 'from-[#3d0f18]' },
  special: { ring: 'border-team-special/70', text: 'text-team-special', glow: 'shadow-[0_0_40px_-8px_rgb(169_139_224/0.6)]', from: 'from-[#2a1d48]' },
};

export function roleName(role: RoleId | null | undefined): string {
  return role ? ROLES[role].name : 'Không rõ';
}

export function roleTeam(role: RoleId): Team {
  return ROLES[role].team;
}
