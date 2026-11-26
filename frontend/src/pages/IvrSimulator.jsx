import {
  ArrowLeft,
  CheckCircle2,
  Delete,
  FlaskConical,
  History,
  Mic,
  Phone,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  Volume2,
  VolumeX
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { Button, ErrorBanner, Field, Select, TextInput } from "../components/ui.jsx";
import { formatDuration, playPrompts, pressKey, shownKeys, simulator } from "../lib/ivrSimulator.js";

// Browser IVR simulator: try FarmBok's voice menu as if calling it, with no
// phone line or telephone company. The real menu runs on the server, and what
// a call saves goes into the farmer's records like a real call. Demo mode
// uses demo farmers kept apart from real records.

const KEYS = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""]
];

const STATUS = {
  idle: { label: "Ready to call", tone: "bg-white/10 text-white/80" },
  connecting: { label: "Connecting…", tone: "bg-amber-400/20 text-amber-200" },
  active: { label: "Active call", tone: "bg-emerald-400/20 text-emerald-200" },
  completed: { label: "Call completed", tone: "bg-white/15 text-white" }
};

const LANGUAGE_NAMES = { en: "English", kpelle: "Kpelle", bassa: "Bassa" };

function PromptLabel({ prompt }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {prompt.audioUrl ? (
        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">Recorded audio</span>
      ) : (
        <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
          English stand-in (computer voice)
        </span>
      )}
      {prompt.missingTranslation && (
        <span className="rounded-full bg-rose-300/20 px-2 py-0.5 text-[11px] font-semibold text-rose-100">
          Translation missing
        </span>
      )}
    </span>
  );
}

export default function IvrSimulator() {
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("demo");
  const [demoFarmerId, setDemoFarmerId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const [call, setCall] = useState(null); // last answer from the server
  const [status, setStatus] = useState("idle");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(-1);
  const [startedAt, setStartedAt] = useState(null);
  const [endedAt, setEndedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [log, setLog] = useState([]); // this call: what was said and pressed
  const [history, setHistory] = useState([]); // earlier calls in this browser tab
  const stopSound = useRef(null);

  useEffect(() => {
    simulator
      .info()
      .then((data) => {
        setInfo(data);
        if (data.demoFarmers?.[0]) setDemoFarmerId(data.demoFarmers[0].id);
        if (!data.modes.demo && data.modes.development) setMode("development");
      })
      .catch((problem) => setError(problem.message));
  }, []);

  useEffect(() => {
    if (status !== "active" && status !== "connecting") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => () => stopSound.current?.(), []);

  const speak = useCallback(
    (prompts) => {
      stopSound.current?.();
      stopSound.current = playPrompts(prompts, { muted, onPrompt: setSpeaking });
    },
    [muted]
  );

  const show = useCallback(
    (result, pressed) => {
      setCall(result);
      setTyped("");
      setLog((lines) => [
        ...lines,
        ...(pressed !== undefined ? [{ who: "caller", text: pressed.mask ? "PIN entered (hidden)" : `Pressed ${pressed.keys}` }] : []),
        { who: "farmbok", text: result.prompts.map((prompt) => prompt.text).join(" ") }
      ]);
      speak(result.prompts);
      if (result.call.status === "completed") {
        setStatus("completed");
        setEndedAt(Date.now());
      } else {
        setStatus("active");
      }
    },
    [speak]
  );

  async function startCall() {
    setError("");
    setLog([]);
    setCall(null);
    setStatus("connecting");
    const started = Date.now();
    setStartedAt(started);
    setEndedAt(null);
    try {
      const body = mode === "demo" ? { mode, demoFarmerId } : { mode, phone };
      const result = await simulator.start(body);
      show(result);
    } catch (problem) {
      setStatus("idle");
      setError(problem.message);
    }
  }

  async function send(keys) {
    if (!call || busy || status !== "active") return;
    stopSound.current?.();
    const wasPin = call.expect?.kind === "pin";
    setBusy(true);
    try {
      const result = await simulator.press(call.call.token, keys, call.call.step);
      show(result, { keys, mask: wasPin });
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  function onKey(key) {
    if (status !== "active") return;
    const next = pressKey(call?.expect, typed, key);
    setTyped(next.typed);
    if (next.send !== null) send(next.send);
  }

  // Number keys on the computer keyboard work too.
  useEffect(() => {
    const listener = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key === "Enter" ? "#" : event.key;
      if (/^[0-9*#]$/.test(key)) onKey(key);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  // Hang up (the server ends the call; the history is written below).
  async function hangUp() {
    stopSound.current?.();
    if (!call) {
      setStatus("idle");
      return;
    }
    if (status === "active") await simulator.end(call.call.token).catch(() => {});
    setStatus("completed");
    setEndedAt((value) => value || Date.now());
  }

  // Each finished call goes into the history once, with what it saved.
  const recorded = useRef(null);
  useEffect(() => {
    if (status !== "completed" || !call || recorded.current === call.call.token) return;
    const token = call.call.token;
    recorded.current = token;
    const farmer =
      mode === "demo" ? info?.demoFarmers?.find((item) => item.id === demoFarmerId)?.name || "Demo farmer" : phone;
    const entry = {
      id: token.slice(0, 8),
      at: startedAt,
      duration: (endedAt || Date.now()) - (startedAt || Date.now()),
      mode,
      farmer,
      language: LANGUAGE_NAMES[call.call.language] || call.call.language,
      saved: 0
    };
    simulator
      .transcript(token)
      .then((transcript) => ({ ...entry, saved: transcript.saved }))
      .catch(() => entry)
      .then((done) => setHistory((items) => [done, ...items].slice(0, 10)));
  }, [status, call, mode, info, demoFarmerId, phone, startedAt, endedAt]);

  function restart() {
    stopSound.current?.();
    setCall(null);
    setStatus("idle");
    setTyped("");
    setLog([]);
    setStartedAt(null);
    setEndedAt(null);
  }

  const toggleMute = () => {
    setMuted((value) => {
      if (!value) stopSound.current?.();
      return !value;
    });
  };

  const duration = startedAt ? formatDuration((endedAt || now) - startedAt) : "00:00";
  const statusInfo = STATUS[status];
  const expect = call?.expect;
  const demoFarmer = info?.demoFarmers?.find((item) => item.id === demoFarmerId);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Brand />
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
        <div className="mb-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
            <FlaskConical size={14} aria-hidden="true" /> Simulated call · no phone line is used
          </p>
          <h1 className="mt-3 text-2xl font-bold text-ink lg:text-3xl">FarmBok voice menu simulator</h1>
          <p className="mt-1 max-w-3xl text-ink-soft">
            Call FarmBok's voice menu (IVR) from your browser. It runs the real menu: choose a language, type the PIN on the
            keypad, then record farm work, a harvest or a sale, or hear your summary, weather and prices. What you save goes
            into the farmer's records like a real call.
          </p>
        </div>

        <ErrorBanner message={error} className="mb-4" />

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* The phone */}
          <section
            aria-label="Phone call"
            className="mx-auto w-full max-w-[400px] rounded-[2.5rem] bg-gradient-to-b from-[#10281c] to-[#0b1f15] p-5 text-white shadow-float"
          >
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>FarmBok voice</span>
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10"
                aria-pressed={muted}
              >
                {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                {muted ? "Sound off" : "Sound on"}
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold">F</span>
              <p className="mt-2 text-lg font-bold">FarmBok</p>
              <p className="text-xs text-white/60">Farm record assistant · voice menu</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.tone}`} role="status">
                  {statusInfo.label}
                </span>
                <span className="font-mono text-sm tabular-nums text-white/80" aria-label="Call duration">
                  {duration}
                </span>
              </div>
              {call && (
                <p className="mt-1 text-[11px] text-white/50">
                  {call.call.demo ? "Demo mode" : "Development mode"} · {LANGUAGE_NAMES[call.call.language] || "English"}
                </p>
              )}
            </div>

            {/* What FarmBok is saying */}
            <div className="mt-4 min-h-36 rounded-2xl bg-white/5 p-3" aria-live="polite">
              {!call && status !== "connecting" && (
                <p className="text-sm text-white/70">Press the green button to call FarmBok.</p>
              )}
              {status === "connecting" && <p className="text-sm text-white/70">Calling FarmBok…</p>}
              {call && (
                <ol className="space-y-2">
                  {call.prompts.map((prompt, index) => (
                    <li key={`${call.call.step}-${index}`} className={`text-sm ${speaking === index ? "text-white" : "text-white/85"}`}>
                      <span className="flex items-start gap-1.5">
                        {speaking === index && <Mic size={14} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />}
                        <span>{prompt.text}</span>
                      </span>
                      <PromptLabel prompt={prompt} />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Keys typed for a number or PIN */}
            <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-black/20 font-mono text-xl tracking-widest">
              {status === "active" && expect && expect.kind !== "choice" ? (
                <>
                  <span>{shownKeys(expect, typed) || <span className="text-sm tracking-normal text-white/40">Type, then press #</span>}</span>
                  {typed && (
                    <button type="button" onClick={() => onKey("*")} className="text-white/60 hover:text-white" aria-label="Rub out the last key">
                      <Delete size={18} aria-hidden="true" />
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm tracking-normal text-white/40">
                  {status === "active" ? "Press a key to choose" : " "}
                </span>
              )}
            </div>

            {/* Keypad */}
            <div className="mt-3 grid grid-cols-3 gap-3" role="group" aria-label="Phone keypad">
              {KEYS.map(([key, letters]) => (
                <button
                  key={key}
                  type="button"
                  disabled={status !== "active" || busy}
                  onClick={() => onKey(key)}
                  className="flex h-14 flex-col items-center justify-center rounded-full bg-white/10 text-2xl font-semibold transition hover:bg-white/20 active:bg-white/30 disabled:opacity-40"
                  aria-label={key === "#" ? "Hash" : key === "*" ? "Star" : key}
                >
                  {key}
                  {letters && <span className="text-[9px] font-medium tracking-widest text-white/50">{letters}</span>}
                </button>
              ))}
            </div>

            {/* Call buttons */}
            <div className="mt-4 flex items-center justify-center gap-4">
              {status === "active" || status === "connecting" ? (
                <button
                  type="button"
                  onClick={hangUp}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-danger shadow-lg hover:bg-red-700"
                  aria-label="End call"
                >
                  <PhoneOff size={26} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCall}
                  disabled={!info || (mode === "demo" && !demoFarmerId) || (mode === "development" && !phone)}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-success shadow-lg hover:bg-green-700 disabled:opacity-40"
                  aria-label="Start call"
                >
                  <Phone size={26} aria-hidden="true" />
                </button>
              )}
              {status === "completed" && (
                <button
                  type="button"
                  onClick={() => {
                    restart();
                    setTimeout(startCall, 0);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                  aria-label="Restart call"
                >
                  <RotateCcw size={20} aria-hidden="true" />
                </button>
              )}
            </div>
          </section>

          {/* Settings, transcript, history */}
          <div className="space-y-4">
            <section className="rounded-card bg-white p-4 shadow-card">
              <h2 className="text-lg font-bold text-ink">Who is calling</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Mode" htmlFor="sim-mode">
                  <Select
                    id="sim-mode"
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                    disabled={status === "active" || status === "connecting"}
                  >
                    {info?.modes.demo && <option value="demo">Demo (demo farmers)</option>}
                    {info?.modes.development && <option value="development">Development (test accounts)</option>}
                  </Select>
                </Field>
                {mode === "demo" ? (
                  <Field label="Demo farmer" htmlFor="sim-farmer">
                    <Select
                      id="sim-farmer"
                      value={demoFarmerId}
                      onChange={(event) => setDemoFarmerId(event.target.value)}
                      disabled={status === "active" || status === "connecting"}
                    >
                      {info?.demoFarmers.map((farmer) => (
                        <option key={farmer.id} value={farmer.id}>
                          {farmer.name} · {farmer.county}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Farmer's phone number" htmlFor="sim-phone" hint="A FarmBok account's number">
                    <TextInput
                      id="sim-phone"
                      inputMode="tel"
                      value={phone}
                      placeholder="077 000 0001"
                      onChange={(event) => setPhone(event.target.value)}
                      disabled={status === "active" || status === "connecting"}
                    />
                  </Field>
                )}
              </div>
              {mode === "demo" ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-soft p-3 text-sm text-primary-dark">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Demo PIN: <strong className="font-mono">{info?.demoPin || "…"}</strong>, then #. Demo farmers
                    {demoFarmer ? ` like ${demoFarmer.name}` : ""} are kept out of real farmer records, the Ministry dashboard
                    and market prices.
                  </span>
                </p>
              ) : (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  Development mode uses a real FarmBok account and its PIN. Records saved here are real records for that
                  farmer. Use test accounts only.
                </p>
              )}
              <p className="mt-3 text-xs text-ink-soft">
                Kpelle and Bassa can be chosen, but their prompts are not translated or recorded yet, so you hear the English
                words, clearly marked. Prompts without a recording are read by your browser's voice as an English stand-in.
                {info?.liveProvider ? " A live voice provider is set up on this server." : " No live telephone line is set up."}
              </p>
            </section>

            <section className="rounded-card bg-white p-4 shadow-card">
              <h2 className="text-lg font-bold text-ink">This call</h2>
              {log.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">What FarmBok says and the keys you press appear here.</p>
              ) : (
                <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
                  {log.map((line, index) => (
                    <li
                      key={index}
                      className={line.who === "caller" ? "ml-auto w-fit max-w-[85%] rounded-xl bg-primary px-3 py-1.5 text-white" : "max-w-[90%] rounded-xl bg-canvas px-3 py-1.5 text-ink"}
                    >
                      {line.text}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-card bg-white p-4 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <History size={18} aria-hidden="true" /> Call history
              </h2>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">Calls you make on this page are listed here.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {history.map((item) => (
                    <li key={`${item.id}-${item.at}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-semibold text-ink">{item.farmer}</span>
                        <span className="text-ink-soft">
                          {" "}
                          · {item.mode === "demo" ? "Demo" : "Development"} · {item.language} ·{" "}
                          {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 text-ink-soft">
                        <span className="font-mono tabular-nums">{formatDuration(item.duration)}</span>
                        {item.saved > 0 && (
                          <span className="inline-flex items-center gap-1 font-semibold text-success">
                            <CheckCircle2 size={14} aria-hidden="true" /> {item.saved} saved
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {status === "completed" && (
              <Button variant="secondary" onClick={restart} className="w-full sm:w-auto">
                <RotateCcw size={16} aria-hidden="true" /> New call
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
