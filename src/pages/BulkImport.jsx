import { useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { useToast } from '../components/ui.jsx';
import { parseFile, parseText, parseUnit, rowsFromParsed } from '../lib/parse.js';

const low = (s) => String(s || '').trim().toLocaleLowerCase('tr');

export default function BulkImport({ user }) {
  const [parsed, setParsed] = useState(null);
  const [text, setText] = useState('');
  const [split, setSplit] = useState('unit'); // unit | topic
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);
  const toast = useToast();

  const groups = useMemo(() => {
    if (!parsed) return [];
    const g = new Map();
    parsed.rows.forEach((r) => {
      const book = (r.book || '').trim() || 'Adsız kitap';
      const u = parseUnit(r.unit);
      const topic = (r.topic || '').trim();
      const unitTitle = u.title;
      const setTitle = split === 'topic' && topic ? `${u.number}. Ünite: ${topic}` : `${u.number}. Ünite kelimeleri`;
      const key = `${low(book)}|${u.number}|${setTitle}`;
      if (!g.has(key)) g.set(key, { book, unit: u.number, unitTitle, setTitle, words: [] });
      const grp = g.get(key);
      if (!grp.unitTitle && unitTitle) grp.unitTitle = unitTitle;
      grp.words.push({ tr: r.tr, en: r.en, ky: r.ky, ru: r.ru, topic: topic || null });
    });
    return [...g.values()];
  }, [parsed, split]);

  async function fromFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setParsed(rowsFromParsed(await parseFile(f), 'bulk')); setText(''); setDone(null); }
    catch (err) { toast('Dosya okunamadı: ' + err.message, 'error'); }
  }

  async function run() {
    setProgress({ step: 0, total: groups.length });
    const report = { books: 0, units: 0, sets: 0, words: 0, skipped: 0 };
    try {
      const books = await api.listBooks();
      const units = await api.listUnits();
      const sets = (await api.listSets()).filter((s) => s.owner_id === user.id);
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        let book = books.find((b) => low(b.title) === low(g.book));
        if (!book) { book = await api.saveBook({ title: g.book.trim(), sort: books.length }); books.push(book); report.books++; }
        let unit = units.find((u) => u.book_id === book.id && u.number === g.unit);
        if (!unit) { unit = await api.saveUnit({ book_id: book.id, number: g.unit, title: g.unitTitle || null }); units.push(unit); report.units++; }
        let set = sets.find((s) => s.book_id === book.id && s.unit_id === unit.id && low(s.title) === low(g.setTitle) && s.kind === 'words');
        let existing = [];
        if (set) existing = (await api.getSet(set.id)).items.map(({ created_at, ...it }) => it);
        const have = new Set(existing.map((it) => low(it.tr)));
        const fresh = g.words.filter((w) => { const k = low(w.tr); if (!k || have.has(k)) return false; have.add(k); return true; });
        report.skipped += g.words.length - fresh.length;
        if (!fresh.length && set) { setProgress({ step: i + 1, total: groups.length }); continue; }
        const saved = await api.saveSet(set || { title: g.setTitle, kind: 'words', book_id: book.id, unit_id: unit.id, is_public: false }, [...existing, ...fresh]);
        if (!set) { sets.push(saved); report.sets++; }
        report.words += fresh.length;
        setProgress({ step: i + 1, total: groups.length });
      }
      setDone(report);
      setParsed(null);
      toast('Yükleme tamamlandı.');
    } catch (err) {
      toast('Yükleme yarıda kaldı: ' + err.message, 'error');
    } finally { setProgress(null); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Excel'den toplu yükle</h1>
          <p className="muted">Kitaplar, üniteler ve kelime setleri dosyadan otomatik oluşur. Aynı dosyayı tekrar yüklersen yalnız yeni kelimeler eklenir.</p>
        </div>
      </div>

      <div className="card stack">
        <p>Sütunlar: <strong>Kitap | Ünite | Konu | Türkçe | İngilizce | Kırgızca | Rusça</strong>. Konu sütunu isteğe bağlı. İlk satırda başlıklar varsa sütun sırası önemli değil.</p>
        <p className="muted small">Ünite sütununa "1" ya da "1. Ünite: Yeni Arkadaşlar" yazabilirsin; ünite adı ikinci yazımdan alınır.</p>
        <div className="row">
          <label className="btn btn-primary">
            Excel ya da CSV dosyası seç
            <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden onChange={fromFile} />
          </label>
          <span className="muted">ya da tabloyu aşağıya yapıştır</span>
        </div>
        <textarea rows={5} value={text} placeholder={'Kitap\tÜnite\tKonu\tTürkçe\tİngilizce\tKırgızca\tRusça'} onChange={(e) => { setText(e.target.value); setDone(null); setParsed(e.target.value.trim() ? rowsFromParsed(parseText(e.target.value), 'bulk') : null); }} aria-label="Tabloyu yapıştır" />
      </div>

      {parsed && (
        <div className="card stack">
          <div className="toolbar">
            <h2 className="h-sub">{parsed.rows.length} kelime, {groups.length} set</h2>
            <div className="radio-row">
              <label><input type="radio" checked={split === 'unit'} onChange={() => setSplit('unit')} /> Her ünite tek set</label>
              <label><input type="radio" checked={split === 'topic'} onChange={() => setSplit('topic')} /> Her konu ayrı set</label>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Kitap</th><th>Ünite</th><th>Set</th><th className="num">Kelime</th><th>Örnek</th></tr></thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr key={i}>
                    <td>{g.book}</td><td>{g.unit}{g.unitTitle ? `. ${g.unitTitle}` : ''}</td><td>{g.setTitle}</td><td className="num">{g.words.length}</td>
                    <td className="muted small">{g.words.slice(0, 3).map((w) => w.tr).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row end">
            <button className="btn btn-ghost" onClick={() => { setParsed(null); setText(''); }}>Vazgeç</button>
            <button className="btn btn-primary" disabled={!!progress || !groups.length} onClick={run}>
              {progress ? `Yükleniyor… ${progress.step}/${progress.total}` : 'Yüklemeyi başlat'}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="card note-ok-card">
          <h2 className="h-sub">Yükleme tamamlandı</h2>
          <p>{done.books} yeni kitap, {done.units} yeni ünite, {done.sets} yeni set oluştu; {done.words} kelime eklendi.{done.skipped ? ` Zaten var olan ${done.skipped} kelime atlandı.` : ''}</p>
          <a className="btn btn-primary" href="#/">Kitaplara git</a>
        </div>
      )}
    </div>
  );
}
