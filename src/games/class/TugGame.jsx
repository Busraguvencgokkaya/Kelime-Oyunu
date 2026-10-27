// Halat Çekme: iki takım. "split" modunda ekran ikiye bölünür, iki öğrenci aynı anda kendi tarafında cevaplar.
// "teacher" modunda soru ortada çıkar, önce doğru söyleyen takımı öğretmen seçer.
import { useEffect, useRef, useState } from 'react';
import { buildQuestions } from '../../lib/questions.js';
import { sfx } from '../../lib/sound.js';
import { OptionContent, Prompt } from '../common.jsx';
import { ClassBar, OralCard } from './shared.jsx';

function Rope({ pos, max, teams }) {
  // pos < 0: sol takım (A) kazanıyor, pos > 0: sağ takım (B)
  const pct = 50 + (pos / max) * 40;
  return (
    <div className="rope-wrap" aria-label={`İp konumu ${pos}`}>
      <div className="rope-team left" style={{ background: teams[0].color }}>{teams[0].name}</div>
      <div className="rope-track">
        <div className="rope-zone left" style={{ background: teams[0].color }} />
        <div className="rope-zone right" style={{ background: teams[1].color }} />
        <div className="rope-line" />
        <div className="rope-center" />
        <div className="rope-knot" style={{ left: `${pct}%` }}>
          <span className="rope-flag" />
        </div>
      </div>
      <div className="rope-team right" style={{ background: teams[1].color }}>{teams[1].name}</div>
    </div>
  );
}

function Side({ team, side, questions, onCorrect, disabled }) {
  const [i, setI] = useState(0);
  const [state, setState] = useState(null); // { picked, ok }
  const q = questions[i % questions.length];
  function pick(o) {
    if (state || disabled) return;
    const ok = !!o.correct;
    setState({ picked: o, ok });
    if (ok) { sfx.correct(); onCorrect(); } else sfx.wrong();
    setTimeout(() => { setState(null); setI((n) => n + 1); }, ok ? 700 : 1600);
  }
  return (
    <div className={`tug-side ${side} ${state ? (state.ok ? 'flash-ok' : 'flash-bad') : ''}`} style={{ '--team': team.color }}>
      <div className="tug-side-name" style={{ background: team.color }}>{team.name}</div>
      <Prompt q={q} key={`${side}-${i}`} />
      <div className="tug-options">
        {q.options.map((o, k) => {
          const st = state ? (o.correct ? 'right' : o === state.picked ? 'wrong' : 'dim') : '';
          return (
            <button key={k} className={`opt opt-${k} ${st}`} onPointerDown={(e) => { e.preventDefault(); pick(o); }} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(o)} disabled={!!state || disabled}>
              <OptionContent o={o} />
            </button>
          );
        })}
      </div>
      {state && !state.ok && <div className="tug-msg">Bir daha dene!</div>}
    </div>
  );
}

export default function TugGame({ title, set, cards, teams, mode, length, lang, direction, onExit }) {
  const max = length;
  const [pos, setPos] = useState(0);
  const [winner, setWinner] = useState(null);
  const [round, setRound] = useState(0);
  // İki taraf aynı anda konuşmasın diye otomatik sesli okuma kapalı
  const mkQs = () => buildQuestions({ kind: set.kind, items: set.items, direction, question_count: set.items.length }, lang).map((q) => ({ ...q, speak: false }));
  const qa = useRef(mkQs());
  const qb = useRef(mkQs());
  const [ci, setCi] = useState(0);
  const [revealed, setRevealed] = useState(false);

  function pull(d) {
    if (winner !== null) return;
    setPos((p) => {
      const np = Math.max(-max, Math.min(max, p + d));
      if (Math.abs(np) >= max) { setWinner(np < 0 ? 0 : 1); setTimeout(() => sfx.finish(), 300); }
      return np;
    });
  }
  function teacherPoint(team) {
    if (team === 0) pull(-1); else if (team === 1) pull(1);
    team !== null ? sfx.correct() : sfx.click();
    setCi((c) => c + 1); setRevealed(false);
  }
  function again() {
    qa.current = mkQs(); qb.current = mkQs();
    setPos(0); setWinner(null); setRound((r) => r + 1); setCi(0); setRevealed(false);
  }
  useEffect(() => {
    if (mode !== 'teacher') return;
    const f = (e) => {
      if (e.key === 'ArrowLeft') teacherPoint(0);
      if (e.key === 'ArrowRight') teacherPoint(1);
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  const card = cards[ci % cards.length];
  return (
    <div className="class-screen tug">
      <ClassBar title={title} onExit={onExit} />
      <Rope pos={pos} max={max} teams={teams} />
      {mode === 'split' ? (
        <div className="tug-split" key={round}>
          <Side team={teams[0]} side="left" questions={qa.current} onCorrect={() => pull(-1)} disabled={winner !== null} />
          <Side team={teams[1]} side="right" questions={qb.current} onCorrect={() => pull(1)} disabled={winner !== null} />
        </div>
      ) : (
        <div className="tug-teacher">
          <div className="class-card">
            <OralCard card={card} revealed={revealed} />
            <div className="row center">
              {!revealed && <button className="btn btn-sun btn-lg" onClick={() => setRevealed(true)}>Cevabı göster</button>}
            </div>
          </div>
          <div className="tug-teacher-btns">
            <button className="btn btn-lg team-btn" style={{ background: teams[0].color }} onClick={() => teacherPoint(0)}>◀ {teams[0].name} bildi</button>
            <button className="btn btn-light btn-lg" onClick={() => teacherPoint(null)}>Geç</button>
            <button className="btn btn-lg team-btn" style={{ background: teams[1].color }} onClick={() => teacherPoint(1)}>{teams[1].name} bildi ▶</button>
          </div>
        </div>
      )}
      {winner !== null && (
        <div className="class-modal">
          <div className="winner">
            <p className="splash-small">Kazanan</p>
            <h2 className="winner-name" style={{ color: teams[winner].color }}>{teams[winner].name}</h2>
            <p className="splash-small">Aferin! İpi kendi tarafına çekti!</p>
            <div className="row center">
              <button className="btn btn-sun btn-lg" onClick={again}>Tekrar oyna</button>
              <button className="btn btn-light btn-lg" onClick={onExit}>Çık</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
