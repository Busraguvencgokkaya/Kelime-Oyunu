import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { Confirm, Empty, Spinner, Toggle, useAsync, useToast } from '../components/ui.jsx';
import LinkBox from '../components/LinkBox.jsx';
import { GAMES, LANGS } from '../config.js';
import { fmtDate, fmtDuration } from '../lib/util.js';

const pct = (t) => (t.total ? Math.round((t.correct / t.total) * 100) : 0);
const better = (a, b) => (b.score - a.score) || (a.duration_ms - b.duration_ms);
const langName = (l) => LANGS[l]?.tr || (l === 'tr' ? 'Türkçe' : l || '–');

export function analyze(asg, attempts, scope) {
  const byStudent = new Map();
  attempts.forEach((t) => {
    if (!byStudent.has(t.name_key)) byStudent.set(t.name_key, []);
    byStudent.get(t.name_key).push(t);
  });
  const students = [...byStudent.values()].map((list) => {
    list.sort((a, b) => a.attempt_no - b.attempt_no || a.created_at.localeCompare(b.created_at));
    const first = list[0];
    const best = list.slice().sort(better)[0];
    return { key: first.name_key, name: list[list.length - 1].student_name, lang: best.lang, attempts: list, first, best };
  }).sort((a, b) => better(a.best, b.best));

  const avg = (arr, f) => (arr.length ? Math.round(arr.reduce((s, x) => s + f(x), 0) / arr.length) : 0);
  const summary = {
    students: students.length,
    attempts: attempts.length,
    firstPct: avg(students, (s) => pct(s.first)),
    bestPct: avg(students, (s) => pct(s.best)),
    bestScore: avg(students, (s) => s.best.score),
    avgTime: avg(students, (s) => s.best.duration_ms),
  };

  const itemMap = Object.fromEntries((asg.items || []).map((it) => [it.id, it]));
  const pool = scope === 'first' ? students.map((s) => s.first) : attempts;
  const qs = new Map();
  pool.forEach((t) => (t.answers || []).forEach((a) => {
    if (!qs.has(a.item_id)) {
      const it = itemMap[a.item_id] || {};
      qs.set(a.item_id, { id: a.item_id, label: asg.kind === 'words' ? (it.tr || a.correct) : (it.prompt || a.prompt), sub: asg.kind === 'words' ? [it.en, it.ky, it.ru].filter(Boolean).join(' / ') : `Doğru: ${it.answer || a.correct}`, seen: 0, ok: 0, wrongs: {} });
    }
    const q = qs.get(a.item_id);
    q.seen++;
    if (a.ok) q.ok++;
    else { const g = (a.given || '(boş)').trim() || '(boş)'; q.wrongs[g] = (q.wrongs[g] || 0) + 1; }
  }));
  const questions = [...qs.values()].map((q) => ({ ...q, pct: Math.round((q.ok / q.seen) * 100), topWrong: Object.entries(q.wrongs).sort((a, b) => b[1] - a[1]).slice(0, 3) }))
    .sort((a, b) => a.pct - b.pct || b.seen - a.seen);

  return { students, summary, questions };
}

export default function Report({ id }) {
  const toast = useToast();
  const asg = useAsync(() => api.getAssignment(id), [id]);
  const att = useAsync(() => api.listAttempts(id), [id]);
  const [tab, setTab] = useState('students');
  const [scope, setScope] = useState('first');
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);

  // Ders sırasında sonuçlar canlı gelsin: 15 saniyede bir yenile
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') att.reload(); }, 15000);
    return () => clearInterval(t);
  }, [att.reload]);

  const a = asg.data;
  const r = useMemo(() => (a && att.data ? analyze(a, att.data, scope) : null), [a, att.data, scope]);

  if (asg.loading && !a) return <Spinner />;
  if (asg.error) return <p className="note note-error">{asg.error.message}</p>;
  if (!a) return <Empty title="Ödev bulunamadı" action={<a className="btn btn-primary" href="#/odevler">Ödevlerime dön</a>} />;

  const isQuiz = a.game_type === 'quiz';
  const scoreText = (t) => (isQuiz ? `${t.score} puan` : `%${pct(t)}`);

  async function exportXlsx() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const st = r.students.map((s) => ({
      'Öğrenci': s.name, 'Dil': langName(s.lang), 'Deneme sayısı': s.attempts.length,
      'İlk deneme puanı': isQuiz ? s.first.score : pct(s.first), 'İlk deneme doğru': s.first.correct, 'İlk deneme yanlış': s.first.wrong, 'İlk deneme süresi (sn)': Math.round(s.first.duration_ms / 1000),
      'En iyi puan': isQuiz ? s.best.score : pct(s.best), 'En iyi doğru': s.best.correct, 'En iyi yanlış': s.best.wrong, 'En iyi süre (sn)': Math.round(s.best.duration_ms / 1000),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st), 'Öğrenciler');
    const tries = att.data.map((t) => ({ 'Öğrenci': t.student_name, 'Deneme': t.attempt_no, 'Dil': langName(t.lang), 'Puan': isQuiz ? t.score : pct(t), 'Doğru': t.correct, 'Yanlış': t.wrong, 'Soru': t.total, 'Süre (sn)': Math.round(t.duration_ms / 1000), 'Tarih': fmtDate(t.created_at) }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tries), 'Denemeler');
    const ans = att.data.flatMap((t) => (t.answers || []).map((x, i) => ({ 'Öğrenci': t.student_name, 'Deneme': t.attempt_no, 'Soru no': i + 1, 'Soru': x.prompt, 'Doğru cevap': x.correct, 'Verilen cevap': x.given || '(boş)', 'Sonuç': x.ok ? 'Doğru' : 'Yanlış', 'Süre (sn)': Math.round((x.ms || 0) / 100) / 10 })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ans), 'Cevaplar');
    const qs = r.questions.map((q) => ({ 'Soru / kelime': q.label, 'Anlamı / cevap': q.sub, 'Soruldu': q.seen, 'Doğru': q.ok, 'Başarı %': q.pct, 'Sık verilen yanlış cevaplar': q.topWrong.map(([w, c]) => `${w} (${c})`).join(', ') }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qs), 'Sorular');
    const safe = a.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
    XLSX.writeFile(wb, `${safe} sonuçları.xlsx`);
  }

  return (
    <div className="page">
      <a href="#/odevler" className="back">Ödevlerim</a>
      <div className="report-head">
        <div>
          <span className={`game-tag game-${a.game_type}`}>{GAMES[a.game_type]?.name}</span>
          <h1>{a.title}</h1>
          <p className="muted">{[a.class_name, a.set_title, `${a.question_count} soru`, a.due_at ? `son teslim ${fmtDate(a.due_at)}` : null].filter(Boolean).join(', ')}</p>
          <Toggle checked={a.is_open} onChange={async (v) => { asg.setData({ ...a, is_open: v }); try { await api.updateAssignment(a.id, { is_open: v }); toast(v ? 'Ödev açıldı.' : 'Ödev kapatıldı.'); } catch (e) { toast(e.message, 'error'); asg.reload(); } }} label={a.is_open ? 'Ödev açık, öğrenciler girebilir' : 'Ödev kapalı'} />
        </div>
        <LinkBox slug={a.slug} title={a.title} />
      </div>

      {!r ? <Spinner /> : !r.students.length ? (
        <Empty title="Henüz katılan yok">Öğrenciler bağlantıyı açıp oyunu bitirince sonuçları burada görünür. Sayfa 15 saniyede bir kendini yeniler.</Empty>
      ) : <>
        <div className="stats">
          <div className="stat"><strong>{r.summary.students}</strong><span>öğrenci</span></div>
          <div className="stat"><strong>{r.summary.attempts}</strong><span>deneme</span></div>
          <div className="stat"><strong>%{r.summary.firstPct}</strong><span>ilk deneme ortalaması</span></div>
          <div className="stat"><strong>%{r.summary.bestPct}</strong><span>en iyi deneme ortalaması</span></div>
          {isQuiz && <div className="stat"><strong>{r.summary.bestScore}</strong><span>ortalama puan</span></div>}
          <div className="stat"><strong>{fmtDuration(r.summary.avgTime)}</strong><span>ortalama süre</span></div>
        </div>

        <div className="toolbar">
          <div className="tabs" role="tablist">
            {[['students', 'Öğrenciler'], ['questions', 'Sorular'], ['board', 'Sıralama']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => att.reload()}>Yenile</button>
            <button className="btn btn-primary btn-sm" onClick={exportXlsx}>Excel'e aktar</button>
          </div>
        </div>

        {tab === 'students' && (
          <div className="table-wrap">
            <table className="table report-table">
              <thead><tr><th>Öğrenci</th><th>Dil</th><th className="num">Deneme</th><th className="num">İlk deneme</th><th className="num">En iyi</th><th className="num">Doğru / yanlış</th><th className="num">Süre</th><th /></tr></thead>
              <tbody>
                {r.students.map((s) => (
                  <Fragment key={s.key}>
                    <tr className={open === s.key ? 'open' : ''}>
                      <td><button className="link strong" onClick={() => setOpen(open === s.key ? null : s.key)} aria-expanded={open === s.key}>{s.name}</button></td>
                      <td>{langName(s.lang)}</td>
                      <td className="num">{s.attempts.length}</td>
                      <td className="num">{scoreText(s.first)}</td>
                      <td className="num"><span className={`score-pill ${pct(s.best) >= 80 ? 'hi' : pct(s.best) >= 50 ? 'mid' : 'lo'}`}>{scoreText(s.best)}</span></td>
                      <td className="num">{s.best.correct} / {s.best.wrong}</td>
                      <td className="num">{fmtDuration(s.best.duration_ms)}</td>
                      <td><button className="link small" onClick={() => setOpen(open === s.key ? null : s.key)}>{open === s.key ? 'Gizle' : 'Cevaplar'}</button></td>
                    </tr>
                    {open === s.key && (
                      <tr className="detail-row"><td colSpan={8}>
                        {s.attempts.map((t) => (
                          <div key={t.id} className="attempt">
                            <div className="attempt-head">
                              <strong>{t.attempt_no}. deneme</strong>
                              {t === s.first && <span className="tag">ilk</span>}
                              {t === s.best && <span className="tag tag-best">en iyi</span>}
                              <span className="muted small">{scoreText(t)}, {t.correct} doğru, {t.wrong} yanlış, {fmtDuration(t.duration_ms)}, {langName(t.lang)}, {fmtDate(t.created_at)}</span>
                              <button className="link small danger-text" onClick={() => setConfirm(t)}>Bu denemeyi sil</button>
                            </div>
                            <ol className="answer-list">
                              {(t.answers || []).map((x, i) => (
                                <li key={i} className={x.ok ? 'ok' : 'bad'}>
                                  <span className="ans-q">{x.prompt}</span>
                                  {x.ok ? <span className="ans-ok">{x.correct}</span> : <><span className="ans-given">{x.given || '(boş)'}</span><span className="ans-ok">Doğrusu: {x.correct}</span></>}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'questions' && (
          <>
            <div className="radio-row">
              <label><input type="radio" checked={scope === 'first'} onChange={() => setScope('first')} /> Yalnız ilk denemeler</label>
              <label><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> Bütün denemeler</label>
            </div>
            <p className="muted small">En zor sorular en üstte. Çubuk, soruyu doğru cevaplayanların oranını gösterir.</p>
            <ul className="q-stats">
              {r.questions.map((q) => (
                <li key={q.id}>
                  <div className="q-stats-text"><strong>{q.label}</strong><span className="muted small">{q.sub}</span>
                    {q.topWrong.length > 0 && <span className="small wrong-list">Sık yanlış: {q.topWrong.map(([w, c]) => `${w} (${c})`).join(', ')}</span>}
                  </div>
                  <div className="bar" aria-label={`Başarı yüzde ${q.pct}`}><span style={{ width: `${q.pct}%` }} className={q.pct >= 80 ? 'hi' : q.pct >= 50 ? 'mid' : 'lo'} /></div>
                  <span className="num q-stats-pct">%{q.pct}<span className="muted small"> {q.ok}/{q.seen}</span></span>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'board' && (
          <div className="boards">
            <section className="card">
              <h2 className="h-sub">En yüksek puan</h2>
              <ol className="board">
                {r.students.slice(0, 10).map((s, i) => <li key={s.key}><span className="board-rank">{i + 1}</span><span>{s.name}</span><strong>{scoreText(s.best)}</strong></li>)}
              </ol>
            </section>
            <section className="card">
              <h2 className="h-sub">En hızlı</h2>
              <p className="muted small">En az yüzde 70 başarıyla bitirenler arasında.</p>
              <ol className="board">
                {r.students.map((s) => ({ s, t: s.attempts.filter((t) => pct(t) >= 70).sort((x, y) => x.duration_ms - y.duration_ms)[0] })).filter((x) => x.t)
                  .sort((x, y) => x.t.duration_ms - y.t.duration_ms).slice(0, 10)
                  .map(({ s, t }, i) => <li key={s.key}><span className="board-rank">{i + 1}</span><span>{s.name}</span><strong>{fmtDuration(t.duration_ms)}</strong></li>)}
              </ol>
            </section>
          </div>
        )}
      </>}
      {confirm && <Confirm text={`${confirm.student_name} adlı öğrencinin ${confirm.attempt_no}. denemesi silinsin mi?`} onOk={async () => { await api.deleteAttempt(confirm.id); att.reload(); }} onClose={() => setConfirm(null)} />}
    </div>
  );
}
