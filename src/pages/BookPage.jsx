import { useState } from 'react';
import { api } from '../api/index.js';
import { Confirm, Empty, Field, Modal, Spinner, useAsync, useToast } from '../components/ui.jsx';
import { go } from '../lib/util.js';
import { copySet, KIND_LABEL } from '../lib/sets.js';
import { BookModal, Cover } from './Home.jsx';

function UnitModal({ unit, bookId, nextNumber, onClose, onSaved }) {
  const [u, setU] = useState(unit || { book_id: bookId, number: nextNumber, title: '' });
  const toast = useToast();
  return (
    <Modal title={unit ? 'Üniteyi düzenle' : 'Yeni ünite'} onClose={onClose}>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        try { await api.saveUnit(u); onSaved(); onClose(); } catch (err) { toast(err.message, 'error'); }
      }}>
        <div className="row-fields">
          <Field label="Ünite no" className="w-small"><input type="number" min={0} value={u.number} onChange={(e) => setU({ ...u, number: Number(e.target.value) })} required /></Field>
          <Field label="Ünite adı"><input value={u.title || ''} onChange={(e) => setU({ ...u, title: e.target.value })} placeholder="Yeni Arkadaşlar" /></Field>
        </div>
        <div className="modal-foot-inline">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn btn-primary">Kaydet</button>
        </div>
      </form>
    </Modal>
  );
}

export function SetRow({ s, user, onCopied }) {
  const mine = s.owner_id === user.id;
  const toast = useToast();
  return (
    <li className="set-row">
      <a href={mine ? `#/set/${s.id}` : undefined} className="set-row-main" onClick={!mine ? (e) => e.preventDefault() : undefined}>
        <span className={`kind-dot kind-${s.kind}`} aria-hidden="true" />
        <span>
          <strong>{s.title}</strong>
          <span className="muted small">{KIND_LABEL[s.kind]}, {s.item_count} madde{s.topic ? `, ${s.topic}` : ''}{!mine ? ', başka öğretmenin seti' : s.is_public ? ', herkese açık' : ''}</span>
        </span>
      </a>
      <div className="row">
        {!mine && <button className="btn btn-ghost btn-sm" onClick={async () => { try { const c = await copySet(s.id); toast('Set kopyalandı.'); onCopied?.(c); } catch (e) { toast(e.message, 'error'); } }}>Kopyala</button>}
        {s.item_count > 0 && <a className="btn btn-ghost btn-sm" href={`#/sinif?set=${s.id}`}>Sınıfta oyna</a>}
        {s.item_count > 0 && <a className="btn btn-primary btn-sm" href={`#/odev/yeni?set=${s.id}`}>Ödev ver</a>}
      </div>
    </li>
  );
}

export default function BookPage({ id, user }) {
  const data = useAsync(async () => {
    const [book, units, sets, profile] = await Promise.all([api.getBook(id), api.listUnits(id), api.listSets({ bookId: id }), api.getProfile()]);
    return { book, units, sets, profile };
  }, [id]);
  const [editBook, setEditBook] = useState(false);
  const [unitModal, setUnitModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <p className="note note-error">{data.error.message}</p>;
  const { book, units, sets, profile } = data.data;
  if (!book) return <Empty title="Kitap bulunamadı" action={<a className="btn btn-primary" href="#/">Kitaplara dön</a>} />;
  const canEdit = book.created_by === user.id || profile?.is_admin;
  const visible = sets.filter((s) => s.owner_id === user.id || s.is_public);
  const byUnit = (uid) => visible.filter((s) => s.unit_id === uid);
  const loose = visible.filter((s) => !s.unit_id || !units.some((u) => u.id === s.unit_id));
  const nextNumber = units.length ? Math.max(...units.map((u) => u.number)) + 1 : 1;

  return (
    <div className="page">
      <a href="#/" className="back">Kitaplar</a>
      <div className="book-hero">
        <div className="book-hero-cover"><Cover book={book} big /></div>
        <div className="book-hero-text">
          <h1>{book.title}</h1>
          {book.subtitle && <p className="muted">{book.subtitle}</p>}
          <p className="muted">{units.length} ünite, {visible.length} set</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => setUnitModal({})}>Ünite ekle</button>
            {canEdit && <button className="btn btn-ghost" onClick={() => setEditBook(true)}>Kitabı düzenle</button>}
            {canEdit && <button className="btn btn-ghost danger-text" onClick={() => setConfirm({ text: `"${book.title}" kitabı ve üniteleri silinsin mi? Setler silinmez, kitapsız kalır.`, ok: async () => { await api.deleteBook(book.id); toast('Kitap silindi.'); go('/'); } })}>Kitabı sil</button>}
          </div>
        </div>
      </div>

      {!units.length && !loose.length && (
        <Empty title="Bu kitapta henüz ünite yok" action={<button className="btn btn-primary" onClick={() => setUnitModal({})}>İlk üniteyi ekle</button>} />
      )}

      <div className="unit-list">
        {units.map((u) => {
          const list = byUnit(u.id);
          const canEditUnit = u.created_by === user.id || profile?.is_admin;
          return (
            <section key={u.id} className="unit">
              <header className="unit-head">
                <h2><span className="unit-no">{u.number}</span>{u.title || `${u.number}. Ünite`}</h2>
                <div className="row">
                  <a className="btn btn-ghost btn-sm" href={`#/set/yeni?kind=words&book=${book.id}&unit=${u.id}`}>Kelime seti</a>
                  <a className="btn btn-ghost btn-sm" href={`#/set/yeni?kind=questions&book=${book.id}&unit=${u.id}`}>Soru seti</a>
                  {canEditUnit && <button className="icon-btn" title="Üniteyi düzenle" aria-label="Üniteyi düzenle" onClick={() => setUnitModal({ unit: u })}>✎</button>}
                  {canEditUnit && <button className="icon-btn" title="Üniteyi sil" aria-label="Üniteyi sil" onClick={() => setConfirm({ text: `${u.number}. ünite silinsin mi? İçindeki setler silinmez.`, ok: async () => { await api.deleteUnit(u.id); data.reload(); } })}>🗑</button>}
                </div>
              </header>
              {list.length ? <ul className="set-list">{list.map((s) => <SetRow key={s.id} s={s} user={user} onCopied={() => data.reload()} />)}</ul>
                : <p className="muted small unit-empty">Bu ünitede set yok. Yukarıdan kelime ya da soru seti oluştur.</p>}
            </section>
          );
        })}
        {loose.length > 0 && (
          <section className="unit">
            <header className="unit-head"><h2>Ünitesi seçilmemiş setler</h2></header>
            <ul className="set-list">{loose.map((s) => <SetRow key={s.id} s={s} user={user} onCopied={() => data.reload()} />)}</ul>
          </section>
        )}
      </div>

      {editBook && <BookModal book={book} onClose={() => setEditBook(false)} onSaved={() => data.reload()} />}
      {unitModal && <UnitModal unit={unitModal.unit} bookId={book.id} nextNumber={nextNumber} onClose={() => setUnitModal(null)} onSaved={() => data.reload()} />}
      {confirm && <Confirm text={confirm.text} onOk={confirm.ok} onClose={() => setConfirm(null)} />}
    </div>
  );
}
