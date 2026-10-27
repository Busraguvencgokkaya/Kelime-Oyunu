import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Empty, Field, Spinner, useAsync, useToast } from '../components/ui.jsx';
import LinkBox from '../components/LinkBox.jsx';
import { GAMES, LANGS, LANG_ORDER } from '../config.js';
import { KIND_LABEL } from '../lib/sets.js';

const DIRS = [
  { id: 'mixed', label: 'Karışık', desc: 'Bazen Türkçe, bazen ana dil sorulur' },
  { id: 'tr_to_l', label: 'Türkçe → ana dil', desc: 'Türkçe kelime görünür, anlamı seçilir' },
  { id: 'l_to_tr', label: 'Ana dil → Türkçe', desc: 'Anlamı görünür, Türkçesi seçilir' },
  { id: 'image', label: 'Resim → Türkçe', desc: 'Resim gösterilir, Türkçesi seçilir' },
  { id: 'tr_to_img', label: 'Türkçe → resim', desc: 'Türkçe kelime yazılır ve okunur, doğru resim seçilir. Okumayı yeni öğrenenler için' },
];

export default function NewAssignment({ query, user }) {
  const toast = useToast();
  const [setId, setSetId] = useState(query.get('set') || '');
  const lists = useAsync(async () => {
    const [sets, books] = await Promise.all([api.listSets(), api.listBooks()]);
    return { sets: sets.filter((s) => (s.owner_id === user.id || s.is_public) && s.item_count > 0), books };
  }, []);
  const set = useAsync(() => (setId ? api.getSet(setId) : Promise.resolve(null)), [setId]);

  const [f, setF] = useState({ game_type: 'test', question_count: 10, time: 10, direction: 'mixed', langs: [...LANG_ORDER], title: '', class_name: '', due: '' });
  const [titleTouched, setTitleTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const s = set.data;
  const n = s?.items?.length || 0;
  const imgCount = s?.items?.filter((it) => it.image_url).length || 0;
  const hasImages = imgCount >= 4;

  useEffect(() => {
    if (!s) return;
    setF((x) => ({ ...x, question_count: Math.min(n, 10) || 1 }));
  }, [s?.id]);
  useEffect(() => {
    if (s && !titleTouched) setF((x) => ({ ...x, title: `${s.title}: ${GAMES[x.game_type].name}` }));
  }, [s?.id, f.game_type, titleTouched]);

  const up = (p) => setF((x) => ({ ...x, ...p }));

  async function create(e) {
    e.preventDefault();
    if (!s) return;
    if (s.kind === 'words' && !f.langs.length) { toast('En az bir dil seç.', 'error'); return; }
    setBusy(true);
    try {
      const g = GAMES[f.game_type];
      const time_limit = g.timeUnit === 'min' ? Math.round(Number(f.time || 0) * 60) : Math.max(5, Math.round(Number(f.time || 20)));
      const items = s.items.map(({ set_id, position, created_at, ...it }) => it);
      const a = await api.createAssignment({
        set_id: s.id, set_title: s.title, kind: s.kind, title: f.title.trim() || s.title,
        class_name: f.class_name.trim() || null, game_type: f.game_type,
        question_count: Math.max(1, Math.min(n, Number(f.question_count) || n)), time_limit,
        direction: s.kind === 'words' ? f.direction : 'mixed', langs: s.kind === 'words' ? f.langs : ['tr'],
        due_at: f.due ? new Date(f.due).toISOString() : null, items,
      });
      setCreated(a);
      toast('Ödev oluşturuldu.');
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  }

  if (created) return (
    <div className="page narrow-page">
      <div className="card success-card">
        <h1>Ödev hazır</h1>
        <p className="muted">{created.title}{created.class_name ? `, ${created.class_name}` : ''}. Bağlantıyı öğrencilerle paylaş ya da QR kodu tahtada göster.</p>
        <LinkBox slug={created.slug} title={created.title} />
        <div className="row">
          <a className="btn btn-primary" href={`#/odev/${created.id}`}>Sonuçları izle</a>
          <a className="btn btn-ghost" href="#/odevler">Ödevlerim</a>
          <button className="btn btn-ghost" onClick={() => setCreated(null)}>Aynı setle bir ödev daha</button>
        </div>
      </div>
    </div>
  );

  if (lists.loading) return <Spinner />;
  const bookName = Object.fromEntries((lists.data?.books || []).map((b) => [b.id, b.title]));
  if (!lists.data?.sets.length) return <Empty title="Önce bir set oluştur" action={<a className="btn btn-primary" href="#/setler">Setlere git</a>}>Ödev vermek için içinde kelime ya da soru olan bir set gerekir.</Empty>;

  const g = GAMES[f.game_type];
  return (
    <div className="page narrow-page">
      <h1>Yeni ödev</h1>
      <form className="stack-lg" onSubmit={create}>
        <section className="card stack">
          <h2 className="h-sub">1. Set</h2>
          <select value={setId} onChange={(e) => setSetId(e.target.value)} aria-label="Set" required>
            <option value="">Set seç</option>
            {groupBy(lists.data.sets, (x) => bookName[x.book_id] || 'Kitapsız setler').map(([name, ss]) => (
              <optgroup key={name} label={name}>{ss.map((x) => <option key={x.id} value={x.id}>{x.title} ({KIND_LABEL[x.kind]}, {x.item_count})</option>)}</optgroup>
            ))}
          </select>
          {set.loading && setId && <Spinner />}
          {s && <p className="muted small">{KIND_LABEL[s.kind]}, {n} madde{imgCount ? `, ${imgCount} tanesi resimli` : ''}.</p>}
        </section>

        {s && <>
          <section className="card stack">
            <h2 className="h-sub">2. Oyun türü</h2>
            <div className="choice-grid">
              {Object.values(GAMES).map((gm) => (
                <label key={gm.id} className={`choice ${f.game_type === gm.id ? 'on' : ''}`}>
                  <input type="radio" name="game" checked={f.game_type === gm.id} onChange={() => up({ game_type: gm.id, time: gm.defaultTime })} />
                  <strong>{gm.name}</strong>
                  <span className="muted small">{gm.desc}</span>
                </label>
              ))}
              <div className="choice disabled" aria-disabled="true"><strong>Eşleştirme, Hafıza, Yazma, Doğru mu?</strong><span className="muted small">Yakında</span></div>
            </div>
          </section>

          <section className="card stack">
            <h2 className="h-sub">3. Ayarlar</h2>
            <div className="row-fields">
              <Field label="Soru sayısı" hint={`En çok ${n}`}><input type="number" min={1} max={n} value={f.question_count} onChange={(e) => up({ question_count: e.target.value })} required /></Field>
              <Field label={g.timeLabel}><input type="number" min={g.timeUnit === 'min' ? 0 : 5} max={g.timeUnit === 'min' ? 120 : 120} value={f.time} onChange={(e) => up({ time: e.target.value })} /></Field>
            </div>
            {s.kind === 'words' && <>
              <div className="field">
                <span className="field-label">Soru yönü</span>
                <div className="chip-row">
                  {DIRS.filter((d) => d.id !== 'image' || hasImages).map((d) => (
                    <label key={d.id} className={`chip ${f.direction === d.id ? 'on' : ''}`} title={d.desc}>
                      <input type="radio" name="dir" checked={f.direction === d.id} onChange={() => up({ direction: d.id })} />{d.label}
                    </label>
                  ))}
                </div>
                <span className="field-hint">{DIRS.find((d) => d.id === f.direction)?.desc}{(f.direction === 'image' || f.direction === 'tr_to_img') && imgCount < n ? `. Önce resimli ${imgCount} kelime sorulur.` : ''}</span>
              </div>
              <div className="field">
                <span className="field-label">Öğrencinin seçebileceği diller</span>
                <div className="chip-row">
                  {LANG_ORDER.map((l) => (
                    <label key={l} className={`chip ${f.langs.includes(l) ? 'on' : ''}`}>
                      <input type="checkbox" checked={f.langs.includes(l)} onChange={(e) => up({ langs: e.target.checked ? LANG_ORDER.filter((x) => x === l || f.langs.includes(x)) : f.langs.filter((x) => x !== l) })} />{LANGS[l].tr}
                    </label>
                  ))}
                </div>
              </div>
            </>}
          </section>

          <section className="card stack">
            <h2 className="h-sub">4. Ödev bilgisi</h2>
            <Field label="Ödev adı"><input value={f.title} onChange={(e) => { setTitleTouched(true); up({ title: e.target.value }); }} required /></Field>
            <div className="row-fields">
              <Field label="Sınıf" hint="İsteğe bağlı"><input value={f.class_name} onChange={(e) => up({ class_name: e.target.value })} placeholder="7-A" /></Field>
              <Field label="Son teslim" hint="İsteğe bağlı"><input type="datetime-local" value={f.due} onChange={(e) => up({ due: e.target.value })} /></Field>
            </div>
          </section>

          <div className="row end">
            <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Oluşturuluyor…' : 'Ödev oluştur'}</button>
          </div>
        </>}
      </form>
    </div>
  );
}

function groupBy(arr, f) {
  const m = new Map();
  arr.forEach((x) => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return [...m.entries()];
}
