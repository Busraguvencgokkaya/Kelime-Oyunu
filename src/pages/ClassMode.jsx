// Sınıf modu: akıllı tahtada takımlı oyunlar. Öğrenci cihazı gerekmez, sonuç kaydedilmez.
import { useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { Empty, Field, Spinner, useAsync } from '../components/ui.jsx';
import { LANGS, LANG_ORDER } from '../config.js';
import { go } from '../lib/util.js';
import { KIND_LABEL } from '../lib/sets.js';
import { oralCards, TEAM_PRESETS } from '../games/class/shared.jsx';
import BoxGame from '../games/class/BoxGame.jsx';
import TugGame from '../games/class/TugGame.jsx';

const GAMES = {
  box: { name: 'Kutu Oyunu', desc: 'Takımlar sırayla kutu seçer. Soru sözlü cevaplanır, bazı kutulardan sürpriz çıkar: bomba, puan çal, ×2.' },
  tug: { name: 'Halat Çekme', desc: 'İki takım yarışır. Doğru cevap veren takım ipi kendi tarafına çeker.' },
};

export default function ClassMode({ query, user }) {
  const [setId, setSetId] = useState(query.get('set') || '');
  const lists = useAsync(async () => {
    const [sets, books] = await Promise.all([api.listSets(), api.listBooks()]);
    return { sets: sets.filter((s) => (s.owner_id === user.id || s.is_public) && s.item_count > 0), books };
  }, []);
  const set = useAsync(() => (setId ? api.getSet(setId) : Promise.resolve(null)), [setId]);
  const [game, setGame] = useState(query.get('oyun') === 'tug' ? 'tug' : 'box');
  const [teamCount, setTeamCount] = useState(2);
  const [names, setNames] = useState(TEAM_PRESETS.map((t) => t.name));
  const [boxCount, setBoxCount] = useState(16);
  const [oral, setOral] = useState('say_tr');
  const [tugMode, setTugMode] = useState('split');
  const [length, setLength] = useState(5);
  const [lang, setLang] = useState('ky');
  const [direction, setDirection] = useState('tr_to_l');
  const [playing, setPlaying] = useState(false);

  const s = set.data;
  const imgCount = s?.items?.filter((it) => it.image_url).length || 0;
  const cards = useMemo(() => (s ? oralCards(s, oral) : []), [s, oral, playing]);

  if (playing && s) {
    const teams = TEAM_PRESETS.slice(0, game === 'tug' ? 2 : teamCount).map((t, i) => ({ ...t, name: names[i].trim() || t.name }));
    const exit = () => { setPlaying(false); try { document.fullscreenElement && document.exitFullscreen(); } catch { /* yok */ } };
    return game === 'box'
      ? <BoxGame title={s.title} cards={cards} teams={teams} boxCount={boxCount} onExit={exit} />
      : <TugGame title={s.title} set={s} cards={cards} teams={teams} mode={tugMode} length={length} lang={s.kind === 'words' ? lang : 'tr'} direction={s.kind === 'words' ? direction : 'mixed'} onExit={exit} />;
  }

  if (lists.loading) return <Spinner />;
  if (!lists.data?.sets.length) return <Empty title="Önce bir set oluştur" action={<a className="btn btn-primary" href="#/setler">Setlere git</a>} />;
  const bookName = Object.fromEntries(lists.data.books.map((b) => [b.id, b.title]));
  const nTeams = game === 'tug' ? 2 : teamCount;

  return (
    <div className="page narrow-page">
      <div>
        <h1>Sınıfta oyna</h1>
        <p className="muted">Akıllı tahtada takımlarla oynanır. Öğrencilerin telefonu gerekmez, sonuçlar kaydedilmez.</p>
      </div>
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); if (s) setPlaying(true); }}>
        <section className="card stack">
          <h2 className="h-sub">Set</h2>
          <select value={setId} onChange={(e) => setSetId(e.target.value)} aria-label="Set" required>
            <option value="">Set seç</option>
            {lists.data.sets.map((x) => <option key={x.id} value={x.id}>{bookName[x.book_id] ? `${bookName[x.book_id]}: ` : ''}{x.title} ({KIND_LABEL[x.kind]}, {x.item_count})</option>)}
          </select>
          {set.loading && setId && <Spinner />}
        </section>

        {s && <>
          <section className="card stack">
            <h2 className="h-sub">Oyun</h2>
            <div className="choice-grid">
              {Object.entries(GAMES).map(([id, g]) => (
                <label key={id} className={`choice ${game === id ? 'on' : ''}`}>
                  <input type="radio" name="game" checked={game === id} onChange={() => setGame(id)} />
                  <strong>{g.name}</strong>
                  <span className="muted small">{g.desc}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="card stack">
            <h2 className="h-sub">Takımlar</h2>
            {game === 'box' && (
              <div className="chip-row">
                {[2, 3, 4].map((n) => <label key={n} className={`chip ${teamCount === n ? 'on' : ''}`}><input type="radio" checked={teamCount === n} onChange={() => setTeamCount(n)} />{n} takım</label>)}
              </div>
            )}
            <div className="row-fields">
              {TEAM_PRESETS.slice(0, nTeams).map((t, i) => (
                <Field key={i} label={<span><span className="dot" style={{ background: t.color }} /> {i + 1}. takım</span>}>
                  <input value={names[i]} onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))} />
                </Field>
              ))}
            </div>
          </section>

          <section className="card stack">
            <h2 className="h-sub">Ayarlar</h2>
            {game === 'box' && <>
              <div className="field">
                <span className="field-label">Kutu sayısı</span>
                <div className="chip-row">
                  {[12, 16, 20, 24].map((n) => <label key={n} className={`chip ${boxCount === n ? 'on' : ''}`}><input type="radio" checked={boxCount === n} onChange={() => setBoxCount(n)} />{n}</label>)}
                </div>
                {s.items.length < boxCount * 0.8 && <span className="field-hint">Sette {s.items.length} madde var; bazı sorular tekrar edebilir.</span>}
              </div>
              {s.kind === 'words' && (
                <div className="field">
                  <span className="field-label">Öğrenciler ne söylesin?</span>
                  <div className="chip-row">
                    <label className={`chip ${oral === 'say_tr' ? 'on' : ''}`}><input type="radio" checked={oral === 'say_tr'} onChange={() => setOral('say_tr')} />Türkçesini söylesinler</label>
                    <label className={`chip ${oral === 'say_meaning' ? 'on' : ''}`}><input type="radio" checked={oral === 'say_meaning'} onChange={() => setOral('say_meaning')} />Anlamını söylesinler</label>
                  </div>
                  <span className="field-hint">{oral === 'say_tr' ? 'Kutuda resim (yoksa Kırgızca, Rusça ve İngilizce anlamı) çıkar, öğrenci Türkçesini söyler.' : 'Kutuda Türkçe kelime çıkar, öğrenci anlamını söyler.'}</span>
                </div>
              )}
            </>}
            {game === 'tug' && <>
              <div className="field">
                <span className="field-label">Nasıl oynansın?</span>
                <div className="chip-row">
                  <label className={`chip ${tugMode === 'split' ? 'on' : ''}`}><input type="radio" checked={tugMode === 'split'} onChange={() => setTugMode('split')} />İkiye bölünmüş ekran</label>
                  <label className={`chip ${tugMode === 'teacher' ? 'on' : ''}`}><input type="radio" checked={tugMode === 'teacher'} onChange={() => setTugMode('teacher')} />Öğretmen yönetimli</label>
                </div>
                <span className="field-hint">{tugMode === 'split' ? 'Her takımdan bir öğrenci tahtanın kendi yarısında aynı anda şıklara dokunur.' : 'Soru ortada çıkar. Önce doğru söyleyen takımın düğmesine sen basarsın (klavyede ← ve → da olur).'}</span>
              </div>
              <div className="field">
                <span className="field-label">İp uzunluğu</span>
                <div className="chip-row">
                  {[[4, 'Kısa'], [5, 'Orta'], [7, 'Uzun']].map(([n, l]) => <label key={n} className={`chip ${length === n ? 'on' : ''}`}><input type="radio" checked={length === n} onChange={() => setLength(n)} />{l} ({n} doğru)</label>)}
                </div>
              </div>
              {s.kind === 'words' && tugMode === 'split' && <>
                <div className="field">
                  <span className="field-label">Soru yönü</span>
                  <div className="chip-row">
                    {[['tr_to_l', 'Türkçe → anlam'], ['l_to_tr', 'Anlam → Türkçe'], ...(imgCount >= 4 ? [['image', 'Resim → Türkçe'], ['tr_to_img', 'Türkçe → resim']] : [])].map(([id, l]) => (
                      <label key={id} className={`chip ${direction === id ? 'on' : ''}`}><input type="radio" checked={direction === id} onChange={() => setDirection(id)} />{l}</label>
                    ))}
                  </div>
                </div>
                {(direction === 'tr_to_l' || direction === 'l_to_tr') && (
                  <div className="field">
                    <span className="field-label">Anlamlar hangi dilde?</span>
                    <div className="chip-row">
                      {['ky', 'ru', 'en'].map((l) => <label key={l} className={`chip ${lang === l ? 'on' : ''}`}><input type="radio" checked={lang === l} onChange={() => setLang(l)} />{LANGS[l].tr}</label>)}
                    </div>
                  </div>
                )}
              </>}
              {s.kind === 'words' && tugMode === 'teacher' && (
                <div className="field">
                  <span className="field-label">Öğrenciler ne söylesin?</span>
                  <div className="chip-row">
                    <label className={`chip ${oral === 'say_tr' ? 'on' : ''}`}><input type="radio" checked={oral === 'say_tr'} onChange={() => setOral('say_tr')} />Türkçesini söylesinler</label>
                    <label className={`chip ${oral === 'say_meaning' ? 'on' : ''}`}><input type="radio" checked={oral === 'say_meaning'} onChange={() => setOral('say_meaning')} />Anlamını söylesinler</label>
                  </div>
                </div>
              )}
            </>}
          </section>

          <div className="row end">
            <button type="button" className="btn btn-ghost" onClick={() => go('/setler')}>Vazgeç</button>
            <button className="btn btn-primary btn-lg">Oyunu başlat</button>
          </div>
        </>}
      </form>
    </div>
  );
}
