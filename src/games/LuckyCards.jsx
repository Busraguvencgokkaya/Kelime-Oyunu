// Quiz Show "Şans Kartları" turu: kartlar açık gösterilir, kapanır, karışır; öğrenci birini seçer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../lib/sound.js';
import { shuffle } from '../lib/util.js';

const GOOD_POINTS = [
  { id: 'p200', face: '+200', title: '+200 puan', tone: 'good', points: 200 },
  { id: 'p100', face: '+100', title: '+100 puan', tone: 'good', points: 100 },
];
const POWERS = [
  { id: 'x2', face: '×2', title: 'Sonraki doğru cevap 2 kat puan!', tone: 'power' },
  { id: 'speed', face: '⚡', title: 'Hız! 3 soru hız bonusu 2 kat.', tone: 'power' },
  { id: 'shield', face: '🛡', title: 'Kalkan! Bir yanlış serini bozmaz.', tone: 'power' },
];
const BAD = [
  { id: 'm50', face: '−50', title: '−50 puan', tone: 'bad', points: -50 },
  { id: 'm100', face: '−100', title: '−100 puan', tone: 'bad', points: -100 },
];

export function dealCards(level) {
  const bad = level >= 3 && Math.random() < 0.5 ? BAD[1] : BAD[0];
  const pts = shuffle(GOOD_POINTS)[0];
  const rest = shuffle([...GOOD_POINTS.filter((c) => c.id !== pts.id), ...POWERS]).slice(0, 2);
  return shuffle([bad, pts, ...rest]);
}

export default function LuckyCards({ level, onDone }) {
  const cards = useMemo(() => dealCards(level), [level]);
  const [stage, setStage] = useState('show'); // show | hidden | shuffle | pick | chosen | all
  const [slots, setSlots] = useState([0, 1, 2, 3]); // kart k → slots[k] konumu
  const [chosen, setChosen] = useState(null);
  const [narrow, setNarrow] = useState(() => innerWidth < 600);
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => {
    const f = () => setNarrow(innerWidth < 600);
    addEventListener('resize', f);
    return () => { removeEventListener('resize', f); timers.current.forEach(clearTimeout); };
  }, []);

  const steps = Math.min(4 + level * 2, 14);
  const speed = Math.max(230, 560 - level * 70);

  useEffect(() => {
    later(() => { setStage('hidden'); sfx.click(); }, 2200);
    later(() => setStage('shuffle'), 2900);
  }, []);

  useEffect(() => {
    if (stage !== 'shuffle') return;
    let s = 0;
    const id = setInterval(() => {
      s++;
      setSlots((cur) => {
        const a = Math.floor(Math.random() * 4);
        let b = Math.floor(Math.random() * 3);
        if (b >= a) b++;
        const next = cur.slice();
        const ka = next.indexOf(a), kb = next.indexOf(b);
        next[ka] = b; next[kb] = a;
        return next;
      });
      sfx.tick();
      if (s >= steps) { clearInterval(id); later(() => setStage('pick'), speed + 80); }
    }, speed);
    return () => clearInterval(id);
  }, [stage]);

  function pick(k) {
    if (stage !== 'pick') return;
    setChosen(k);
    setStage('chosen');
    const c = cards[k];
    c.tone === 'bad' ? sfx.wrong() : sfx.power();
    later(() => setStage('all'), 900);
    later(() => onDone(c), 2600);
  }

  const pos = (slot) => (narrow
    ? { left: `${(slot % 2) * 50}%`, top: `${Math.floor(slot / 2) * 50}%`, width: '50%', height: '50%' }
    : { left: `${slot * 25}%`, top: 0, width: '25%', height: '100%' });

  const faceUp = (k) => stage === 'show' || stage === 'all' || (stage === 'chosen' && k === chosen);
  const msg = {
    show: 'Kartlara bak!', hidden: 'Takip et!', shuffle: 'Takip et!', pick: 'Hangisi? Seç!',
    chosen: cards[chosen]?.title, all: cards[chosen]?.title,
  }[stage];

  return (
    <div className="game game-quiz lucky">
      <p className="splash-small">Şans Kartları</p>
      <h2 className={`lucky-msg ${chosen !== null ? `tone-${cards[chosen].tone}` : ''}`} aria-live="polite">{msg}</h2>
      <div className={`lucky-table ${narrow ? 'narrow' : ''}`}>
        {cards.map((c, k) => (
          <div key={c.id} className="lucky-slot" style={{ ...pos(slots[k]), transitionDuration: `${Math.round(speed * 0.85)}ms` }}>
            <button
              type="button"
              className={`lucky-card ${faceUp(k) ? 'up' : ''} ${chosen === k ? 'chosen' : ''} ${stage === 'all' && chosen !== k ? 'other' : ''}`}
              onClick={() => pick(k)}
              disabled={stage !== 'pick'}
              aria-label={faceUp(k) ? c.title : `Kart ${k + 1}`}
            >
              <span className="lucky-inner">
                <span className="lucky-back" aria-hidden="true">?</span>
                <span className={`lucky-front tone-${c.tone}`}>{c.face}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
