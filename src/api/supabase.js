import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

function check({ data, error }) {
  if (error) throw new Error(trError(error.message));
  return data;
}

export function trError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-posta ya da şifre yanlış.';
  if (m.includes('email not confirmed')) return 'E-posta adresin henüz onaylanmadı. Gelen kutuna bak.';
  if (m.includes('user already registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.';
  if (m.includes('password should be at least')) return 'Şifre en az 6 karakter olmalı.';
  if (m.includes('rate limit')) return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'İnternet bağlantısı yok ya da sunucuya ulaşılamıyor.';
  if (m.includes('row-level security')) return 'Bu işlem için yetkin yok.';
  return msg;
}

const SET_COLS = 'id,owner_id,title,kind,book_id,unit_id,topic,is_public,item_count,created_at,updated_at';

export const api = {
  demo: false,

  // ---------- giriş ----------
  async getUser() {
    const { data } = await sb.auth.getSession();
    return data.session?.user ? toUser(data.session.user) : null;
  },
  onAuth(cb) {
    const { data } = sb.auth.onAuthStateChange((event, session) => cb(session?.user ? toUser(session.user) : null, event));
    return () => data.subscription.unsubscribe();
  },
  async signUp(email, password, fullName) {
    const res = check(await sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: location.origin + location.pathname },
    }));
    return { needsConfirm: !res.session };
  },
  async signIn(email, password) {
    check(await sb.auth.signInWithPassword({ email, password }));
  },
  async signOut() { await sb.auth.signOut(); },
  async resetPassword(email) {
    check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
  },
  async updatePassword(password) { check(await sb.auth.updateUser({ password })); },
  async getProfile() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return null;
    return check(await sb.from('profiles').select('*').eq('id', s.session.user.id).maybeSingle());
  },

  // ---------- kitaplar / üniteler ----------
  async listBooks() {
    return check(await sb.from('books').select('*').order('sort').order('title'));
  },
  async getBook(id) {
    return check(await sb.from('books').select('*').eq('id', id).maybeSingle());
  },
  async saveBook(b) {
    const row = { title: b.title, subtitle: b.subtitle || null, cover_url: b.cover_url || null, sort: b.sort || 0 };
    if (b.id) return check(await sb.from('books').update(row).eq('id', b.id).select().single());
    return check(await sb.from('books').insert(row).select().single());
  },
  async deleteBook(id) { check(await sb.from('books').delete().eq('id', id)); },
  async listUnits(bookId) {
    let q = sb.from('units').select('*').order('number');
    if (bookId) q = q.eq('book_id', bookId);
    return check(await q);
  },
  async saveUnit(u) {
    const row = { book_id: u.book_id, number: u.number, title: u.title || null };
    if (u.id) return check(await sb.from('units').update(row).eq('id', u.id).select().single());
    return check(await sb.from('units').insert(row).select().single());
  },
  async deleteUnit(id) { check(await sb.from('units').delete().eq('id', id)); },

  // ---------- setler ----------
  async listSets({ bookId, mine, userId } = {}) {
    let q = sb.from('sets').select(SET_COLS).order('updated_at', { ascending: false });
    if (bookId) q = q.eq('book_id', bookId);
    if (mine && userId) q = q.eq('owner_id', userId);
    return check(await q);
  },
  async getSet(id) {
    const set = check(await sb.from('sets').select(SET_COLS).eq('id', id).maybeSingle());
    if (!set) return null;
    const items = check(await sb.from('items').select('*').eq('set_id', id).order('position'));
    return { ...set, items };
  },
  async saveSet(set, items) {
    const row = {
      title: set.title, kind: set.kind, book_id: set.book_id || null, unit_id: set.unit_id || null,
      topic: set.topic || null, is_public: !!set.is_public, updated_at: new Date().toISOString(),
    };
    if (items) row.item_count = items.length;
    let saved;
    if (set.id) saved = check(await sb.from('sets').update(row).eq('id', set.id).select(SET_COLS).single());
    else saved = check(await sb.from('sets').insert(row).select(SET_COLS).single());
    if (items) {
      const rows = items.map((it, i) => itemRow(it, saved.id, i));
      const keep = rows.map((r) => r.id);
      const existing = check(await sb.from('items').select('id').eq('set_id', saved.id));
      const del = existing.map((e) => e.id).filter((id) => !keep.includes(id));
      for (let i = 0; i < del.length; i += 200) check(await sb.from('items').delete().in('id', del.slice(i, i + 200)));
      for (let i = 0; i < rows.length; i += 300) check(await sb.from('items').upsert(rows.slice(i, i + 300)));
    }
    return saved;
  },
  async deleteSet(id) { check(await sb.from('sets').delete().eq('id', id)); },

  // ---------- resim ----------
  async uploadImage(blob, folder = 'img') {
    const { data: s } = await sb.auth.getSession();
    const uid = s.session.user.id;
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    check(await sb.storage.from('images').upload(path, blob, { contentType: blob.type, upsert: false }));
    return sb.storage.from('images').getPublicUrl(path).data.publicUrl;
  },

  // ---------- ödevler ----------
  async listAssignments() {
    const rows = check(await sb.from('assignments')
      .select('id,title,class_name,game_type,kind,set_id,set_title,question_count,time_limit,due_at,is_open,slug,created_at')
      .order('created_at', { ascending: false }));
    const stats = check(await sb.rpc('my_assignment_stats'));
    const map = Object.fromEntries(stats.map((s) => [s.assignment_id, s]));
    return rows.map((r) => ({ ...r, students: Number(map[r.id]?.students || 0), attempts: Number(map[r.id]?.attempts || 0) }));
  },
  async getAssignment(id) {
    return check(await sb.from('assignments').select('*').eq('id', id).maybeSingle());
  },
  async createAssignment(a) {
    for (let tries = 0; tries < 5; tries++) {
      const { data, error } = await sb.from('assignments').insert({ ...a, slug: a.slug || makeSlug() }).select().single();
      if (!error) return data;
      if (!String(error.message).includes('duplicate')) throw new Error(trError(error.message));
      a = { ...a, slug: makeSlug() };
    }
    throw new Error('Bağlantı oluşturulamadı, tekrar dene.');
  },
  async updateAssignment(id, patch) {
    return check(await sb.from('assignments').update(patch).eq('id', id).select().single());
  },
  async deleteAssignment(id) { check(await sb.from('assignments').delete().eq('id', id)); },
  async listAttempts(assignmentId) {
    return check(await sb.from('attempts').select('*').eq('assignment_id', assignmentId).order('created_at'));
  },
  async deleteAttempt(id) { check(await sb.from('attempts').delete().eq('id', id)); },

  // ---------- öğrenci (hesapsız) ----------
  async getPublicAssignment(slug) {
    return check(await sb.rpc('get_assignment_public', { p_slug: slug }));
  },
  async submitAttempt(slug, r) {
    return check(await sb.rpc('submit_attempt', {
      p_slug: slug, p_name: r.name, p_lang: r.lang, p_score: r.score, p_max: r.max_score,
      p_correct: r.correct, p_wrong: r.wrong, p_total: r.total, p_duration: r.duration_ms, p_answers: r.answers,
    }));
  },
};

function toUser(u) {
  return { id: u.id, email: u.email, name: u.user_metadata?.full_name || u.email };
}

export function itemRow(it, setId, i) {
  return {
    id: it.id || crypto.randomUUID(), set_id: setId, position: i, topic: it.topic || null,
    tr: it.tr || null, en: it.en || null, ky: it.ky || null, ru: it.ru || null, image_url: it.image_url || null,
    prompt: it.prompt || null, prompt_image: it.prompt_image || null,
    answer: it.answer || null, answer_image: it.answer_image || null,
    wrongs: (it.wrongs || []).filter((w) => w && (w.text || w.image)),
  };
}

export function makeSlug() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const buf = crypto.getRandomValues(new Uint8Array(7));
  for (const b of buf) s += abc[b % abc.length];
  return s;
}
