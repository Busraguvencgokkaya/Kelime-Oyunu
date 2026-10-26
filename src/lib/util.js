import { useEffect, useState } from 'react';

// ---------- yönlendirme (#/yol) ----------
export function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => { setHash(location.hash); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}
export const go = (p) => { location.hash = p; };

// ---------- metin ----------
export function titleCaseTr(s) {
  return s.trim().replace(/\s+/g, ' ').split(' ')
    .map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr')).join(' ');
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtDuration(ms) {
  if (ms == null) return '–';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} dk ${String(s % 60).padStart(2, '0')} sn` : `${s} sn`;
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
export function fmtDate(iso, withTime = true) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) +
    (withTime ? ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
}

export function studentLink(slug) {
  return `${location.origin}${location.pathname}${location.search.includes('demo') ? '?demo' : ''}#/o/${slug}`;
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

// ---------- resim küçültme ----------
export async function resizeImage(file, max = 800) {
  if (file.type === 'image/gif') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const png = file.type === 'image/png';
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    const type = png ? 'image/png' : 'image/jpeg';
    let blob = await new Promise((r) => c.toBlob(r, type, 0.82));
    if (png && blob.size > 400000) blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
    return blob || file;
  } finally { URL.revokeObjectURL(url); }
}
