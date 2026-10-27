import { useState } from 'react';
import { api } from '../api/index.js';

const NAV = [
  { id: 'kitaplar', href: '#/', label: 'Kitaplar', match: ['kitaplar', 'kitap'] },
  { id: 'setler', href: '#/setler', label: 'Setlerim', match: ['setler', 'set'] },
  { id: 'odevler', href: '#/odevler', label: 'Ödevlerim', match: ['odevler', 'odev'] },
  { id: 'sinif', href: '#/sinif', label: 'Sınıfta oyna', match: ['sinif'] },
  { id: 'yukle', href: '#/yukle', label: 'Toplu yükle', match: ['yukle'] },
];

export function Logo({ small }) {
  return (
    <span className={`logo ${small ? 'logo-sm' : ''}`}>
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="10" fill="#fff" /><path d="M13 10v20M13 21l11-11M16.5 18.5 26 30" stroke="#00adb9" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /><circle cx="30" cy="11" r="3.2" fill="#ffc233" /></svg>
      </span>
      <span className="logo-text">Kelime Oyunu</span>
    </span>
  );
}

export default function Shell({ user, active, demo, children }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="shell">
      {demo && <div className="demo-bar">Deneme modu: veriler yalnız bu tarayıcıda tutulur. <a href={location.pathname}>Gerçek uygulamaya geç</a></div>}
      <header className="topbar">
        <a href="#/" className="topbar-brand"><Logo /></a>
        <button className="icon-btn menu-btn" aria-label="Menü" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        <nav className={`topnav ${menu ? 'open' : ''}`} onClick={() => setMenu(false)}>
          {NAV.map((n) => (
            <a key={n.id} href={n.href} className={n.match.includes(active) ? 'active' : ''}>{n.label}</a>
          ))}
          <span className="topnav-user" title={user.email}>{user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => api.signOut()}>Çıkış</button>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
