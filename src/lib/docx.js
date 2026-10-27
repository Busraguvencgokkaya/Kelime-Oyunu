// Word (.docx) kelime sözlüğünü okur: ünite ve konu başlıkları, tablolar ve tablodaki görseller.
// Beklenen biçim: "1. ÜNİTE: AD" ya da "BAŞLANGIÇ ÜNİTESİ: AD" satırları, ardından konu başlıkları
// ve [GÖRSEL] | TÜRKÇE | ENGLISH | КЫРГЫЗЧА | РУССКИЙ sütunlu tablolar.

import JSZip from 'jszip';

const W = (el, name) => [...el.children].filter((c) => c.nodeName === name);
// Başlıklar İngilizce ya da Rusça da olabilir: "ENGLISH" Türkçe kurala göre "englısh" olmasın diye ı → i
const norm = (s) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[\s.:()]/g, '');

function paraText(p) {
  let out = '';
  p.querySelectorAll('*').forEach((n) => {
    if (n.nodeName === 'w:t') out += n.textContent;
    else if (n.nodeName === 'w:tab') out += '\t';
    else if (n.nodeName === 'w:br' || n.nodeName === 'w:cr') out += '\n';
  });
  return out;
}
function cellText(tc) {
  return W(tc, 'w:p').map(paraText).join('\n').trim();
}

const COLS = {
  img: ['görsel', 'gorsel', 'resim', 'image', 'picture', 'foto'],
  tr: ['türkçe', 'turkce', 'turkish'],
  en: ['english', 'ingilizce', 'i̇ngilizce'],
  ky: ['кыргызча', 'kırgızca', 'kirgizca', 'kyrgyz'],
  ru: ['русский', 'rusça', 'rusca', 'russian'],
};

export function titleCaseTr(s) {
  return s.split(/(\s+)/).map((w) => w.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, pre, first, rest) => pre + first.toLocaleUpperCase('tr') + rest.toLocaleLowerCase('tr'))).join('')
    .replace(/(^|\s)Ve(\s)/g, '$1ve$2');
}

export async function parseDocx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('Bu bir Word dosyası değil gibi görünüyor.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
  const rels = {};
  if (relsXml) {
    const rd = new DOMParser().parseFromString(relsXml, 'application/xml');
    [...rd.getElementsByTagName('Relationship')].forEach((r) => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  }
  const imgCache = {};
  async function loadImage(rid) {
    const target = rels[rid];
    if (!target) return null;
    const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
    if (imgCache[path]) return imgCache[path];
    const f = zip.file(path);
    if (!f) return null;
    const ext = path.split('.').pop().toLowerCase();
    const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext];
    if (!type) return null; // emf/wmf gibi tarayıcının açamadığı biçimler
    const blob = new Blob([await f.async('uint8array')], { type });
    imgCache[path] = { blob, key: path, preview: URL.createObjectURL(blob) };
    return imgCache[path];
  }

  const body = doc.getElementsByTagName('w:body')[0];
  let bookGuess = '';
  let unit = { number: 1, title: '' };
  let topic = '';
  const rows = [];
  let skipped = 0;

  for (const el of [...body.children]) {
    if (el.nodeName === 'w:p') {
      for (let line of paraText(el).split('\n')) {
        line = line.trim();
        if (!line) continue;
        if (/^MAARİF/i.test(line) || /SÖZLÜĞ/i.test(line)) {
          if (!bookGuess) {
            bookGuess = titleCaseTr(line.replace(/GÖRSELLİ/gi, '').replace(/KELİME SÖZLÜĞÜM?/gi, '').replace(/\s+/g, ' ').trim());
          }
          continue;
        }
        let m = line.match(/^(\d+)\.\s*ÜNİTE\s*:\s*(.+)$/i);
        if (m) { unit = { number: Number(m[1]), title: titleCaseTr(m[2].trim()) }; topic = ''; continue; }
        m = line.match(/^BAŞLANGIÇ ÜNİTESİ\s*:?\s*(.*)$/i);
        if (m) { unit = { number: 0, title: m[1] ? `Başlangıç Ünitesi: ${titleCaseTr(m[1].trim())}` : 'Başlangıç Ünitesi' }; topic = ''; continue; }
        if (/Ders Kitabı|defterine|^Görsel \+|^Türkçe \+/i.test(line)) continue;
        topic = line.replace(/\s*\(\d+\)\s*$/, '').trim();
      }
    } else if (el.nodeName === 'w:tbl') {
      const trs = W(el, 'w:tr');
      if (!trs.length) continue;
      const head = W(trs[0], 'w:tc').map((tc) => norm(cellText(tc)));
      const map = {};
      head.forEach((h, i) => {
        for (const [k, names] of Object.entries(COLS)) if (map[k] === undefined && names.some((n) => norm(n) === h)) map[k] = i;
      });
      let start = 1;
      if (map.tr === undefined) {
        start = 0;
        const n = head.length;
        Object.assign(map, n >= 5 ? { img: 0, tr: 1, en: 2, ky: 3, ru: 4 } : { tr: 0, en: 1, ky: 2, ru: 3 });
      }
      for (const tr of trs.slice(start)) {
        const tcs = W(tr, 'w:tc');
        const get = (k) => (map[k] !== undefined && tcs[map[k]] ? cellText(tcs[map[k]]) : '');
        const row = { tr: get('tr'), en: get('en'), ky: get('ky'), ru: get('ru'), topic, unit: unit.number === 0 ? `0. ${unit.title}` : `${unit.number}. Ünite: ${unit.title}`, img: null };
        if (!row.tr) { skipped++; continue; }
        const imgCell = map.img !== undefined ? tcs[map.img] : null;
        const blip = imgCell && [...imgCell.getElementsByTagName('a:blip')][0];
        if (blip) row.img = await loadImage(blip.getAttribute('r:embed'));
        rows.push(row);
      }
    }
  }
  return { rows, header: true, skipped, docx: true, bookGuess, images: rows.filter((r) => r.img).length };
}
