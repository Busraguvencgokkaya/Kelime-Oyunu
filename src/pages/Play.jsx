import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { LANGS } from '../config.js';
import { Flag } from '../components/Flag.jsx';
import { Spinner } from '../components/ui.jsx';
import { buildQuestions } from '../lib/questions.js';
import { fmtDuration, titleCaseTr } from '../lib/util.js';
import { isMuted, setMuted, sfx } from '../lib/sound.js';
import TestGame from '../games/TestGame.jsx';
import QuizShow from '../games/QuizShow.jsx';
import { Logo } from './Shell.jsx';

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok */ } },
};

export default function Play({ slug }) {
  const [asg, setAsg] = useState(null);
  const [err, setErr] = useState(null);
  const saved = store.get('ko-student') || {};
  const [first, setFirst] = useState(saved.first || '');
  const [last, setLast] = useState(saved.last || '');
  const [lang, setLang] = useState(null);
  const [step, setStep] = useState('name'); // name | lang | ready | play | result
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [save, setSave] = useState({ state: 'idle' });
  const [muted, setMut] = useState(isMuted());

  useEffect(() => {
    api.getPublicAssignment(slug).then(setAsg).catch((e) => setErr(e.message));
  }, [slug]);

  const questions = useMemo(() => (asg?.status === 'ok' && lang && step === 'play' ? buildQuestions(asg, lang) : null), [asg, lang, step, round]);

  if (err) return <StudentFrame><Msg title="İnternet yok gibi" text="Bağlantını kontrol et, sonra sayfayı yenile." /></StudentFrame>;
  if (!asg) return <StudentFrame><Spinner label="Hazırlanıyor…" /></StudentFrame>;
  if (asg.status === 'not_found') return <StudentFrame><Msg title="Bu bağlantı çalışmıyor" text="Bağlantıyı öğretmenine sor." /></StudentFrame>;
  if (asg.status === 'closed') return <StudentFrame><Msg title="Bu ödev kapalı" text={`"${asg.title}" şu an kapalı. Öğretmenine sor.`} /></StudentFrame>;
  if (asg.status === 'expired') return <StudentFrame><Msg title="Süre bitti" text={`"${asg.title}" ödevinin son günü geçti.`} /></StudentFrame>;

  const isWords = asg.kind === 'words';
  const langs = isWords ? (asg.langs || []).filter((l) => LANGS[l]) : [];
  const fullName = titleCaseTr(`${first} ${last}`);
  const qCount = Math.min(asg.question_count, asg.items.length);

  function submitName(e) {
    e.preventDefault();
    if (first.trim().length < 2 || last.trim().length < 2) return;
    store.set('ko-student', { first: first.trim(), last: last.trim() });
    sfx.unlock();
    if (!isWords) { setLang('tr'); setStep('ready'); }
    else if (langs.length === 1) { setLang(langs[0]); setStep('ready'); }
    else setStep('lang');
  }

  async function finish(r) {
    const res = { ...r, name: fullName, lang };
    setResult(res);
    setStep('result');
    await send(res);
  }
  async function send(res) {
    setSave({ state: 'saving' });
    try { const out = await api.submitAttempt(slug, res); setSave({ state: 'ok', attempt: out.attempt_no }); }
    catch (e) { setSave({ state: 'error', msg: e.message }); }
  }

  const head = (
    <div className="play-head">
      <div><strong>{asg.title}</strong>{asg.class_name && <span>{asg.class_name}</span>}</div>
      <button className="icon-btn light" onClick={() => { setMuted(!muted); setMut(!muted); }} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}>{muted ? '🔇' : '🔊'}</button>
    </div>
  );

  if (step === 'play' && questions) {
    const Game = asg.game_type === 'quiz' ? QuizShow : TestGame;
    return <StudentFrame wide game>{head}<Game key={round} questions={questions} timeLimit={asg.time_limit} onFinish={finish} /></StudentFrame>;
  }

  if (step === 'result' && result) {
    const p = result.total ? Math.round((result.correct / result.total) * 100) : 0;
    const msg = p >= 80 ? 'Aferin!' : p >= 50 ? 'Güzel!' : 'Bir daha dene!';
    const wrong = result.answers.filter((a) => !a.ok);
    return (
      <StudentFrame wide>
        {head}
        <div className="result">
          <p className="result-name">{fullName}</p>
          <h1 className={`result-msg ${p >= 80 ? 'hi' : p >= 50 ? 'mid' : 'lo'}`}>{msg}</h1>
          <div className="result-score">
            {asg.game_type === 'quiz' ? <><strong>{result.score}</strong><span>puan</span></> : <><strong>{p}</strong><span>/ 100</span></>}
          </div>
          <div className="result-stats">
            <div><strong>{result.correct}</strong><span>doğru</span></div>
            <div><strong>{result.wrong}</strong><span>yanlış</span></div>
            <div><strong>{fmtDuration(result.duration_ms)}</strong><span>süre</span></div>
          </div>
          <p className={`save-state save-${save.state}`}>
            {save.state === 'saving' && 'Sonucun kaydediliyor…'}
            {save.state === 'ok' && `Sonucun öğretmenine gitti. ${save.attempt}. deneme.`}
            {save.state === 'error' && <>Sonuç kaydedilemedi: {save.msg} <button className="link" onClick={() => send(result)}>Tekrar gönder</button></>}
          </p>
          <div className="row center">
            <button className="btn btn-sun btn-lg" disabled={save.state === 'saving'} onClick={() => { setResult(null); setSave({ state: 'idle' }); setRound(round + 1); setStep('play'); }}>Tekrar oyna</button>
            {langs.length > 1 && <button className="btn btn-light" onClick={() => setStep('lang')}>Dili değiştir</button>}
          </div>
          <section className="answers-review">
            <h2>{wrong.length ? 'Bunları tekrar et' : 'Hepsi doğru!'}</h2>
            <ol>
              {result.answers.map((a, k) => (
                <li key={k} className={a.ok ? 'ok' : 'bad'}>
                  <span className="rv-q">{a.prompt}</span>
                  <span className="rv-a">{a.correct}</span>
                  {!a.ok && <span className="rv-g">Senin cevabın: {a.given || 'boş'}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </StudentFrame>
    );
  }

  if (step === 'lang') return (
    <StudentFrame>
      {head}
      <h1 className="play-title">Hangi dil?</h1>
      <div className="lang-grid">
        {langs.map((l) => (
          <button key={l} className="lang-btn" onClick={() => { setLang(l); setStep('ready'); sfx.click(); }}>
            <Flag code={l} size={96} />
            <span>{LANGS[l].label}</span>
          </button>
        ))}
      </div>
      <button className="link light" onClick={() => setStep('name')}>Geri</button>
    </StudentFrame>
  );

  if (step === 'ready') return (
    <StudentFrame>
      {head}
      <p className="play-hello">Merhaba, {titleCaseTr(first)}!</p>
      <h1 className="play-title">{asg.game_type === 'quiz' ? 'Quiz Show' : 'Test'}</h1>
      <ul className="ready-facts">
        <li><strong>{qCount}</strong> soru</li>
        {asg.game_type === 'quiz' ? <li>Her soru <strong>{asg.time_limit || 20}</strong> saniye</li>
          : asg.time_limit > 0 ? <li>Süre <strong>{Math.round(asg.time_limit / 60)}</strong> dakika</li> : <li>Süre yok, acele etme</li>}
        {lang && lang !== 'tr' && <li className="ready-lang"><Flag code={lang} size={28} /> {LANGS[lang].label}</li>}
      </ul>
      {asg.game_type === 'quiz' && <p className="ready-tip">Hızlı cevap ver, daha çok puan al! 50:50 ve +10 sn haklarını unutma.</p>}
      <button className="btn btn-sun btn-xl" autoFocus onClick={() => { sfx.unlock(); setStep('play'); }}>Haydi, başla!</button>
      <button className="link light" onClick={() => setStep(isWords && langs.length > 1 ? 'lang' : 'name')}>Geri</button>
    </StudentFrame>
  );

  return (
    <StudentFrame>
      {head}
      <h1 className="play-title">Adını yaz</h1>
      <form className="name-form" onSubmit={submitName}>
        <label><span>Adın</span><input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" required minLength={2} maxLength={40} autoFocus /></label>
        <label><span>Soyadın</span><input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" required minLength={2} maxLength={40} /></label>
        <button className="btn btn-sun btn-xl" disabled={first.trim().length < 2 || last.trim().length < 2}>Devam</button>
      </form>
    </StudentFrame>
  );
}

function StudentFrame({ children, wide, game }) {
  return (
    <div className={`play ${game ? 'play-game' : ''}`}>
      <div className={`play-inner ${wide ? 'wide' : ''}`}>{children}</div>
      {!game && <div className="play-foot"><Logo small /></div>}
    </div>
  );
}

function Msg({ title, text }) {
  return <div className="play-msg"><h1 className="play-title">{title}</h1><p>{text}</p></div>;
}
