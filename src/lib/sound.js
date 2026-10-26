// Dosya gerektirmeyen küçük ses efektleri (Web Audio).
let ctx;
let muted = false;
try { muted = localStorage.getItem('ko-muted') === '1'; } catch { /* yok */ }

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('ko-muted', v ? '1' : '0'); } catch { /* yok */ }
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', vol = 0.18, slideTo) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock() { ac(); },
  correct() { if (muted) return; tone(660, 0, 0.12, 'triangle', 0.2); tone(990, 0.1, 0.22, 'triangle', 0.2); },
  wrong() { if (muted) return; tone(220, 0, 0.32, 'sawtooth', 0.09, 140); },
  tick() { if (muted) return; tone(1200, 0, 0.05, 'square', 0.05); },
  click() { if (muted) return; tone(500, 0, 0.05, 'triangle', 0.08); },
  power() { if (muted) return; tone(400, 0, 0.25, 'sine', 0.15, 1200); },
  level() { if (muted) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.16)); },
  finish() { if (muted) return; [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.24, 'triangle', 0.16)); },
  timeup() { if (muted) return; tone(300, 0, 0.5, 'square', 0.06, 120); },
};
