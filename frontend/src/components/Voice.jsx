import { Check, Delete, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { useVoice } from "../contexts/VoiceContext.jsx";
import { speak } from "../lib/speech.js";
import { WORDS, digitWord } from "../lib/words.js";

// The "Talk to me" switch. Big, with a speaker picture, so a farmer who cannot
// read can find it. Turning it on makes the phone speak whatever is touched.
export function VoiceToggle({ compact = false, className = "" }) {
  const { enabled, supported, toggle } = useVoice();
  if (!supported) return null;
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      data-voice-toggle
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? WORDS.voiceOn.text : WORDS.voiceOff.text}
      onClick={toggle}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-3 font-bold transition ${
        enabled
          ? "border-primary bg-primary text-white"
          : "border-line bg-white text-ink hover:border-primary/40"
      } ${compact ? "text-xs" : "text-sm"} ${className}`}
    >
      <Icon size={compact ? 18 : 20} aria-hidden="true" />
      {!compact && <span>{WORDS.voiceSwitch.text}</span>}
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-white/40" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            enabled ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

// A speaker button that always reads its phrase, even with the switch off, so
// anyone can hear a page's instructions on purpose.
export function SpeakButton({ phrase, className = "", label = WORDS.hearThis.text }) {
  if (!phrase) return null;
  return (
    <button
      type="button"
      data-voice-toggle
      aria-label={label}
      onClick={() => speak(phrase.say || phrase.text || phrase, phrase.key)}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark hover:bg-primary hover:text-white ${className}`}
    >
      <Volume2 size={20} aria-hidden="true" />
    </button>
  );
}

// Reads the page's instruction once when it opens, if "Talk to me" is on.
export function useSpeakOnOpen(phrase) {
  const { enabled, say } = useVoice();
  useEffect(() => {
    if (!enabled || !phrase) return undefined;
    const timer = window.setTimeout(() => say(phrase), 250);
    return () => window.clearTimeout(timer);
    // Speak once per page, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phrase?.key, phrase?.say]);
}

// Big number keys so phone numbers and PINs never need the phone keyboard.
// With "Talk to me" on, each key says its number.
// `onDot` adds a "." key (for cents, used with US dollars).
export function NumberPad({ onDigit, onDelete, onDot, disabled = false }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const keyClass =
    "flex h-16 items-center justify-center rounded-2xl border-2 border-line bg-white text-2xl font-bold text-ink shadow-sm active:bg-primary-soft disabled:opacity-50";
  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Number keys">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className={keyClass}
          disabled={disabled}
          data-say={digitWord(key)}
          onClick={() => onDigit(key)}
        >
          {key}
        </button>
      ))}
      {onDot ? (
        <button type="button" className={keyClass} disabled={disabled} data-say="point" aria-label="Point" onClick={onDot}>
          .
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <button
        type="button"
        className={keyClass}
        disabled={disabled}
        data-say={digitWord("0")}
        onClick={() => onDigit("0")}
      >
        0
      </button>
      <button
        type="button"
        className={keyClass}
        disabled={disabled}
        aria-label={WORDS.deleteDigit.text}
        data-say={WORDS.deleteDigit.say}
        onClick={onDelete}
      >
        <Delete size={26} aria-hidden="true" />
      </button>
    </div>
  );
}

// Picture chip used for choices (crops, inputs, short sentences). The
// picture is an icon from the app's one icon set (see lib/icons.js).
// `showCheck` puts a tick on chosen chips, for lists where several can be chosen.
export function PictureChip({ item, selected, onClick, size = "md", showCheck = false }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-say={item.say}
      data-say-key={item.key}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 text-center transition ${
        size === "lg" ? "min-h-24 py-2" : "min-h-20 py-1.5"
      } ${
        selected
          ? "border-primary bg-primary-soft shadow-sm"
          : "border-line bg-white hover:border-primary/40"
      }`}
    >
      {showCheck && selected ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check size={13} strokeWidth={3} aria-hidden="true" />
        </span>
      ) : null}
      {item.Icon ? (
        <item.Icon
          size={size === "lg" ? 34 : 28}
          strokeWidth={1.75}
          aria-hidden="true"
          className={selected ? "text-primary-dark" : "text-ink-soft"}
        />
      ) : null}
      <span className="text-xs font-bold leading-tight text-ink">{item.text}</span>
    </button>
  );
}
