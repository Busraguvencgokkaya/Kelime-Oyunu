import { useState } from 'react';
import { api } from '../api/index.js';
import { Field, useToast } from '../components/ui.jsx';
import { go } from '../lib/util.js';
import { Logo } from './Shell.jsx';

export function Login() {
  const [mode, setMode] = useState('in'); // in | up | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') await api.signIn(email.trim(), password);
      else if (mode === 'up') {
        const r = await api.signUp(email.trim(), password, name.trim());
        if (r.needsConfirm) setMsg({ kind: 'ok', text: 'Hesabın açıldı. E-postana gelen bağlantıya tıklayıp hesabını onayla, sonra giriş yap.' });
      } else {
        await api.resetPassword(email.trim());
        setMsg({ kind: 'ok', text: 'Şifre yenileme bağlantısı e-postana gönderildi.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <div className="auth-side">
        <Logo />
        <h1 className="auth-title">Kelimeler oyunla akılda kalır.</h1>
        <p>Setini hazırla, bağlantıyı paylaş, sonuçları tek ekranda gör.</p>
        <div className="auth-tiles" aria-hidden="true">
          <span>merhaba</span><span>салам</span><span>hello</span><span>привет</span>
        </div>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>{mode === 'in' ? 'Öğretmen girişi' : mode === 'up' ? 'Yeni öğretmen hesabı' : 'Şifremi unuttum'}</h2>
        {mode === 'up' && (
          <Field label="Adın ve soyadın"><input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></Field>
        )}
        <Field label="E-posta"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        {mode !== 'reset' && (
          <Field label="Şifre" hint={mode === 'up' ? 'En az 6 karakter' : null}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
          </Field>
        )}
        {msg && <p className={`note note-${msg.kind}`}>{msg.text}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Bekle…' : mode === 'in' ? 'Giriş yap' : mode === 'up' ? 'Hesap aç' : 'Bağlantı gönder'}
        </button>
        <div className="auth-links">
          {mode !== 'in' && <button type="button" className="link" onClick={() => { setMode('in'); setMsg(null); }}>Giriş ekranına dön</button>}
          {mode === 'in' && <button type="button" className="link" onClick={() => { setMode('up'); setMsg(null); }}>Hesabın yok mu? Hesap aç</button>}
          {mode === 'in' && <button type="button" className="link" onClick={() => { setMode('reset'); setMsg(null); }}>Şifremi unuttum</button>}
        </div>
        <p className="auth-foot">Öğrenci misin? Öğretmeninin verdiği bağlantıyı aç; hesap gerekmez.</p>
      </form>
    </div>
  );
}

export function NewPassword() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="page-center">
      <form className="card narrow" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { await api.updatePassword(pw); toast('Yeni şifren kaydedildi.'); go('/'); }
        catch (err) { toast(err.message, 'error'); }
        finally { setBusy(false); }
      }}>
        <h2>Yeni şifre belirle</h2>
        <Field label="Yeni şifre" hint="En az 6 karakter"><input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}>Şifreyi kaydet</button>
      </form>
    </div>
  );
}
