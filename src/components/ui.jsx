import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { api } from '../api/index.js';
import { resizeImage } from '../lib/util.js';

// ---------- bildirim (toast) ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export function Modal({ title, onClose, children, wide, footer }) {
  const ref = useRef();
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose?.();
    addEventListener('keydown', f);
    ref.current?.querySelector('input,textarea,select,button')?.focus();
    return () => removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && <button className="icon-btn" onClick={onClose} aria-label="Kapat">✕</button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ text, okText = 'Sil', onOk, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Emin misin?" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
      <button className="btn btn-danger" disabled={busy} onClick={async () => { setBusy(true); try { await onOk(); onClose(); } finally { setBusy(false); } }}>{okText}</button>
    </>}>
      <p>{text}</p>
    </Modal>
  );
}

export function Spinner({ label = 'Yükleniyor…' }) {
  return <div className="spinner-wrap"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

/** Resim seçme: küçültür, yükler, adresi döndürür. */
export function ImagePick({ value, onChange, size = 'sm', label = 'Resim', max = 800, folder = 'img' }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const input = useRef();
  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('Lütfen bir resim dosyası seç.', 'error'); return; }
    setBusy(true);
    try {
      const blob = await resizeImage(f, max);
      onChange(await api.uploadImage(blob, folder));
    } catch (err) {
      toast('Resim yüklenemedi: ' + err.message, 'error');
    } finally { setBusy(false); }
  }
  return (
    <div className={`imgpick imgpick-${size}`}>
      {value ? (
        <div className="imgpick-has">
          <img src={value} alt="" />
          <button type="button" className="imgpick-x" onClick={() => onChange(null)} aria-label="Resmi kaldır">✕</button>
        </div>
      ) : (
        <button type="button" className="imgpick-btn" onClick={() => input.current.click()} disabled={busy} title={label}>
          {busy ? <span className="spinner" /> : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v8.6l3.3-3.3a1 1 0 0 1 1.4 0l2.3 2.3 3.3-3.3a1 1 0 0 1 1.4 0L19 13.6V7H5Zm4 3.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" /></svg>}
          {size !== 'sm' && <span>{busy ? 'Yükleniyor…' : label}</span>}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try { setState({ loading: false, data: await fn(), error: null }); }
    catch (e) { setState({ loading: false, data: null, error: e }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}
