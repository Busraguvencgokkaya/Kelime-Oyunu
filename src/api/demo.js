// Deneme modu: veritabanı yerine tarayıcı belleği kullanır (adres sonuna ?demo eklenince).
import seedWords from './demoSeed.json';
import { itemRow, makeSlug } from './supabase.js';

const KEY = 'kelime-oyunu-demo-v1';
const USER = { id: 'demo-user', email: 'demo@ornek.com', name: 'Deneme Öğretmen' };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function seed() {
  const bookId = uid(), unitId = uid(), setId = uid(), qsetId = uid(), asgId = uid();
  const items = seedWords.map((w, i) => ({ ...itemRow(w, setId, i) }));
  const qitems = [
    { prompt: '"Kitap" kelimesinin çoğulu hangisi?', answer: 'kitaplar', wrongs: [{ text: 'kitapler' }, { text: 'kitaplır' }, { text: 'kitablar' }] },
    { prompt: 'Ben her sabah okul___ gidiyorum.', answer: 'a', wrongs: [{ text: 'e' }, { text: 'da' }, { text: 'dan' }] },
    { prompt: 'Hangisi bir renk?', answer: 'mavi', wrongs: [{ text: 'masa' }, { text: 'koşmak' }, { text: 'yarın' }] },
    { prompt: '"Günaydın" ne zaman söylenir?', answer: 'Sabah', wrongs: [{ text: 'Gece' }, { text: 'Akşam' }, { text: 'Öğlen' }] },
  ].map((q, i) => itemRow(q, qsetId, i));
  const db = {
    books: [{ id: bookId, title: 'Maarif Türkçe Ortaokul A2.1', subtitle: '7. sınıf', cover_url: null, sort: 0, created_by: USER.id, created_at: now() }],
    units: [{ id: unitId, book_id: bookId, number: 1, title: 'Yeni Arkadaşlar', created_by: USER.id, created_at: now() }],
    sets: [
      { id: setId, owner_id: USER.id, title: 'Ünite 1 kelimeleri', kind: 'words', book_id: bookId, unit_id: unitId, topic: null, is_public: false, item_count: items.length, created_at: now(), updated_at: now() },
      { id: qsetId, owner_id: USER.id, title: 'Karışık dil bilgisi', kind: 'questions', book_id: bookId, unit_id: unitId, topic: null, is_public: false, item_count: qitems.length, created_at: now(), updated_at: now() },
    ],
    items: [...items, ...qitems],
    assignments: [],
    attempts: [],
  };
  // örnek ödev + sonuçlar
  db.assignments.push({
    id: asgId, owner_id: USER.id, set_id: setId, set_title: 'Ünite 1 kelimeleri', kind: 'words', title: 'Ünite 1 – Test',
    class_name: '7-A', game_type: 'test', question_count: 10, time_limit: 600, direction: 'mixed', langs: ['en', 'ky', 'ru'],
    due_at: null, is_open: true, slug: 'deneme1', items: items.map(strip), created_at: now(),
  });
  const names = ['Aybek Toktogulov', 'Nurlan Asanov', 'Emir Kadyrov', 'Bakyt Usenov'];
  names.forEach((n, i) => {
    const tries = i === 0 ? 2 : 1;
    for (let t = 1; t <= tries; t++) {
      const answers = items.slice(0, 10).map((it, k) => {
        const ok = (k + i + t) % 4 !== 0;
        return { item_id: it.id, prompt: it.ky, correct: it.tr, given: ok ? it.tr : items[(k + 3) % items.length].tr, ok, ms: 3000 + k * 400, dir: 'l_to_tr' };
      });
      const correct = answers.filter((a) => a.ok).length;
      db.attempts.push({
        id: uid(), assignment_id: asgId, student_name: n, name_key: n.toLocaleLowerCase('tr'), lang: ['ky', 'ru', 'en', 'ky'][i],
        attempt_no: t, score: correct * 10, max_score: 100, correct, wrong: 10 - correct, total: 10,
        duration_ms: 60000 + i * 9000 - t * 5000, answers, created_at: new Date(Date.now() - (5 - i) * 3600e3 + t * 60e3).toISOString(),
      });
    }
  });
  return db;
}

function strip(it) {
  const { set_id, position, ...rest } = it;
  return rest;
}

let db;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) { db = seed(); save(); }
  return db;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* bellek dolu ya da kapalı */ }
}
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 60));

export const api = {
  demo: true,
  async getUser() { return USER; },
  onAuth() { return () => {}; },
  async signUp() { return { needsConfirm: false }; },
  async signIn() {},
  async signOut() { localStorage.removeItem(KEY); db = null; location.href = location.pathname + '?demo#/'; },
  async resetPassword() {},
  async updatePassword() {},
  async getProfile() { return { id: USER.id, email: USER.email, full_name: USER.name, is_admin: true }; },

  async listBooks() { return wait(load().books.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'tr'))); },
  async getBook(id) { return wait(load().books.find((b) => b.id === id) || null); },
  async saveBook(b) {
    const d = load();
    if (b.id) { Object.assign(d.books.find((x) => x.id === b.id), b); save(); return wait(b); }
    const nb = { ...b, id: uid(), created_by: USER.id, created_at: now(), sort: b.sort || 0 };
    d.books.push(nb); save(); return wait(nb);
  },
  async deleteBook(id) {
    const d = load();
    d.books = d.books.filter((b) => b.id !== id);
    d.units = d.units.filter((u) => u.book_id !== id);
    d.sets.forEach((s) => { if (s.book_id === id) { s.book_id = null; s.unit_id = null; } });
    save();
  },
  async listUnits(bookId) { return wait(load().units.filter((u) => !bookId || u.book_id === bookId).sort((a, b) => a.number - b.number)); },
  async saveUnit(u) {
    const d = load();
    if (u.id) { Object.assign(d.units.find((x) => x.id === u.id), u); save(); return wait(u); }
    const nu = { ...u, id: uid(), created_by: USER.id, created_at: now() };
    d.units.push(nu); save(); return wait(nu);
  },
  async deleteUnit(id) {
    const d = load();
    d.units = d.units.filter((u) => u.id !== id);
    d.sets.forEach((s) => { if (s.unit_id === id) s.unit_id = null; });
    save();
  },

  async listSets({ bookId } = {}) {
    return wait(load().sets.filter((s) => !bookId || s.book_id === bookId).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  },
  async getSet(id) {
    const d = load();
    const s = d.sets.find((x) => x.id === id);
    if (!s) return null;
    return wait({ ...s, items: d.items.filter((i) => i.set_id === id).sort((a, b) => a.position - b.position) });
  },
  async saveSet(set, items) {
    const d = load();
    let s = set.id && d.sets.find((x) => x.id === set.id);
    const base = { title: set.title, kind: set.kind, book_id: set.book_id || null, unit_id: set.unit_id || null, topic: set.topic || null, is_public: !!set.is_public, updated_at: now() };
    if (s) Object.assign(s, base);
    else { s = { ...base, id: uid(), owner_id: USER.id, created_at: now(), item_count: 0 }; d.sets.push(s); }
    if (items) {
      s.item_count = items.length;
      d.items = d.items.filter((i) => i.set_id !== s.id).concat(items.map((it, i) => itemRow(it, s.id, i)));
    }
    save();
    return wait(s);
  },
  async deleteSet(id) {
    const d = load();
    d.sets = d.sets.filter((s) => s.id !== id);
    d.items = d.items.filter((i) => i.set_id !== id);
    d.assignments.forEach((a) => { if (a.set_id === id) a.set_id = null; });
    save();
  },

  async uploadImage(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  },

  async listAssignments() {
    const d = load();
    return wait(d.assignments.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((a) => {
      const at = d.attempts.filter((t) => t.assignment_id === a.id);
      const { items, ...rest } = a;
      return { ...rest, students: new Set(at.map((t) => t.name_key)).size, attempts: at.length };
    }));
  },
  async getAssignment(id) { return wait(load().assignments.find((a) => a.id === id) || null); },
  async createAssignment(a) {
    const d = load();
    const na = { ...a, id: uid(), owner_id: USER.id, slug: makeSlug(), created_at: now(), is_open: true };
    d.assignments.push(na); save(); return wait(na);
  },
  async updateAssignment(id, patch) {
    const a = load().assignments.find((x) => x.id === id);
    Object.assign(a, patch); save(); return wait(a);
  },
  async deleteAssignment(id) {
    const d = load();
    d.assignments = d.assignments.filter((a) => a.id !== id);
    d.attempts = d.attempts.filter((t) => t.assignment_id !== id);
    save();
  },
  async listAttempts(assignmentId) {
    return wait(load().attempts.filter((t) => t.assignment_id === assignmentId).sort((a, b) => a.created_at.localeCompare(b.created_at)));
  },
  async deleteAttempt(id) {
    const d = load();
    d.attempts = d.attempts.filter((t) => t.id !== id); save();
  },

  async getPublicAssignment(slug) {
    const a = load().assignments.find((x) => x.slug === slug);
    if (!a) return { status: 'not_found' };
    if (!a.is_open) return { status: 'closed', title: a.title };
    if (a.due_at && new Date(a.due_at) < new Date()) return { status: 'expired', title: a.title };
    const { title, class_name, kind, game_type, question_count, time_limit, direction, langs, due_at, items } = a;
    return wait({ status: 'ok', title, class_name, kind, game_type, question_count, time_limit, direction, langs, due_at, items });
  },
  async submitAttempt(slug, r) {
    const d = load();
    const a = d.assignments.find((x) => x.slug === slug);
    if (!a || !a.is_open) throw new Error('Ödev kapalı');
    const key = r.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
    const n = d.attempts.filter((t) => t.assignment_id === a.id && t.name_key === key).length + 1;
    const row = { id: uid(), assignment_id: a.id, student_name: r.name.trim(), name_key: key, attempt_no: n, created_at: now(), ...r };
    delete row.name;
    d.attempts.push(row); save();
    return wait({ id: row.id, attempt_no: n });
  },
};
