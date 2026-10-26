// Bayraklar SVG olarak çizilir (Windows'ta bayrak emojileri görünmediği için).

export function Flag({ code, size = 64 }) {
  const h = Math.round(size * 0.6);
  if (code === 'ru') return (
    <svg width={size} height={h} viewBox="0 0 9 6" aria-hidden="true" className="flag">
      <rect width="9" height="2" fill="#fff" /><rect y="2" width="9" height="2" fill="#0039a6" /><rect y="4" width="9" height="2" fill="#d52b1e" />
    </svg>
  );
  if (code === 'en') return (
    <svg width={size} height={h} viewBox="0 0 60 36" aria-hidden="true" className="flag">
      <clipPath id="uk-c"><rect width="60" height="36" /></clipPath>
      <g clipPath="url(#uk-c)">
        <rect width="60" height="36" fill="#012169" />
        <path d="M0,0 60,36 M60,0 0,36" stroke="#fff" strokeWidth="7.2" />
        <path d="M0,0 60,36 M60,0 0,36" stroke="#C8102E" strokeWidth="2.4" />
        <path d="M30,0 v36 M0,18 h60" stroke="#fff" strokeWidth="12" />
        <path d="M30,0 v36 M0,18 h60" stroke="#C8102E" strokeWidth="7.2" />
      </g>
    </svg>
  );
  if (code === 'ky') {
    // Kırgızistan: kırmızı zemin, 40 ışınlı güneş ve tündük
    const rays = [];
    for (let i = 0; i < 40; i++) {
      const a = (i * 9 * Math.PI) / 180;
      const a1 = a - 0.07, a2 = a + 0.07;
      const r1 = 7.4, r2 = 12.4;
      rays.push(`M${(25 + r1 * Math.cos(a1)).toFixed(2)},${(15 + r1 * Math.sin(a1)).toFixed(2)} L${(25 + r2 * Math.cos(a)).toFixed(2)},${(15 + r2 * Math.sin(a)).toFixed(2)} L${(25 + r1 * Math.cos(a2)).toFixed(2)},${(15 + r1 * Math.sin(a2)).toFixed(2)}Z`);
    }
    return (
      <svg width={size} height={h} viewBox="0 0 50 30" aria-hidden="true" className="flag">
        <rect width="50" height="30" fill="#e8112d" />
        <path d={rays.join(' ')} fill="#ffef00" />
        <circle cx="25" cy="15" r="7.6" fill="#ffef00" />
        <circle cx="25" cy="15" r="5.2" fill="#e8112d" />
        <circle cx="25" cy="15" r="4.3" fill="#ffef00" />
        <g fill="none" stroke="#e8112d" strokeWidth="0.75">
          <path d="M21.6,12.4 Q25,15 21.6,17.6" /><path d="M23.3,11.1 Q26,15 23.3,18.9" /><path d="M25,10.7 Q27.2,15 25,19.3" />
          <path d="M28.4,12.4 Q25,15 28.4,17.6" /><path d="M26.7,11.1 Q24,15 26.7,18.9" /><path d="M25,10.7 Q22.8,15 25,19.3" />
        </g>
      </svg>
    );
  }
  return null;
}
