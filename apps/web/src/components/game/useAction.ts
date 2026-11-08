'use client';

import type { Ack } from '@masoi/shared';
import { useCallback, useState } from 'react';
import { errorText } from '@/lib/roomClient';

/** Tracks submitting / error state for a server intent. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<Ack<T>>): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(errorText(res.error));
        return false;
      }
      return true;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending, error, setError };
}
