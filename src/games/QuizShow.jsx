import { useEffect, useRef, useState } from 'react';
import { Prompt, OptionContent, answerRecord, SHAPES } from './common.jsx';
import { sfx } from '../lib/sound.js';

const LEVEL_SIZE = 5;
const BASE = 500;
const SPEED = 500;
const STREAK = 100;
const EXTRA_TIME = 10;

export default function QuizShow({ questions, timeLimit = 20, onFinish }) {
  const T = Math.max(5, timeLimit || 20);
  const [phase, setPhase] = useState('count'); // count | level | play | reveal
  const [count, setCount] = useState(3);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(T);
  const [limit, setLimit] = useState(T);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [gain, setGain] = useState(null);
  const [streak, setStreak] = useState(0);
  const [hidden, setHidden] = useState([]);
  const [life, setLife] = useState({ half: true, time: true });
  const answers = useRef([]);
  const t0 = useRef(null);
  const qStart = useRef(0);
  const lastTick = useRef(0);
  const scoreRef = useRef(0);
  const q = questions[i];
  const level = Math.floor(i / LEVEL_SIZE) + 1;
  const levels = Math.ceil(questions.length / LEVEL_SIZE);

  // 3-2-1 başlangıç
  useEffect(() => {
    if (phase !== 'count') return;
    if (count === 0) { t0.current = performance.now(); startQuestion(); return; }
    sfx.tick();
    const id = setTimeout(() => setCount(count - 1), 700);
    return () => clearTimeout(id);
  }, [phase, count]);

  function startQuestion() {
    setPhase('play'); setPicked(null); setHidden([]); setLimit(T); setLeft(T); setGain(null);
    qStart.current = performance.now(); lastTick.current = 0;
  }

  // soru sayacı
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      const rem = limit - (performance.now() - qStart.current) / 1000;
      setLeft(rem);
      const sec = Math.ceil(rem);
      if (sec <= 5 && sec > 0 && sec !== lastTick.current) { lastTick.current = sec; sfx.tick(); }
      if (rem <= 0) { clearInterval(id); resolve(null); }
    }, 100);
    return () => clearInterval(id);
  }, [phase, limit, i]);

  function resolve(o) {
    if (phase !== 'play') return;
    const ms = performance.now() - qStart.current;
    const rem = Math.max(0, limit - ms / 1000);
    answers.current.push(answerRecord(q, o, ms));
    let g = 0;
    if (o?.correct) {
      const s = streak + 1;
      g = BASE + Math.round(SPEED * Math.min(1, rem / T)) + (s >= 3 ? STREAK : 0);
      setStreak(s);
      sfx.correct();
    } else {
      setStreak(0);
      o ? sfx.wrong() : sfx.timeup();
    }
    scoreRef.current += g;
    setScore(scoreRef.current);
    setGain({ g, ok: !!o?.correct, timeout: !o, streak: o?.correct ? streak + 1 : 0 });
    setPicked(o || { timeout: true });
    setPhase('reveal');
    setTimeout(next, o?.correct ? 1300 : 1900);
  }

  function next() {
    const n = i + 1;
    if (n >= questions.length) {
      sfx.finish();
      const list = answers.current;
      const correct = list.filter((a) => a.ok).length;
      onFinish({
        answers: list, correct, wrong: list.length - correct, total: list.length,
        score: scoreRef.current, max_score: questions.length * (BASE + SPEED + STREAK),
        duration_ms: Math.round(performance.now() - t0.current),
      });
      return;
    }
    setI(n);
    if (n % LEVEL_SIZE === 0) {
      setPhase('level'); sfx.level();
      setTimeout(() => startQuestion(), 1600);
    } else startQuestion();
  }

  function useHalf() {
    if (!life.half || phase !== 'play') return;
    const wrong = q.options.map((o, k) => (!o.correct ? k : -1)).filter((k) => k >= 0);
    const remove = wrong.sort(() => Math.random() - 0.5).slice(0, Math.min(2, wrong.length - 0));
    setHidden(remove.slice(0, Math.max(0, q.options.length - 2)));
    setLife({ ...life, half: false }); sfx.power();
  }
  function useTime() {
    if (!life.time || phase !== 'play') return;
    setLimit(limit + EXTRA_TIME);
    setLife({ ...life, time: false }); sfx.power();
  }

  useEffect(() => {
    const f = (e) => {
      const n = Number(e.key);
      if (phase === 'play' && n >= 1 && n <= q.options.length && !hidden.includes(n - 1)) resolve(q.options[n - 1]);
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  if (phase === 'count') return (
    <div className="game game-quiz quiz-splash">
      <p className="splash-small">Hazır mısın?</p>
      <div className="splash-big" key={count}>{count || 'Başla!'}</div>
    </div>
  );
  if (phase === 'level') return (
    <div className="game game-quiz quiz-splash">
      <p className="splash-small">Aferin! Devam!</p>
      <div className="splash-big">Seviye {level}</div>
      <p className="splash-small">{score} puan</p>
    </div>
  );

  const frac = Math.max(0, Math.min(1, left / limit));
  return (
    <div className="game game-quiz">
      <div className="quiz-top">
        <div className="quiz-score" aria-label="Puan"><span className="quiz-score-n">{score}</span><span className="quiz-score-l">puan</span></div>
        <div className="quiz-mid">
          <span className="quiz-level">Seviye {level}{levels > 1 ? ` / ${levels}` : ''}</span>
          <span className="game-count">{i + 1} / {questions.length}</span>
        </div>
        <div className="lifelines">
          <button className="life" onClick={useHalf} disabled={!life.half || phase !== 'play' || q.options.length < 3} aria-label="Yarı yarıya: iki yanlış şıkkı sil">50:50</button>
          <button className="life" onClick={useTime} disabled={!life.time || phase !== 'play'} aria-label="10 saniye ek süre">+{EXTRA_TIME} sn</button>
        </div>
      </div>
      <div className={`timer ${left <= 5 ? 'warn' : ''}`} aria-label={`${Math.ceil(left)} saniye kaldı`}>
        <span style={{ transform: `scaleX(${frac})` }} />
        <b>{Math.max(0, Math.ceil(left))}</b>
      </div>
      <Prompt q={q} key={q.id} />
      <div className={`options quiz-options n${q.options.length}`}>
        {q.options.map((o, k) => {
          const gone = hidden.includes(k);
          const state = phase === 'reveal' ? (o.correct ? 'right' : o === picked ? 'wrong' : 'dim') : gone ? 'gone' : '';
          return (
            <button key={k} className={`opt qopt-${k} ${state}`} onClick={() => resolve(o)} disabled={phase !== 'play' || gone}>
              <span className="opt-shape" aria-hidden="true">{SHAPES[k]}</span>
              <OptionContent o={o} />
            </button>
          );
        })}
      </div>
      <div className="feedback" aria-live="assertive">
        {gain && (gain.ok
          ? <span className="fb-ok">+{gain.g} {gain.streak >= 3 ? `, ${gain.streak} doğru üst üste!` : 'Aferin!'}</span>
          : <span className="fb-bad">{gain.timeout ? 'Süre bitti! ' : ''}Doğrusu: {q.correctText}</span>)}
      </div>
    </div>
  );
}
