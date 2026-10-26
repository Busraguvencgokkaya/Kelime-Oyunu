import { shuffle } from './util.js';

const clean = (s) => (s || '').trim();
const key = (s) => clean(s).toLocaleLowerCase('tr');

/**
 * Ödevin madde kopyasından oyun soruları üretir.
 * Soru: { id, item_id, prompt, promptLang, image, hint, options:[{text,image,correct}], correctText, dir }
 */
export function buildQuestions(asg, lang) {
  const items = (asg.items || []).filter((it) => (asg.kind === 'words' ? clean(it.tr) && clean(it[lang] || it.en) : clean(it.prompt) || it.prompt_image));
  const count = Math.min(asg.question_count || items.length, items.length);
  const picked = shuffle(items).slice(0, count);
  return picked.map((it, i) => (asg.kind === 'words' ? wordQuestion(it, items, lang, asg.direction, i) : textQuestion(it, items, i)));
}

function wordQuestion(it, all, lang, direction, i) {
  const L = it[lang] ? lang : 'en';
  let dir = direction === 'mixed' ? (Math.random() < 0.5 ? 'tr_to_l' : 'l_to_tr') : direction;
  if (dir === 'image') dir = it.image_url ? 'image' : 'l_to_tr';
  const toField = dir === 'tr_to_l' ? L : 'tr';
  const fromField = dir === 'tr_to_l' ? 'tr' : L;
  const correct = clean(it[toField]);
  const pool = uniqueBy(all.filter((x) => x.id !== it.id && clean(x[toField]) && key(x[toField]) !== key(correct)), (x) => key(x[toField]));
  const wrongs = pickDistractors(pool, it, toField, 3).map((x) => ({ text: clean(x[toField]), correct: false }));
  return {
    id: `${it.id}-${i}`,
    item_id: it.id,
    prompt: dir === 'image' ? '' : clean(it[fromField]),
    promptLang: dir === 'tr_to_l' ? 'tr' : dir === 'image' ? 'img' : L,
    image: it.image_url || null,
    hint: dir === 'tr_to_l' ? 'Anlamı ne?' : 'Türkçesi ne?',
    options: shuffle([{ text: correct, correct: true }, ...wrongs]),
    correctText: correct,
    dir,
  };
}

function textQuestion(it, all, i) {
  const correct = { text: clean(it.answer), image: it.answer_image || null, correct: true };
  let wrongs = (it.wrongs || []).filter((w) => clean(w.text) || w.image).map((w) => ({ text: clean(w.text), image: w.image || null, correct: false }));
  if (wrongs.length < 3) {
    const used = new Set([key(correct.text), ...wrongs.map((w) => key(w.text))]);
    const extra = shuffle(all.filter((x) => x.id !== it.id && clean(x.answer) && !used.has(key(x.answer))));
    for (const x of extra) {
      if (wrongs.length >= 3) break;
      if (used.has(key(x.answer))) continue;
      used.add(key(x.answer));
      wrongs.push({ text: clean(x.answer), image: x.answer_image || null, correct: false });
    }
  }
  return {
    id: `${it.id}-${i}`,
    item_id: it.id,
    prompt: clean(it.prompt),
    promptLang: 'tr',
    image: it.prompt_image || null,
    hint: '',
    options: shuffle([correct, ...wrongs.slice(0, 3)]),
    correctText: correct.text || '(resim)',
    dir: 'question',
  };
}

// Aynı konudaki (topic) kelimeleri çeldirici olarak öne al: daha zor ve anlamlı seçenekler.
function pickDistractors(pool, it, field, n) {
  const same = shuffle(pool.filter((x) => it.topic && x.topic === it.topic));
  const rest = shuffle(pool.filter((x) => !(it.topic && x.topic === it.topic)));
  return [...same, ...rest].slice(0, n);
}

function uniqueBy(arr, f) {
  const seen = new Set();
  return arr.filter((x) => { const k = f(x); if (seen.has(k)) return false; seen.add(k); return true; });
}
