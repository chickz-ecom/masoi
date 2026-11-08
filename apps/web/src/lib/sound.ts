'use client';

/**
 * Lightweight synthesized cues (no audio files required). Real audio assets can later be added
 * under public/assets/audio and wired here.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + start + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + duration);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + duration + 0.05);
}

export type Cue = 'night' | 'day' | 'tick' | 'vote' | 'death' | 'victory';

export function playCue(cue: Cue) {
  switch (cue) {
    case 'night':
      tone(110, 0, 2.2, 'sine', 0.25);
      tone(164.8, 0.15, 2.0, 'sine', 0.12);
      break;
    case 'day':
      tone(523.25, 0, 0.6, 'triangle', 0.12);
      tone(659.25, 0.18, 0.6, 'triangle', 0.12);
      tone(783.99, 0.36, 0.9, 'triangle', 0.12);
      break;
    case 'tick':
      tone(880, 0, 0.12, 'square', 0.05);
      break;
    case 'vote':
      tone(196, 0, 0.5, 'sawtooth', 0.06);
      tone(146.8, 0.2, 0.7, 'sawtooth', 0.05);
      break;
    case 'death':
      tone(98, 0, 1.6, 'sine', 0.3);
      tone(73.4, 0.1, 1.8, 'sine', 0.2);
      break;
    case 'victory':
      [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.15, 0.8, 'triangle', 0.1));
      break;
  }
}

/** Must be called from a user gesture once to unlock audio on mobile. */
export function unlockAudio() {
  audio();
}
