import { useState } from 'react';
import { api } from '../api/index.js';
import { Confirm, Empty, Spinner, Toggle, useAsync, useToast } from '../components/ui.jsx';
import { GAMES } from '../config.js';
import { copyText, fmtDate, studentLink } from '../lib/util.js';

export default function Assignments() {
  const data = useAsync(() => api.listAssignments(), []);
  const [cls, setCls] = useState('');
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <p className="note note-error">{data.error.message}</p>;
  const all = data.data;
  const classes = [...new Set(all.map((a) => a.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const list = all.filter((a) => !cls || a.class_name === cls);

  async function toggle(a, v) {
    data.setData((l) => l.map((x) => (x.id === a.id ? { ...x, is_open: v } : x)));
    try { await api.updateAssignment(a.id, { is_open: v }); toast(v ? 'Ödev açıldı.' : 'Ödev kapatıldı. Öğrenciler artık giremez.'); }
    catch (e) { toast(e.message, 'error'); data.reload(); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Ödevlerim</h1><p className="muted">Her bağlantı ayrı bir ödevdir. Sonuçları görmek için ödeve tıkla.</p></div>
        <a className="btn btn-primary" href="#/odev/yeni">Yeni ödev</a>
      </div>
      {classes.length > 1 && (
        <div className="chip-row filter">
          <button className={`chip ${!cls ? 'on' : ''}`} onClick={() => setCls('')}>Bütün sınıflar</button>
          {classes.map((c) => <button key={c} className={`chip ${cls === c ? 'on' : ''}`} onClick={() => setCls(c)}>{c}</button>)}
        </div>
      )}
      {!list.length ? (
        <Empty title="Henüz ödev yok" action={<a className="btn btn-primary" href="#/odev/yeni">İlk ödevi oluştur</a>}>Bir set seç, oyun türünü belirle; paylaşım bağlantısı hazır olsun.</Empty>
      ) : (
        <ul className="asg-list">
          {list.map((a) => {
            const overdue = a.due_at && new Date(a.due_at) < new Date();
            return (
              <li key={a.id} className={`asg ${!a.is_open || overdue ? 'asg-closed' : ''}`}>
                <a href={`#/odev/${a.id}`} className="asg-main">
                  <span className={`game-tag game-${a.game_type}`}>{GAMES[a.game_type]?.name}</span>
                  <strong className="asg-title">{a.title}</strong>
                  <span className="muted small">
                    {[a.class_name, fmtDate(a.created_at, false), a.due_at ? `son teslim ${fmtDate(a.due_at)}` : null].filter(Boolean).join(', ')}
                    {overdue ? ' (süresi doldu)' : ''}
                  </span>
                </a>
                <div className="asg-count"><strong>{a.students}</strong><span className="muted small">öğrenci</span></div>
                <div className="asg-actions">
                  <Toggle checked={a.is_open} onChange={(v) => toggle(a, v)} label={a.is_open ? 'Açık' : 'Kapalı'} />
                  <button className="btn btn-ghost btn-sm" onClick={async () => { if (await copyText(studentLink(a.slug))) toast('Bağlantı kopyalandı.'); }}>Bağlantıyı kopyala</button>
                  <button className="icon-btn" aria-label="Ödevi sil" title="Ödevi sil" onClick={() => setConfirm(a)}>🗑</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {confirm && <Confirm text={`"${confirm.title}" ödevi ve ${confirm.attempts} deneme sonucu kalıcı olarak silinsin mi?`} onOk={async () => { await api.deleteAssignment(confirm.id); toast('Ödev silindi.'); data.reload(); }} onClose={() => setConfirm(null)} />}
    </div>
  );
}
