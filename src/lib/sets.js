import { api } from '../api/index.js';

export async function copySet(id) {
  const s = await api.getSet(id);
  const items = s.items.map(({ id: _i, set_id, created_at, ...rest }) => rest);
  return api.saveSet({ ...s, id: null, title: `${s.title} (kopya)`, is_public: false }, items);
}

export const KIND_LABEL = { words: 'Kelime seti', questions: 'Soru seti' };
