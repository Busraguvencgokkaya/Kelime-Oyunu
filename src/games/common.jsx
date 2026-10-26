// Oyunların ortak parçaları

export function sizeClass(text = '') {
  const n = text.length;
  return n > 60 ? 'len-xl' : n > 34 ? 'len-l' : n > 18 ? 'len-m' : 'len-s';
}

export function Prompt({ q }) {
  return (
    <div className={`prompt ${q.image ? 'has-img' : ''}`}>
      {q.image && <img className="prompt-img" src={q.image} alt="" />}
      {q.prompt && <div className={`prompt-text ${sizeClass(q.prompt)}`} lang={q.promptLang === 'ky' ? 'ky' : q.promptLang === 'ru' ? 'ru' : q.promptLang === 'en' ? 'en' : 'tr'}>{q.prompt}</div>}
      {q.hint && <div className="prompt-hint">{q.hint}</div>}
    </div>
  );
}

export function OptionContent({ o }) {
  return <>
    {o.image && <img src={o.image} alt="" className="opt-img" />}
    {o.text && <span className={`opt-text ${sizeClass(o.text)}`}>{o.text}</span>}
  </>;
}

export function answerRecord(q, chosen, ms) {
  return {
    item_id: q.item_id,
    prompt: q.prompt || '(resim)',
    correct: q.correctText,
    given: chosen ? (chosen.text || '(resim)') : '',
    ok: !!chosen?.correct,
    ms: Math.round(ms),
    dir: q.dir,
  };
}

export const SHAPES = ['▲', '◆', '●', '■'];
