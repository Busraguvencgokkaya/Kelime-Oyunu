import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { copyText, studentLink } from '../lib/util.js';
import { useToast } from './ui.jsx';

export function useQr(text, size = 480) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: '#10303d', light: '#ffffff' } }).then(setUrl).catch(() => setUrl(null));
  }, [text, size]);
  return url;
}

export default function LinkBox({ slug, title }) {
  const link = studentLink(slug);
  const qr = useQr(link);
  const [board, setBoard] = useState(false);
  const toast = useToast();
  return (
    <div className="linkbox">
      <div className="linkbox-main">
        <span className="field-label">Öğrenci bağlantısı</span>
        <div className="linkbox-row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Öğrenci bağlantısı" />
          <button className="btn btn-primary" onClick={async () => { if (await copyText(link)) toast('Bağlantı kopyalandı.'); }}>Kopyala</button>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => setBoard(true)}>Tahtada QR göster</button>
          <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer">Öğrenci gibi aç</a>
        </div>
      </div>
      {qr && <img className="linkbox-qr" src={qr} alt="Bağlantının QR kodu" />}
      {board && (
        <div className="qr-board" onClick={() => setBoard(false)} role="dialog" aria-label="QR kod">
          <h2>{title}</h2>
          {qr && <img src={qr} alt="QR kod" />}
          <p className="qr-board-link">{link.replace(/^https?:\/\//, '')}</p>
          <p className="qr-board-hint">Telefonunla okut, adını yaz, başla!</p>
          <button className="btn btn-light">Kapat</button>
        </div>
      )}
    </div>
  );
}
