import { api } from "./api.js";

// Browser IVR simulator: a phone call to FarmBok's voice menu without a phone
// line. The menu, PIN check and saving all run on the server, exactly as for
// a real call; this file only talks to it and handles the keypad and sound.

export const simulator = {
  info: () => api.get("/api/voice/simulator"),
  start: (body) => api.post("/api/voice/simulator/calls", body),
  press: (token, digits, step) => api.post(`/api/voice/simulator/calls/${encodeURIComponent(token)}/keys`, { digits, step }),
  end: (token) => api.post(`/api/voice/simulator/calls/${encodeURIComponent(token)}/end`),
  transcript: (token) => api.get(`/api/voice/simulator/calls/${encodeURIComponent(token)}`)
};

// What a key press does, given what the menu is waiting for.
//   expect: { kind: "choice" | "number" | "pin" | "text", numDigits, finishOnKey, maxDigits } or null
//   typed: keys typed so far for this question
// Returns { typed, send } — send is the keys to send now, or null.
export function pressKey(expect, typed, key) {
  if (!expect) return { typed: "", send: null };
  if (expect.kind === "choice") {
    // A menu: one key is the answer.
    return key === "#" || key === "*" ? { typed: "", send: null } : { typed: "", send: key };
  }
  if (key === "#") return typed ? { typed: "", send: typed } : { typed: "", send: null };
  if (key === "*") return { typed: typed.slice(0, -1), send: null }; // * rubs out the last key
  const max = expect.maxDigits || 12;
  return { typed: typed.length >= max ? typed : `${typed}${key}`, send: null };
}

// How typed keys are shown: a PIN is never shown.
export const shownKeys = (expect, typed) => (expect?.kind === "pin" ? "•".repeat(typed.length) : typed);

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// Plays the prompts one after the other: a recording when there is one,
// otherwise the browser's own voice reading the English words (a labelled
// stand-in, never presented as Kpelle or Bassa). Returns a function that stops.
export function playPrompts(prompts, { muted = false, onPrompt } = {}) {
  let stopped = false;
  let audio = null;
  const speech = typeof window !== "undefined" ? window.speechSynthesis : null;

  const playOne = (prompt) =>
    new Promise((resolve) => {
      if (stopped || muted) return resolve();
      if (prompt.audioUrl) {
        audio = new Audio(prompt.audioUrl);
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
        return;
      }
      if (!speech || typeof SpeechSynthesisUtterance === "undefined") return resolve();
      const words = new SpeechSynthesisUtterance(prompt.text);
      words.lang = "en-US";
      words.rate = 0.95;
      const english = speech.getVoices().find((voice) => /^en/i.test(voice.lang));
      if (english) words.voice = english;
      words.onend = resolve;
      words.onerror = resolve;
      speech.speak(words);
    });

  (async () => {
    for (const [index, prompt] of prompts.entries()) {
      if (stopped) break;
      onPrompt?.(index);
      await playOne(prompt);
    }
    if (!stopped) onPrompt?.(-1);
  })();

  return () => {
    stopped = true;
    if (audio) audio.pause();
    speech?.cancel();
  };
}
