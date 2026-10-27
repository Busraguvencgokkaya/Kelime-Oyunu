import { useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { useAsync, useToast } from '../components/ui.jsx';
import { parseFile, parseText, parseUnit, rowsFromParsed } from '../lib/parse.js';
import { parseDocx } from '../lib/docx.js';
import { resizeImage } from '../lib/util.js';

const low = (s) => String(s || '').trim().toLocaleLowerCase('tr');

export default function BulkImport({ user }) {
  const [parsed, setParsed] = useState(null);
  const [text, setText] = useState('');
  const [split, setSplit] = useState('unit'); // unit | topic
  const [share, setShare] = useState(true);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);
  const [bookName, setBookName] = useState('');
  const toast = useToast();
  const bookList = useAsync(() => api.listBooks(), []);

  const groups = useMemo(() => {
    if (!parsed) return [];
    const g = new Map();
    parsed.rows.forEach((r) => {
      const book = (parsed.docx ? bookName : r.book || '').trim() || 'Adsız kitap';
      const u = parseUnit(r.unit);
      const topic = (r.topic || '').trim();
      const unitTitle = u.title;
      const uLabel = u.number === 0 ? 'Başlangıç Ünitesi' : `${u.number}. Ünite`;
      const setTitle = split === 'topic' && topic ? `${uLabel}: ${topic}` : `${uLabel} kelimeleri`;
      const key = `${low(book)}|${u.number}|${setTitle}`;
      if (!g.has(key)) g.set(key, { book, unit: u.number, unitTitle, setTitle, words: [] });
      const grp = g.get(key);
      if (!grp.unitTitle && unitTitle) grp.unitTitle = unitTitle;
      grp.words.push({ tr: r.tr, en: r.en, ky: r.ky, ru: r.ru, topic: topic || null, img: r.img || null });
    });
    return [...g.values()];
  }, [parsed, split, bookName]);

  async function fromFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) loadFile(f);
  }
  function onDrop(e) {
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    loadFile(f);
  }
  async function loadFile(f) {
    try {
      if (f.name.toLowerCase().endsWith('.docx')) {
        const res = await parseDocx(f);
        if (!res.rows.length) { toast('Word dosyasında kelime tablosu bulunamadı.', 'error'); return; }
        setBookName(res.bookGuess || f.name.replace(/\.docx$/i, ''));
        setParsed(res);
      } else setParsed(rowsFromParsed(await parseFile(f), 'bulk'));
      setText(''); setDone(null);
    } catch (err) { toast('Dosya okunamadı: ' + err.message, 'error'); }
  }

  // Aynı görsel birden çok satırda geçse de bir kez yüklenir
  const uploaded = {};
  async function imageUrl(img) {
    if (!img) return null;
    if (!uploaded[img.key]) uploaded[img.key] = resizeImage(img.blob, 400).then((b) => api.uploadImage(b, 'words'));
    return uploaded[img.key];
  }

  async function run() {
    setProgress({ step: 0, total: groups.length });
    const report = { books: 0, units: 0, sets: 0, words: 0, skipped: 0, images: 0, filled: 0 };
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
        const byTr = new Map(existing.map((it) => [low(it.tr), it]));
        const fresh = [];
        let changed = false;
        for (const w of g.words) {
          const k = low(w.tr);
          if (!k) continue;
          const old = byTr.get(k);
          if (old) {
            // Var olan kelimenin görseli yoksa yeni dosyadaki görseli ekle
            if (!old.image_url && w.img) { old.image_url = await imageUrl(w.img); changed = true; report.images++; }
            // Var olan kelimede boş kalan çevirileri yeni dosyadan doldur
            let filled = false;
            for (const f of ['en', 'ky', 'ru']) {
              if (!(old[f] || '').trim() && (w[f] || '').trim()) { old[f] = w[f]; filled = true; }
            }
            if (filled) { changed = true; report.filled++; } else report.skipped++;
            continue;
          }
          const { img, ...word } = w;
          if (img) { word.image_url = await imageUrl(img); report.images++; }
          byTr.set(k, word);
          fresh.push(word);
          setProgress({ step: i, total: groups.length, word: w.tr });
        }
        if (!fresh.length && set && !changed) { setProgress({ step: i + 1, total: groups.length }); continue; }
        const saved = await api.saveSet(set || { title: g.setTitle, kind: 'words', book_id: book.id, unit_id: unit.id, is_public: share }, [...existing, ...fresh]);
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
          <h1>Dosyadan toplu yükle</h1>
          <p className="muted">Kitaplar, üniteler ve kelime setleri Excel ya da Word dosyasından otomatik oluşur. Aynı dosyayı tekrar yüklersen yalnız yeni kelimeler eklenir.</p>
        </div>
      </div>

      <div className="card stack" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <p>Sütunlar: <strong>Kitap | Ünite | Konu | Türkçe | İngilizce | Kırgızca | Rusça</strong>. Konu sütunu isteğe bağlı. İlk satırda başlıklar varsa sütun sırası önemli değil.</p>
        <p className="muted small">Ünite sütununa "1" ya da "1. Ünite: Yeni Arkadaşlar" yazabilirsin; ünite adı ikinci yazımdan alınır.</p>
        <p className="muted small"><strong>Word dosyası</strong> da yükleyebilirsin: "1. ÜNİTE: …" başlıkları, konu başlıkları ve GÖRSEL | TÜRKÇE | ENGLISH | КЫРГЫЗЧА | РУССКИЙ sütunlu tablolar okunur. Tablodaki görseller kelimelere otomatik eklenir.</p>
        <div className="row">
          <label className="btn btn-primary">
            Excel ya da Word dosyası seç
            <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.docx" hidden onChange={fromFile} />
          </label>
          <span className="muted">ya da dosyayı buraya sürükle, ya da tabloyu aşağıya yapıştır</span>
        </div>
        <textarea rows={5} value={text} onDrop={onDrop} placeholder={'Kitap\tÜnite\tKonu\tTürkçe\tİngilizce\tKırgızca\tRusça'} onChange={(e) => { setText(e.target.value); setDone(null); setParsed(e.target.value.trim() ? rowsFromParsed(parseText(e.target.value), 'bulk') : null); }} aria-label="Tabloyu yapıştır" />
      </div>

      {parsed && (
        <div className="card stack">
          <div className="toolbar">
            <h2 className="h-sub">{parsed.rows.length} kelime, {groups.length} set{parsed.images ? `, ${parsed.images} görsel` : ''}</h2>
            <div className="radio-row">
              <label><input type="radio" checked={split === 'unit'} onChange={() => setSplit('unit')} /> Her ünite tek set</label>
              <label><input type="radio" checked={split === 'topic'} onChange={() => setSplit('topic')} /> Her konu ayrı set</label>
            </div>
          </div>
          {parsed.docx && (
            <label className="field">
              <span className="field-label">Kitap adı</span>
              <input list="book-names" value={bookName} onChange={(e) => setBookName(e.target.value)} />
              <datalist id="book-names">{(bookList.data || []).map((b) => <option key={b.id} value={b.title} />)}</datalist>
              <span className="field-hint">Word dosyasının başlığından alındı. Var olan bir kitabın adını seçersen kelimeler o kitaba eklenir.</span>
            </label>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Kitap</th><th>Ünite</th><th>Set</th><th className="num">Kelime</th><th>Örnek</th></tr></thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr key={i}>
                    <td>{g.book}</td><td>{g.unit}{g.unitTitle ? `. ${g.unitTitle}` : ''}</td><td>{g.setTitle}</td><td className="num">{g.words.length}</td>
                    <td className="muted small">
                      <span className="sample">
                        {g.words.slice(0, 3).map((w, k) => <span key={k}>{w.img && <img src={w.img.preview} alt="" />}{w.tr}</span>)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="check-line"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Yeni setleri diğer öğretmenlerle paylaş (görüp ödev verebilsinler)</label>
          <div className="row end">
            <button className="btn btn-ghost" onClick={() => { setParsed(null); setText(''); }}>Vazgeç</button>
            <button className="btn btn-primary" disabled={!!progress || !groups.length} onClick={run}>
              {progress ? `Yükleniyor… ${progress.step}/${progress.total}${progress.word ? ` (${progress.word})` : ''}` : 'Yüklemeyi başlat'}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="card note-ok-card">
          <h2 className="h-sub">Yükleme tamamlandı</h2>
          <p>{done.books} yeni kitap, {done.units} yeni ünite, {done.sets} yeni set oluştu; {done.words} kelime eklendi.{done.images ? ` ${done.images} görsel yüklendi.` : ''}{done.filled ? ` ${done.filled} kelimenin eksik çevirisi tamamlandı.` : ''}{done.skipped ? ` Zaten var olan ${done.skipped} kelime atlandı.` : ''}</p>
          <a className="btn btn-primary" href="#/">Kitaplara git</a>
        </div>
      )}
    </div>
  );
}
