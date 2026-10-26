import { useEffect, useRef, useState } from 'react';
import { Prompt, OptionContent, answerRecord, SHAPES } from './common.jsx';
import { sfx } from '../lib/sound.js';
import { fmtClock } from '../lib/util.js';

export default function TestGame({ questions, timeLimit, onFinish }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [left, setLeft] = useState(timeLimit || 0);
  const answers = useRef([]);
  const t0 = useRef(performance.now());
  const qStart = useRef(performance.now());
  const done = useRef(false);
  const q = questions[i];

  function finish() {
    if (done.current) return;
    done.current = true;
    const list = answers.current.slice();
    for (let k = list.length; k < questions.length; k++) list.push(answerRecord(questions[k], null, 0));
    const correct = list.filter((a) => a.ok).length;
    onFinish({
      answers: list, correct, wrong: list.length - correct, total: list.length,
      score: Math.round((correct / list.length) * 100), max_score: 100,
      duration_ms: Math.round(performance.now() - t0.current),
    });
  }

  useEffect(() => {
    if (!timeLimit) return;
    const id = setInterval(() => {
      const rem = timeLimit - (performance.now() - t0.current) / 1000;
      setLeft(rem);
      if (rem <= 0) { clearInterval(id); sfx.timeup(); finish(); }
    }, 250);
    return () => clearInterval(id);
  }, []);

  function choose(o) {
    if (picked) return;
    setPicked(o);
    answers.current.push(answerRecord(q, o, performance.now() - qStart.current));
    o.correct ? sfx.correct() : sfx.wrong();
    setTimeout(() => {
      if (i + 1 >= questions.length) finish();
      else { setI(i + 1); setPicked(null); qStart.current = performance.now(); }
    }, o.correct ? 700 : 1300);
  }

  useEffect(() => {
    const f = (e) => { const n = Number(e.key); if (n >= 1 && n <= q.options.length) choose(q.options[n - 1]); };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  return (
    <div className="game game-test">
      <div className="game-top">
        <div className="progress" aria-label={`${i + 1}. soru, toplam ${questions.length}`}>
          <span style={{ width: `${((i + (picked ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>
        <span className="game-count">{i + 1} / {questions.length}</span>
        {timeLimit > 0 && <span className={`game-clock ${left < 30 ? 'warn' : ''}`} aria-label="Kalan süre">{fmtClock(left)}</span>}
      </div>
      <Prompt q={q} key={q.id} />
      <div className={`options n${q.options.length}`}>
        {q.options.map((o, k) => {
          const state = picked ? (o.correct ? 'right' : o === picked ? 'wrong' : 'dim') : '';
          return (
            <button key={k} className={`opt opt-${k} ${state}`} onClick={() => choose(o)} disabled={!!picked}>
              <span className="opt-shape" aria-hidden="true">{SHAPES[k]}</span>
              <OptionContent o={o} />
            </button>
          );
        })}
      </div>
      <div className="feedback" aria-live="assertive">
        {picked && (picked.correct ? <span className="fb-ok">Doğru! Aferin!</span> : <span className="fb-bad">Doğrusu: {q.correctText}</span>)}
      </div>
    </div>
  );
}
