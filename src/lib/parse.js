// Yapıştırılan tablo, CSV ya da Excel dosyasını satırlara çevirir.

const ALIASES = {
  book: ['kitap', 'book', 'kitapadi'],
  unit: ['unite', 'ünite', 'unit', 'uniteno'],
  topic: ['konu', 'topic', 'bolum', 'bölüm', 'kategori'],
  tr: ['turkce', 'türkçe', 'turkish', 'tr', 'kelime'],
  en: ['ingilizce', 'english', 'en', 'eng'],
  ky: ['kirgizca', 'kırgızca', 'kyrgyz', 'кыргызча', 'ky', 'kg'],
  ru: ['rusca', 'rusça', 'russian', 'русский', 'ru'],
  image: ['resim', 'gorsel', 'görsel', 'image', 'foto'],
  prompt: ['soru', 'question', 'sorumetni'],
  answer: ['dogrucevap', 'doğrucevap', 'dogru', 'doğru', 'cevap', 'answer'],
  w1: ['yanlis1', 'yanlış1', 'celdirici1', 'yanlis', 'yanlış'],
  w2: ['yanlis2', 'yanlış2', 'celdirici2'],
  w3: ['yanlis3', 'yanlış3', 'celdirici3'],
};

const POSITIONAL = {
  words: ['tr', 'en', 'ky', 'ru', 'topic'],
  bulk: ['book', 'unit', 'tr', 'en', 'ky', 'ru'],
  bulk7: ['book', 'unit', 'topic', 'tr', 'en', 'ky', 'ru'],
  questions: ['prompt', 'answer', 'w1', 'w2', 'w3'],
};

const norm = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[\s._\-:()]/g, '')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');

function headerMap(row) {
  const map = {};
  row.forEach((cell, i) => {
    const n = norm(cell);
    for (const [field, names] of Object.entries(ALIASES)) {
      if (map[field] === undefined && names.some((a) => norm(a) === n)) { map[field] = i; break; }
    }
  });
  return Object.keys(map).length >= 2 ? map : null;
}

/** grid: string[][]  mode: 'words' | 'bulk' | 'questions' */
export function gridToRows(grid, mode) {
  grid = grid.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
  if (!grid.length) return { rows: [], header: false };
  let map = headerMap(grid[0]);
  let body = grid;
  if (map) body = grid.slice(1);
  else {
    const width = Math.max(...grid.map((r) => r.length));
    const pos = mode === 'bulk' ? (width >= 7 ? POSITIONAL.bulk7 : POSITIONAL.bulk) : POSITIONAL[mode];
    map = Object.fromEntries(pos.map((f, i) => [f, i]));
  }
  const rows = body.map((r) => {
    const o = {};
    for (const [f, i] of Object.entries(map)) o[f] = r[i] ?? '';
    return o;
  });
  const filtered = rows.filter((o) => (mode === 'questions' ? o.prompt : o.tr));
  return { rows: filtered, header: body !== grid, skipped: rows.length - filtered.length };
}

export function parseText(text) {
  text = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 5).join('\n');
  const delim = sample.includes('\t') ? '\t' : (sample.split(';').length > sample.split(',').length ? ';' : ',');
  return delim === '\t' ? lines.map((l) => l.split('\t')) : parseCsv(text, delim);
}

function parseCsv(text, d) {
  const out = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1254').decode(buf);
    return parseText(text);
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const grids = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }));
  // Birden çok sayfa varsa hepsini birleştir (her sayfanın başlığı ayrı okunur).
  if (grids.length === 1) return grids[0];
  return { multi: grids };
}

export function rowsFromParsed(parsed, mode) {
  if (parsed && parsed.multi) {
    const all = parsed.multi.map((g) => gridToRows(g, mode));
    return { rows: all.flatMap((r) => r.rows), header: all.some((r) => r.header), skipped: all.reduce((s, r) => s + (r.skipped || 0), 0) };
  }
  return gridToRows(parsed, mode);
}

/** "1", "1. Ünite", "Ünite 3: Tatil" → { number, title } */
export function parseUnit(v) {
  const s = String(v || '').trim();
  const m = s.match(/(\d+)/);
  const number = m ? parseInt(m[1], 10) : 1;
  const title = s.replace(/^\D*\d+\s*\.?\s*(ünite|unite|unit)?\s*[:\-–]?\s*/i, '').trim();
  return { number, title };
}
