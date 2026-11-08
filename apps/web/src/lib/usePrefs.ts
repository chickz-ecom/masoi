'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface Prefs {
  narration: boolean;
  sound: boolean;
}

const KEY = 'masoi.prefs.v1';
const DEFAULTS: Prefs = { narration: true, sound: true };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const prefs = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULTS,
  );
  const update = useCallback((patch: Partial<Prefs>) => {
    cache = { ...read(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return [prefs, update];
}
