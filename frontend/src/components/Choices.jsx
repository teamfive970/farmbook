import { CalendarDays, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate, todayInputValue, yesterdayInputValue } from "../lib/format.js";
import { qrMatrix, qrSvgPath } from "../lib/qr.js";
import { WORDS } from "../lib/words.js";
import { NumberPad, PictureChip } from "./Voice.jsx";
import { TextInput } from "./ui.jsx";

// Building blocks for picture-first forms (harvest, sale, spending…).

export function Section({ title, hint, children, className = "" }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-card ${className}`}>
      {title && (
        <p className="label" data-say={title.say} data-say-key={title.key}>
          {title.text}
          {hint && <span className="font-normal text-ink-soft"> ({hint})</span>}
        </p>
      )}
      {children}
    </section>
  );
}

export function ChoiceButton({ selected, onClick, words, children, className = "" }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-say={words?.say}
      data-say-key={words?.key}
      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-bold transition ${
        selected ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white text-ink hover:border-primary/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Grid of emoji pictures. `multi` lets several be chosen.
export function PictureGrid({ items, value, onChange, multi = false, columns = 3, size = "md" }) {
  const selected = multi ? new Set(value || []) : null;
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns] || "grid-cols-3";
  return (
    <div className={`grid gap-2 ${cols}`}>
      {items.map((item) => (
        <PictureChip
          key={item.key || item.value}
          item={item}
          size={size}
          selected={multi ? selected.has(item.value) : value === item.value}
          onClick={() => {
            if (!multi) onChange(value === item.value ? null : item.value);
            else {
              const next = new Set(selected);
              if (next.has(item.value)) next.delete(item.value);
              else next.add(item.value);
              onChange([...next]);
            }
          }}
        />
      ))}
    </div>
  );
}

function dateMode(value) {
  if (!value || value === todayInputValue()) return "today";
  if (value === yesterdayInputValue()) return "yesterday";
  return "pick";
}

export function DateChoice({ value, onChange, title = WORDS.when }) {
  const [mode, setMode] = useState(() => dateMode(value));
  const choose = (next) => {
    setMode(next);
    if (next === "today") onChange(todayInputValue());
    if (next === "yesterday") onChange(yesterdayInputValue());
  };
  return (
    <Section title={{ ...title, text: title.text }}>
      <div className="grid grid-cols-3 gap-2">
        <ChoiceButton words={WORDS.today} selected={mode === "today"} onClick={() => choose("today")}>
          {WORDS.today.text}
        </ChoiceButton>
        <ChoiceButton words={WORDS.yesterday} selected={mode === "yesterday"} onClick={() => choose("yesterday")}>
          {WORDS.yesterday.text}
        </ChoiceButton>
        <ChoiceButton words={WORDS.otherDay} selected={mode === "pick"} onClick={() => choose("pick")}>
          <CalendarDays size={16} aria-hidden="true" /> {WORDS.otherDay.text}
        </ChoiceButton>
      </div>
      {mode === "pick" && (
        <div className="mt-3">
          <TextInput
            type="date"
            aria-label="Day"
            value={value}
            max={todayInputValue()}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="mt-1.5 text-sm font-semibold text-ink-soft">{formatDate(value)}</p>
        </div>
      )}
    </Section>
  );
}

// − number + with big buttons; typing is possible but never needed.
export function QuantityStepper({ value, onChange, step = 1, label = "Amount" }) {
  const change = (delta) => {
    const now = value === "" || value === null || value === undefined ? 0 : Number(value) || 0;
    const next = Math.max(0, Math.round((now + delta) * 100) / 100);
    onChange(delta < 0 && next === 0 ? "" : String(next));
  };
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => change(-step)}
        aria-label={WORDS.less.text}
        data-say={WORDS.less.say}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-white text-ink active:bg-canvas"
      >
        <Minus size={24} />
      </button>
      <TextInput
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="–"
        className="h-14 text-center text-2xl font-bold"
      />
      <button
        type="button"
        onClick={() => change(step)}
        aria-label={WORDS.more.text}
        data-say={WORDS.more.say}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-primary text-white active:bg-primary-dark"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

// Money with big number keys (whole amounts). Shows L$ or US$ in front.
export function MoneyPad({ value, onChange, currency = "LRD" }) {
  const digits = String(value || "");
  const shown = digits ? Number(digits).toLocaleString("en-US") : "0";
  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border-2 border-primary bg-white px-4 py-3 text-center font-mono text-3xl font-bold text-ink"
        aria-live="polite"
        data-say={`${shown} ${currency === "USD" ? "US dollars" : "Liberian dollars"}`}
      >
        {currency === "USD" ? "US$" : "L$"} {shown}
      </div>
      <NumberPad
        onDigit={(digit) => {
          const next = (digits + digit).replace(/^0+(?=\d)/, "").slice(0, 10);
          onChange(next);
        }}
        onDelete={() => onChange(digits.slice(0, -1))}
      />
    </div>
  );
}

export function QrCode({ text, size = 220, className = "" }) {
  const { path, size: viewBox } = useMemo(() => qrSvgPath(qrMatrix(text)), [text]);
  return (
    <svg
      role="img"
      aria-label="QR code"
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={viewBox} height={viewBox} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}
