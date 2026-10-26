import { useState } from 'react';
import { api } from '../api/index.js';
import { Empty, Field, ImagePick, Modal, Spinner, useAsync, useToast } from '../components/ui.jsx';

export function Cover({ book, big }) {
  if (book.cover_url) return <img className="cover-img" src={book.cover_url} alt={`${book.title} kapağı`} loading="lazy" />;
  return (
    <div className={`cover-fallback ${big ? 'big' : ''}`} aria-hidden="true">
      {book.subtitle && <span className="cover-fallback-sub">{book.subtitle}</span>}
      <span className="cover-fallback-title">{book.title}</span>
    </div>
  );
}

export function BookModal({ book, onClose, onSaved }) {
  const [b, setB] = useState(book || { title: '', subtitle: '', cover_url: null, sort: 0 });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function save(e) {
    e.preventDefault();
    if (!b.title.trim()) return;
    setBusy(true);
    try { const saved = await api.saveBook({ ...b, title: b.title.trim() }); toast('Kitap kaydedildi.'); onSaved(saved); onClose(); }
    catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={book?.id ? 'Kitabı düzenle' : 'Yeni kitap'} onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <div className="book-form">
          <div className="book-form-cover">
            <span className="field-label">Kapak resmi</span>
            <ImagePick size="cover" label="Kapak yükle" value={b.cover_url} onChange={(v) => setB({ ...b, cover_url: v })} max={700} folder="covers" />
          </div>
          <div className="stack">
            <Field label="Kitap adı"><input value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} required placeholder="Maarif Türkçe Ortaokul A2.1" /></Field>
            <Field label="Kısa not" hint="Ör. sınıf ya da seviye"><input value={b.subtitle || ''} onChange={(e) => setB({ ...b, subtitle: e.target.value })} placeholder="7. sınıf" /></Field>
            <Field label="Sıra" hint="Ana sayfada küçük sayı önce gelir"><input type="number" value={b.sort || 0} onChange={(e) => setB({ ...b, sort: Number(e.target.value) })} /></Field>
          </div>
        </div>
        <div className="modal-foot-inline">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn btn-primary" disabled={busy}>Kaydet</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Home() {
  const books = useAsync(() => api.listBooks(), []);
  const sets = useAsync(() => api.listSets(), []);
  const [adding, setAdding] = useState(false);

  const counts = {};
  (sets.data || []).forEach((s) => { if (s.book_id) counts[s.book_id] = (counts[s.book_id] || 0) + 1; });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Kitaplar</h1>
          <p className="muted">Bir kitap seç; ünitelerini ve setlerini gör.</p>
        </div>
        <div className="row">
          <a className="btn btn-ghost" href="#/yukle">Excel'den yükle</a>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>Kitap ekle</button>
        </div>
      </div>
      {books.loading ? <Spinner /> : books.error ? <p className="note note-error">{books.error.message}</p> : !books.data.length ? (
        <Empty title="Henüz kitap yok" action={<div className="row center"><button className="btn btn-primary" onClick={() => setAdding(true)}>İlk kitabı ekle</button><a className="btn btn-ghost" href="#/yukle">Excel'den toplu yükle</a></div>}>
          Kitabı elle ekleyebilir ya da Kitap, Ünite, Türkçe, İngilizce, Kırgızca, Rusça sütunlu bir Excel dosyası yükleyebilirsin.
        </Empty>
      ) : (
        <div className="book-grid">
          {books.data.map((b) => (
            <a key={b.id} href={`#/kitap/${b.id}`} className="book-card">
              <div className="book-cover"><Cover book={b} /></div>
              <div className="book-meta">
                <strong>{b.title}</strong>
                <span className="muted">{[b.subtitle, counts[b.id] ? `${counts[b.id]} set` : 'Set yok'].filter(Boolean).join(', ')}</span>
              </div>
            </a>
          ))}
        </div>
      )}
      {adding && <BookModal onClose={() => setAdding(false)} onSaved={() => books.reload()} />}
    </div>
  );
}
