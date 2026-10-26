// Supabase bağlantı bilgileri. "Publishable" anahtar herkese açık olabilir;
// veriyi veritabanındaki güvenlik kuralları (RLS) korur.
export const SUPABASE_URL = 'https://pqovlmsqzfvwupfqlghd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_6Etgovtazrw1YPS1Let-IA_426OAF12';

export const LANGS = {
  en: { code: 'en', label: 'English', tr: 'İngilizce' },
  ky: { code: 'ky', label: 'Кыргызча', tr: 'Kırgızca' },
  ru: { code: 'ru', label: 'Русский', tr: 'Rusça' },
};
export const LANG_ORDER = ['en', 'ky', 'ru'];

export const GAMES = {
  test: { id: 'test', name: 'Test', desc: 'Klasik çoktan seçmeli, ilerleme çubuğuyla.', timeLabel: 'Toplam süre (dakika, 0 = süresiz)', timeUnit: 'min', defaultTime: 10 },
  quiz: { id: 'quiz', name: 'Quiz Show', desc: 'Geri sayım, hız bonusu, 50:50 ve ek süre hakkı, sesler.', timeLabel: 'Soru başına süre (saniye)', timeUnit: 'sec', defaultTime: 20 },
};
