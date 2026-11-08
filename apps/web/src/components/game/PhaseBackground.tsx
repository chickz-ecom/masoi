'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BACKGROUNDS, resolveAsset, type BackgroundKey } from '@/lib/assets';

const PLACEHOLDER_GRADIENT: Record<BackgroundKey, string> = {
  landing: 'radial-gradient(circle at 72% 18%, #2c2a5c 0%, transparent 45%), linear-gradient(180deg, #0d1030 0%, #080a18 60%, #05060c 100%)',
  lobby: 'radial-gradient(circle at 30% 70%, rgb(201 130 60 / 0.22) 0%, transparent 45%), linear-gradient(180deg, #17121f 0%, #0b0a12 100%)',
  'role-reveal': 'radial-gradient(circle at 50% 40%, #2a1f4d 0%, transparent 55%), linear-gradient(180deg, #0b0a18, #05060c)',
  night: 'radial-gradient(circle at 78% 14%, #26305e 0%, transparent 40%), linear-gradient(180deg, #070a1c 0%, #04050b 100%)',
  day: 'radial-gradient(circle at 50% 0%, rgb(236 180 110 / 0.35) 0%, transparent 55%), linear-gradient(180deg, #2b2340 0%, #14121f 100%)',
  discussion: 'radial-gradient(circle at 50% 10%, rgb(236 190 120 / 0.25) 0%, transparent 50%), linear-gradient(180deg, #241d33, #100e18)',
  voting: 'radial-gradient(circle at 50% 20%, rgb(142 26 43 / 0.35) 0%, transparent 50%), linear-gradient(180deg, #1c1222, #0b080f)',
  elimination: 'radial-gradient(circle at 50% 30%, rgb(142 26 43 / 0.45) 0%, transparent 55%), linear-gradient(180deg, #170a10, #070407)',
  'victory-village': 'radial-gradient(circle at 50% 0%, rgb(255 205 130 / 0.45) 0%, transparent 60%), linear-gradient(180deg, #33283f, #15111c)',
  'victory-werewolf': 'radial-gradient(circle at 70% 15%, rgb(200 30 45 / 0.55) 0%, transparent 45%), linear-gradient(180deg, #1a0a10, #070306)',
  moderator: 'radial-gradient(circle at 20% 80%, rgb(201 130 60 / 0.18) 0%, transparent 45%), linear-gradient(180deg, #14111c, #08070c)',
};

const NIGHTLIKE: BackgroundKey[] = ['landing', 'night', 'role-reveal', 'victory-werewolf'];

/**
 * Full-screen cinematic background for a phase. Uses the official art when delivered (desktop / mobile
 * variants), otherwise a technical gradient placeholder with CSS moon & fog layers.
 */
export function PhaseBackground({ bg, dim = 0.55 }: { bg: BackgroundKey; dim?: number }) {
  const reduce = useReducedMotion();
  const desktop = resolveAsset(BACKGROUNDS[bg].desktop);
  const mobile = resolveAsset(BACKGROUNDS[bg].mobile);
  const showMoon = NIGHTLIKE.includes(bg);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <AnimatePresence mode="sync">
        <motion.div
          key={bg}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: 'easeInOut' }}
        >
          {desktop ? (
            <picture>
              {mobile ? <source media="(max-aspect-ratio: 3/4)" srcSet={mobile.srcSet ?? mobile.src} /> : null}
              <img
                src={desktop.src}
                srcSet={desktop.srcSet ?? undefined}
                sizes="100vw"
                alt=""
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
            </picture>
          ) : (
            <div className="h-full w-full" style={{ background: PLACEHOLDER_GRADIENT[bg] }}>
              {showMoon ? (
                <div
                  className="absolute right-[12%] top-[8%] h-28 w-28 animate-glow rounded-full sm:h-40 sm:w-40"
                  style={{
                    background:
                      bg === 'victory-werewolf'
                        ? 'radial-gradient(circle at 35% 35%, #ffb3a8, #c2283a 55%, #5c0d16 100%)'
                        : 'radial-gradient(circle at 35% 35%, #ffffff, #d9e1ff 45%, #8d97c7 100%)',
                    boxShadow:
                      bg === 'victory-werewolf' ? '0 0 120px 30px rgb(214 64 79 / 0.35)' : '0 0 120px 30px rgb(217 225 255 / 0.18)',
                  }}
                />
              ) : null}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {/* fog layer */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden opacity-40">
        <div
          className="h-full w-[200%] animate-fog"
          style={{
            background:
              'radial-gradient(ellipse 30% 50% at 15% 80%, rgb(200 205 230 / 0.18), transparent 70%), radial-gradient(ellipse 25% 40% at 45% 90%, rgb(200 205 230 / 0.14), transparent 70%), radial-gradient(ellipse 30% 50% at 65% 85%, rgb(200 205 230 / 0.18), transparent 70%), radial-gradient(ellipse 25% 40% at 95% 90%, rgb(200 205 230 / 0.14), transparent 70%)',
          }}
        />
      </div>
      {/* readability scrim */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgb(6 7 13 / ${dim * 0.6}) 0%, rgb(6 7 13 / ${dim}) 55%, rgb(6 7 13 / ${Math.min(0.95, dim + 0.3)}) 100%)` }} />
    </div>
  );
}
