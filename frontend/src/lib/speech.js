// "Talk to me": speaks short words and phrases out loud, like TalkBack, for
// farmers who do not read. Works offline:
//   1. If a recorded clip exists for the phrase (public/audio/manifest.json),
//      it is played. Clips can be recorded in Liberian English or in a local
//      language (Kpelle, Bassa, …) by a real speaker — the best experience.
//   2. Otherwise the phone's own text-to-speech voice reads the phrase. We
//      prefer a West African English voice when the phone has one, speak
//      slowly, and use simple Liberian English wording.

import { ACTIVE_LANGUAGE } from "./i18nState.js";

const ENABLED_KEY = "minders.voice";

// Closest available accents first. Phones rarely have a Liberian voice, but
// Nigerian or Ghanaian English sounds much closer than American English.
const PREFERRED_LANGS = ["en-LR", "en-NG", "en-GH", "en-SL", "en-KE", "en-ZA", "en-GB", "en-US"];

let manifestPromise = null;
let currentAudio = null;
let cachedVoice = null;

export function voiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function voiceEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === "on";
  } catch {
    return false;
  }
}

export function setVoiceEnabled(on) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "on" : "off");
  } catch {
    // Private mode or full storage: the switch still works for this visit.
  }
}

function pickVoice() {
  if (!voiceSupported()) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  for (const lang of PREFERRED_LANGS) {
    const exact = voices.find((voice) => voice.lang?.replace("_", "-").toLowerCase() === lang.toLowerCase());
    if (exact) {
      cachedVoice = exact;
      return exact;
    }
  }
  cachedVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) || null;
  return cachedVoice;
}

if (voiceSupported()) {
  // Voices load late on Android; refresh the choice when they arrive.
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = null;
  });
}

// Clips for the chosen language (public/audio/<language>/manifest.json) come
// first, then the shared clips (public/audio/manifest.json).
function readClips(url, folder) {
  return fetch(url)
    .then((response) => (response.ok ? response.json() : { clips: {} }))
    .then((data) =>
      Object.fromEntries(Object.entries(data?.clips || {}).map(([key, file]) => [key, folder ? `${folder}/${file}` : file]))
    )
    .catch(() => ({}));
}

function loadManifest() {
  if (!manifestPromise) {
    const code = ACTIVE_LANGUAGE.code;
    manifestPromise = Promise.all([
      readClips("/audio/manifest.json", ""),
      code === "en" ? Promise.resolve({}) : readClips(`/audio/${code}/manifest.json`, code)
    ]).then(([shared, local]) => ({ ...shared, ...local }));
  }
  return manifestPromise;
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (voiceSupported()) window.speechSynthesis.cancel();
}

function speakWithTts(text) {
  if (!voiceSupported() || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en";
  }
  utterance.rate = 0.85;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

// Speaks a phrase. `key` (optional) looks up a recorded clip first.
export async function speak(text, key) {
  const words = String(text || "").trim();
  if (!words && !key) return;
  stopSpeaking();
  if (key) {
    const clips = await loadManifest();
    const file = clips[key];
    if (file) {
      try {
        const audio = new Audio(`/audio/${file}`);
        currentAudio = audio;
        await audio.play();
        return;
      } catch {
        currentAudio = null;
      }
    }
  }
  speakWithTts(words);
}

// Spread onto any element: <button {...sayProps(WORDS.save)}>. With "Talk to
// me" on, tapping the element speaks the phrase.
export function sayProps(phrase) {
  if (!phrase) return {};
  if (typeof phrase === "string") return { "data-say": phrase };
  return {
    "data-say": phrase.say || phrase.text || "",
    ...(phrase.key ? { "data-say-key": phrase.key } : {})
  };
}
