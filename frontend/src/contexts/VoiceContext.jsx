import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setVoiceEnabled, speak, stopSpeaking, voiceEnabled, voiceSupported } from "../lib/speech.js";
import { WORDS } from "../lib/words.js";

const VoiceContext = createContext(null);

// Reads the words for whatever the farmer touches, like TalkBack:
//  * an element (or its parent) with data-say speaks that phrase, in simple
//    Liberian English;
//  * otherwise a button, link or label speaks its aria-label or visible text.
// Tapping still does its normal job (select, open, save) at the same time.
function phraseFor(target) {
  if (!(target instanceof Element)) return null;
  const tagged = target.closest("[data-say]");
  if (tagged) {
    return { text: tagged.getAttribute("data-say"), key: tagged.getAttribute("data-say-key") };
  }
  const control = target.closest("button, a, label, [role='button'], summary");
  if (!control) return null;
  const text = control.getAttribute("aria-label") || control.textContent || "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean && clean.length <= 120 ? { text: clean } : null;
}

export function VoiceProvider({ children }) {
  const [enabled, setEnabled] = useState(() => voiceSupported() && voiceEnabled());

  const say = useCallback(
    (phrase) => {
      if (!enabled || !phrase) return;
      if (typeof phrase === "string") speak(phrase);
      else speak(phrase.say || phrase.text, phrase.key);
    },
    [enabled]
  );

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      setVoiceEnabled(next);
      if (next) speak(WORDS.voiceOn.say, WORDS.voiceOn.key);
      else stopSpeaking();
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onTap = (event) => {
      // The switch announces itself.
      if (event.target instanceof Element && event.target.closest("[data-voice-toggle]")) return;
      const phrase = phraseFor(event.target);
      if (phrase?.text || phrase?.key) speak(phrase.text, phrase.key || undefined);
    };
    document.addEventListener("click", onTap, true);
    return () => document.removeEventListener("click", onTap, true);
  }, [enabled]);

  const value = useMemo(
    () => ({ enabled, supported: voiceSupported(), toggle, say }),
    [enabled, toggle, say]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) throw new Error("useVoice must be used inside VoiceProvider");
  return context;
}
