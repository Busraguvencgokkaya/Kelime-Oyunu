import { useState } from 'react';
import { Modal, useToast } from './ui.jsx';
import { parseFile, parseText, rowsFromParsed } from '../lib/parse.js';

const COLS = {
  words: [['tr', 'Türkçe'], ['en', 'İngilizce'], ['ky', 'Kırgızca'], ['ru', 'Rusça'], ['topic', 'Konu']],
  questions: [['prompt', 'Soru'], ['answer', 'Doğru cevap'], ['w1', 'Yanlış 1'], ['w2', 'Yanlış 2'], ['w3', 'Yanlış 3']],
};

export default function ImportModal({ kind, onClose, onImport, hasItems }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [mode, setMode] = useState('append');
  const toast = useToast();
  const cols = COLS[kind];

  function fromText(t) {
    setText(t);
    setParsed(t.trim() ? rowsFromParsed(parseText(t), kind) : null);
  }
  async function fromFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setParsed(rowsFromParsed(await parseFile(f), kind)); setText(''); }
    catch (err) { toast('Dosya okunamadı: ' + err.message, 'error'); }
  }
  function apply() {
    const items = parsed.rows.map((r) => (kind === 'words'
      ? { tr: r.tr, en: r.en, ky: r.ky, ru: r.ru, topic: r.topic || null }
      : { prompt: r.prompt, answer: r.answer, wrongs: [r.w1, r.w2, r.w3].filter(Boolean).map((t) => ({ text: t })) }));
    onImport(items, mode);
    onClose();
  }

  return (
    <Modal title={kind === 'words' ? 'Kelimeleri içe aktar' : 'Soruları içe aktar'} onClose={onClose} wide footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
      <button className="btn btn-primary" disabled={!parsed?.rows.length} onClick={apply}>{parsed?.rows.length ? `${parsed.rows.length} satırı ekle` : 'Satır ekle'}</button>
    </>}>
      <p className="muted">
        Sütun sırası: <strong>{cols.map((c) => c[1]).join(' | ')}</strong>.
        {kind === 'words' && ' Konu sütunu isteğe bağlı.'} İlk satırda bu başlıklar varsa sıra önemli değil.
      </p>
      <div className="import-grid">
        <label className="field">
          <span className="field-label">Excel ya da Word tablosundan kopyalayıp buraya yapıştır</span>
          <textarea rows={8} value={text} onChange={(e) => fromText(e.target.value)} placeholder={kind === 'words' ? 'merhaba\thello\tсалам\tпривет' : 'Hangisi bir renk?\tmavi\tmasa\tkoşmak\tyarın'} />
        </label>
        <div className="import-or">
          <span className="muted">ya da</span>
          <label className="btn btn-ghost">
            Dosya seç (.xlsx, .csv)
            <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden onChange={fromFile} />
          </label>
        </div>
      </div>
      {parsed && (
        <div className="import-preview">
          <p><strong>{parsed.rows.length}</strong> satır bulundu{parsed.header ? ', başlık satırı tanındı' : ''}{parsed.skipped ? `, ${parsed.skipped} boş satır atlandı` : ''}.</p>
          {parsed.rows.length > 0 && (
            <div className="table-wrap">
              <table className="table small">
                <thead><tr>{cols.map((c) => <th key={c[0]}>{c[1]}</th>)}</tr></thead>
                <tbody>{parsed.rows.slice(0, 6).map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[0]}>{r[c[0]]}</td>)}</tr>)}</tbody>
              </table>
              {parsed.rows.length > 6 && <p className="muted small">…ve {parsed.rows.length - 6} satır daha</p>}
            </div>
          )}
          {hasItems && (
            <div className="radio-row">
              <label><input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} /> Var olanların sonuna ekle</label>
              <label><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Var olanları sil, bunlarla değiştir</label>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
