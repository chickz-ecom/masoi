'use client';

import type { PlayerView } from '@masoi/engine';
import { PlayerGrid, PlayerToken } from './PlayerToken';

/** Grid of players where only `targets` are selectable. Pure UI: the server re-validates every choice. */
export function TargetPicker({
  players,
  targets,
  selected,
  onToggle,
  badges,
  disabled,
}: {
  players: PlayerView[];
  targets: string[];
  selected: string[];
  onToggle: (id: string) => void;
  badges?: Record<string, React.ReactNode>;
  disabled?: boolean;
}) {
  return (
    <PlayerGrid>
      {players.map((p) => {
        const selectable = !disabled && targets.includes(p.id);
        return (
          <div key={p.id} className={selectable || selected.includes(p.id) ? '' : 'opacity-50'}>
            <PlayerToken
              player={p}
              selectable={selectable}
              selected={selected.includes(p.id)}
              onSelect={() => onToggle(p.id)}
              badge={badges?.[p.id]}
            />
          </div>
        );
      })}
    </PlayerGrid>
  );
}
