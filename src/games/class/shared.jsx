// Sınıf modu ortak parçaları: takımlar, soru kartları, tam ekran
import { useEffect, useState } from 'react';
import { shuffle } from '../../lib/util.js';
import { speak, useTurkishVoice } from '../../lib/speech.js';

export const TEAM_PRESETS = [
  { name: 'Kırmızı Takım', color: '#f2545b' },
  { name: 'Mavi Takım', color: '#2a7de1' },
  { name: 'Yeşil Takım', color: '#1fa866' },
  { name: 'Sarı Takım', color: '#f0b21a' },
];

const clean = (s) => (s || '').trim();
const noBrackets = (s) => clean(String(s || '').replace(/\s*\[[^\]]*\]/g, ''));

/**
 * Sözlü sorular için kartlar.
 * mode 'say_tr': resim (varsa) ve anlamlar gösterilir, Türkçesi söylenir.
 * mode 'say_meaning': Türkçe kelime gösterilir, anlamı söylenir.
 */
export function oralCards(set, mode) {
  const items = (set.items || []).filter((it) => (set.kind === 'words' ? clean(it.tr) : clean(it.prompt) || it.prompt_image));
  return shuffle(items).map((it) => {
    if (set.kind !== 'words') {
      return {
        id: it.id,
        show: { text: clean(it.prompt), image: it.prompt_image || null, lines: [] },
        answer: { main: clean(it.answer), image: it.answer_image || null, lines: [] },
      };
    }
    const meanings = [it.ky, it.ru, it.en].map(noBrackets).filter(Boolean);
    if (mode === 'say_meaning') {
      return {
        id: it.id,
        show: { text: noBrackets(it.tr), image: null, lines: [], speak: noBrackets(it.tr) },
        answer: { main: noBrackets(it.tr), image: it.image_url || null, lines: meanings },
      };
    }
    return {
      id: it.id,
      show: { text: '', image: it.image_url || null, lines: it.image_url ? [] : meanings },
      answer: { main: noBrackets(it.tr), image: null, lines: meanings, speak: noBrackets(it.tr) },
    };
  });
}

export function OralCard({ card, revealed }) {
  const voice = useTurkishVoice();
  const s = card.show;
  const a = card.answer;
  return (
    <div className="oral">
      <div className="oral-show">
        {s.image && <img src={s.image} alt="" className="oral-img" />}
        {s.text && <div className="oral-text">{s.text}{voice && s.speak && <button type="button" className="speak-btn" onClick={() => speak(s.speak)} aria-label="Sesli oku">🔊</button>}</div>}
        {s.lines.length > 0 && <div className="oral-lines">{s.lines.map((l, i) => <span key={i}>{l}</span>)}</div>}
      </div>
      {revealed && (
        <div className="oral-answer">
          {a.image && <img src={a.image} alt="" className="oral-img small" />}
          <div className="oral-main">{a.main}{voice && a.speak && <button type="button" className="speak-btn" onClick={() => speak(a.speak)} aria-label="Sesli oku">🔊</button>}</div>
          {a.lines.length > 0 && <div className="oral-lines">{a.lines.map((l, i) => <span key={i}>{l}</span>)}</div>}
        </div>
      )}
    </div>
  );
}

export function useFullscreen() {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const toggle = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } catch { /* desteklenmiyor */ }
  };
  return [on, toggle];
}

export function ClassBar({ title, onExit, children }) {
  const [fs, toggleFs] = useFullscreen();
  return (
    <div className="class-bar">
      <strong className="class-title">{title}</strong>
      <div className="class-bar-mid">{children}</div>
      <div className="row">
        <button className="btn btn-light btn-sm" onClick={toggleFs}>{fs ? 'Tam ekrandan çık' : 'Tam ekran'}</button>
        <button className="btn btn-light btn-sm" onClick={onExit}>Bitir</button>
      </div>
    </div>
  );
}

export function Winner({ teams, scores, onAgain, onExit, title = 'Kazanan' }) {
  const order = teams.map((t, i) => ({ ...t, score: scores[i] })).sort((a, b) => b.score - a.score);
  const tie = order.length > 1 && order[0].score === order[1].score;
  return (
    <div className="winner">
      <p className="splash-small">{tie ? 'Berabere!' : title}</p>
      {!tie && <h2 className="winner-name" style={{ color: order[0].color }}>{order[0].name}</h2>}
      <ol className="winner-list">
        {order.map((t) => <li key={t.name}><span className="dot" style={{ background: t.color }} />{t.name}<strong>{t.score}</strong></li>)}
      </ol>
      <div className="row center">
        <button className="btn btn-sun btn-lg" onClick={onAgain}>Tekrar oyna</button>
        <button className="btn btn-light btn-lg" onClick={onExit}>Çık</button>
      </div>
    </div>
  );
}
