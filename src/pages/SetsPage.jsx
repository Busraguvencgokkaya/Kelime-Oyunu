import { useState } from 'react';
import { api } from '../api/index.js';
import { Empty, Spinner, useAsync, useToast } from '../components/ui.jsx';
import { SetRow } from './BookPage.jsx';

export default function SetsPage({ user }) {
  const data = useAsync(async () => {
    const [sets, books] = await Promise.all([api.listSets(), api.listBooks()]);
    return { sets, books };
  }, []);
  const [tab, setTab] = useState('mine');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function shareAll(v) {
    setBusy(true);
    try { await api.setAllPublic(user.id, v); toast(v ? 'Bütün setlerin paylaşıma açıldı.' : 'Bütün setlerin paylaşımı kapatıldı.'); data.reload(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }

  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <p className="note note-error">{data.error.message}</p>;
  const { sets, books } = data.data;
  const bookName = Object.fromEntries(books.map((b) => [b.id, b.title]));
  const mineAll = sets.filter((s) => s.owner_id === user.id);
  const sharedCount = mineAll.filter((s) => s.is_public).length;
  const list = sets
    .filter((s) => (tab === 'mine' ? s.owner_id === user.id : s.owner_id !== user.id && s.is_public))
    .filter((s) => !q || `${s.title} ${s.topic || ''} ${bookName[s.book_id] || ''}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
  const groups = {};
  list.forEach((s) => { const k = bookName[s.book_id] || 'Kitapsız setler'; (groups[k] ||= []).push(s); });

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Setler</h1><p className="muted">Kelime ve soru setlerin. Bir setten istediğin kadar ödev verebilirsin.</p></div>
        <div className="row">
          <a className="btn btn-ghost" href="#/set/yeni?kind=questions">Yeni soru seti</a>
          <a className="btn btn-primary" href="#/set/yeni?kind=words">Yeni kelime seti</a>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Setlerim</button>
          <button role="tab" aria-selected={tab === 'shared'} className={tab === 'shared' ? 'on' : ''} onClick={() => setTab('shared')}>Diğer öğretmenlerin paylaştıkları</button>
        </div>
        <input className="search" type="search" placeholder="Set ara" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {tab === 'mine' && mineAll.length > 0 && (
        <div className="share-bar">
          <span>{sharedCount === mineAll.length ? 'Bütün setlerin diğer öğretmenlerle paylaşılıyor.' : `${mineAll.length} setinden ${sharedCount} tanesi paylaşılıyor.`}</span>
          <div className="row">
            {sharedCount < mineAll.length && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => shareAll(true)}>Hepsini paylaş</button>}
            {sharedCount > 0 && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => shareAll(false)}>Hepsinin paylaşımını kapat</button>}
          </div>
        </div>
      )}
      {!list.length ? (
        <Empty title={tab === 'mine' ? (q ? 'Aramaya uyan set yok' : 'Henüz setin yok') : 'Paylaşılan set yok'}>
          {tab === 'mine' ? 'Yeni bir kelime ya da soru seti oluştur veya Excel dosyasından toplu yükle.' : 'Bir öğretmen setini "herkese açık" yapınca burada görünür.'}
        </Empty>
      ) : Object.entries(groups).map(([g, ss]) => (
        <section key={g} className="unit">
          <header className="unit-head"><h2>{g}</h2></header>
          <ul className="set-list">{ss.map((s) => <SetRow key={s.id} s={s} user={user} onCopied={() => { setTab('mine'); data.reload(); }} />)}</ul>
        </section>
      ))}
    </div>
  );
}
