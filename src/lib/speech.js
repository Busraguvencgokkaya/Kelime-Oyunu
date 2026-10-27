// Tarayıcının kendi Türkçe sesiyle sesli okuma (internet ya da ses dosyası gerekmez).
import { useEffect, useState } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

function trVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  return voices.find((v) => /^tr(-|_|$)/i.test(v.lang)) || null;
}

export function useTurkishVoice() {
  const [ok, setOk] = useState(() => !!trVoice());
  useEffect(() => {
    if (!synth) return;
    const f = () => setOk(!!trVoice());
    f();
    synth.addEventListener?.('voiceschanged', f);
    return () => synth.removeEventListener?.('voiceschanged', f);
  }, []);
  return ok;
}

// Köşeli parantezli dil bilgisi notlarını okuma, ayraçları duraklamaya çevir
export function speakable(text = '') {
  return text.replace(/\[[^\]]*\]/g, '').replace(/\s+\/\s+/g, ', ').replace(/\s+—\s+/g, '. ').replace(/\.\.\./g, '').trim();
}

export function speak(text) {
  const v = trVoice();
  if (!synth || !v || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.85;
  synth.speak(u);
}

export function stopSpeaking() { synth?.cancel(); }
