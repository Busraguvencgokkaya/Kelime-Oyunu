import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { Confirm, Empty, Field, ImagePick, Spinner, Toggle, useAsync, useToast } from '../components/ui.jsx';
import ImportModal from '../components/ImportModal.jsx';
import { go } from '../lib/util.js';
import { KIND_LABEL } from '../lib/sets.js';

let k = 0;
const withKey = (it) => ({ ...it, _k: ++k });
const blankWord = () => withKey({ tr: '', en: '', ky: '', ru: '', topic: '', image_url: null });
const blankQuestion = () => withKey({ prompt: '', prompt_image: null, answer: '', answer_image: null, wrongs: [{ text: '' }, { text: '' }, { text: '' }] });

export default function SetEditor({ id, query, user }) {
  const toast = useToast();
  const load = useAsync(async () => {
    const [books, units] = await Promise.all([api.listBooks(), api.listUnits()]);
    const set = id ? await api.getSet(id) : null;
    return { books, units, set };
  }, [id]);

  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (!load.data) return;
    const s = load.data.set;
    if (s) {
      setMeta({ id: s.id, title: s.title, kind: s.kind, book_id: s.book_id, unit_id: s.unit_id, topic: s.topic || '', is_public: s.is_public, owner_id: s.owner_id });
      setItems(s.items.map((it) => withKey({ ...it, wrongs: padWrongs(it.wrongs) })));
    } else {
      const kind = query.get('kind') === 'questions' ? 'questions' : 'words';
      setMeta({ id: null, title: '', kind, book_id: query.get('book') || '', unit_id: query.get('unit') || '', topic: '', is_public: false });
      setItems(kind === 'words' ? [blankWord(), blankWord(), blankWord()] : [blankQuestion()]);
    }
  }, [load.data]);

  useEffect(() => {
    const f = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', f);
    return () => removeEventListener('beforeunload', f);
  }, [dirty]);

  const units = useMemo(() => (load.data?.units || []).filter((u) => u.book_id === meta?.book_id), [load.data, meta?.book_id]);

  if (load.loading || !meta) return <Spinner />;
  if (load.error) return <p className="note note-error">{load.error.message}</p>;
  if (id && !load.data.set) return <Empty title="Set bulunamadı" action={<a className="btn btn-primary" href="#/setler">Setlere dön</a>} />;
  if (meta.owner_id && meta.owner_id !== user.id) return <Empty title="Bu set başka bir öğretmene ait" action={<a className="btn btn-primary" href="#/setler">Setlere dön</a>}>Kopyalayıp kendi setin olarak düzenleyebilirsin.</Empty>;

  const isWords = meta.kind === 'words';
  const m = (patch) => { setMeta({ ...meta, ...patch }); setDirty(true); };
  const upd = (key, patch) => { setItems((l) => l.map((it) => (it._k === key ? { ...it, ...patch } : it))); setDirty(true); };
  const del = (key) => { setItems((l) => l.filter((it) => it._k !== key)); setDirty(true); };
  const add = () => { setItems((l) => [...l, isWords ? blankWord() : blankQuestion()]); setDirty(true); };

  const filled = items.filter((it) => (isWords ? (it.tr || '').trim() : (it.prompt || '').trim() || it.prompt_image));

  async function save(thenAssign) {
    if (!meta.title.trim()) { toast('Sete bir ad ver.', 'error'); document.getElementById('set-title')?.focus(); return; }
    if (!isWords) {
      const bad = filled.findIndex((q) => !(q.answer || '').trim() && !q.answer_image);
      if (bad >= 0) { toast(`${bad + 1}. sorunun doğru cevabı boş.`, 'error'); return; }
    }
    setBusy(true);
    try {
      const clean = filled.map(({ _k, ...it }) => ({ ...it, wrongs: (it.wrongs || []).filter((w) => (w.text || '').trim() || w.image) }));
      const saved = await api.saveSet({ ...meta, title: meta.title.trim() }, clean);
      setDirty(false);
      toast('Set kaydedildi.');
      if (thenAssign) go(`/odev/yeni?set=${saved.id}`);
      else if (!meta.id) go(`/set/${saved.id}`);
      else load.reload();
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  }

  function onImport(newItems, mode) {
    const mapped = newItems.map((it) => withKey(isWords ? it : { ...it, wrongs: padWrongs(it.wrongs) }));
    setItems((l) => (mode === 'replace' ? mapped : [...l.filter((it) => (isWords ? it.tr : it.prompt)), ...mapped]));
    setDirty(true);
    toast(`${newItems.length} satır eklendi. Kaydetmeyi unutma.`);
  }

  return (
    <div className="page">
      <a href={meta.book_id ? `#/kitap/${meta.book_id}` : '#/setler'} className="back">{meta.book_id ? 'Kitaba dön' : 'Setler'}</a>
      <div className="editor-head">
        <span className={`badge kind-${meta.kind}`}>{KIND_LABEL[meta.kind]}</span>
        <input id="set-title" className="title-input" value={meta.title} onChange={(e) => m({ title: e.target.value })} placeholder={isWords ? 'Ör. Ünite 1 kelimeleri' : 'Ör. Geçmiş zaman soruları'} aria-label="Set adı" />
      </div>

      <div className="meta-grid card">
        <Field label="Kitap">
          <select value={meta.book_id || ''} onChange={(e) => m({ book_id: e.target.value, unit_id: '' })}>
            <option value="">Kitap seçilmedi</option>
            {load.data.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </Field>
        <Field label="Ünite">
          <select value={meta.unit_id || ''} onChange={(e) => m({ unit_id: e.target.value })} disabled={!meta.book_id}>
            <option value="">Ünite seçilmedi</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.number}. {u.title || 'Ünite'}</option>)}
          </select>
        </Field>
        <Field label="Konu" hint="İsteğe bağlı"><input value={meta.topic} onChange={(e) => m({ topic: e.target.value })} placeholder="Ör. Okul eşyaları" /></Field>
        <div className="field"><span className="field-label">Paylaşım</span><Toggle checked={meta.is_public} onChange={(v) => m({ is_public: v })} label="Diğer öğretmenler görebilsin" /></div>
      </div>

      <div className="toolbar">
        <h2 className="h-sub">{filled.length} {isWords ? 'kelime' : 'soru'}</h2>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setImporting(true)}>Yapıştır ya da dosya yükle</button>
          <button className="btn btn-ghost" onClick={add}>{isWords ? 'Kelime ekle' : 'Soru ekle'}</button>
        </div>
      </div>

      {isWords ? (
        <div className="word-table" role="table" aria-label="Kelimeler">
          <div className="word-row word-head" role="row">
            <span>#</span><span>Resim</span><span>Türkçe</span><span>İngilizce</span><span>Kırgızca</span><span>Rusça</span><span>Konu</span><span />
          </div>
          {items.map((it, i) => (
            <div className="word-row" role="row" key={it._k}>
              <span className="word-no">{i + 1}</span>
              <ImagePick value={it.image_url} onChange={(v) => upd(it._k, { image_url: v })} />
              <input aria-label="Türkçe" className="w-tr" value={it.tr || ''} onChange={(e) => upd(it._k, { tr: e.target.value })} placeholder="Türkçe" />
              <input aria-label="İngilizce" value={it.en || ''} onChange={(e) => upd(it._k, { en: e.target.value })} placeholder="English" />
              <input aria-label="Kırgızca" value={it.ky || ''} onChange={(e) => upd(it._k, { ky: e.target.value })} placeholder="Кыргызча" />
              <input aria-label="Rusça" value={it.ru || ''} onChange={(e) => upd(it._k, { ru: e.target.value })} placeholder="Русский" />
              <input aria-label="Konu" value={it.topic || ''} onChange={(e) => upd(it._k, { topic: e.target.value })} placeholder="Konu" />
              <button className="icon-btn" aria-label={`${i + 1}. satırı sil`} onClick={() => del(it._k)}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="q-list">
          {items.map((q, i) => (
            <div className="q-card card" key={q._k}>
              <div className="q-card-head">
                <span className="q-no">{i + 1}</span>
                <button className="icon-btn" aria-label={`${i + 1}. soruyu sil`} onClick={() => del(q._k)}>✕</button>
              </div>
              <div className="q-prompt">
                <textarea rows={2} value={q.prompt || ''} onChange={(e) => upd(q._k, { prompt: e.target.value })} placeholder="Soruyu yaz (resim de ekleyebilirsin)" aria-label="Soru" />
                <ImagePick size="md" label="Soru resmi" value={q.prompt_image} onChange={(v) => upd(q._k, { prompt_image: v })} />
              </div>
              <div className="q-options">
                <div className="q-opt q-opt-ok">
                  <span className="q-opt-label">Doğru</span>
                  <input value={q.answer || ''} onChange={(e) => upd(q._k, { answer: e.target.value })} placeholder="Doğru cevap" aria-label="Doğru cevap" />
                  <ImagePick value={q.answer_image} onChange={(v) => upd(q._k, { answer_image: v })} />
                </div>
                {q.wrongs.map((w, j) => (
                  <div className="q-opt" key={j}>
                    <span className="q-opt-label">Yanlış</span>
                    <input value={w.text || ''} onChange={(e) => upd(q._k, { wrongs: q.wrongs.map((x, n) => (n === j ? { ...x, text: e.target.value } : x)) })} placeholder={`Yanlış seçenek ${j + 1}`} aria-label={`Yanlış seçenek ${j + 1}`} />
                    <ImagePick value={w.image} onChange={(v) => upd(q._k, { wrongs: q.wrongs.map((x, n) => (n === j ? { ...x, image: v } : x)) })} />
                  </div>
                ))}
              </div>
              <p className="muted small">Yanlış seçenekleri boş bırakırsan diğer soruların cevaplarından seçilir.</p>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-ghost add-row" onClick={add}>{isWords ? 'Kelime ekle' : 'Soru ekle'}</button>

      <div className="savebar">
        {meta.id && <button className="btn btn-ghost danger-text" onClick={() => setConfirm(true)}>Seti sil</button>}
        <span className="savebar-state">{dirty ? 'Kaydedilmemiş değişiklik var' : meta.id ? 'Bütün değişiklikler kaydedildi' : ''}</span>
        <button className="btn btn-ghost" disabled={busy || !filled.length} onClick={() => save(true)}>Kaydet ve ödev ver</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => save(false)}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>

      {importing && <ImportModal kind={meta.kind} hasItems={filled.length > 0} onClose={() => setImporting(false)} onImport={onImport} />}
      {confirm && <Confirm text={`"${meta.title}" seti silinsin mi? Bu setten verilmiş ödevler ve sonuçları silinmez.`} onOk={async () => { await api.deleteSet(meta.id); setDirty(false); toast('Set silindi.'); go(meta.book_id ? `/kitap/${meta.book_id}` : '/setler'); }} onClose={() => setConfirm(false)} />}
    </div>
  );
}

function padWrongs(w) {
  const a = (w || []).map((x) => ({ text: x.text || '', image: x.image || null }));
  while (a.length < 3) a.push({ text: '', image: null });
  return a.slice(0, 3);
}
