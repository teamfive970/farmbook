import { ArrowLeft, Clock, Eye, EyeOff, KeyRound, LockKeyhole, Phone, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { Button, ErrorBanner, Field, TextInput } from "../components/ui.jsx";
import { NumberPad, SpeakButton, VoiceToggle, useSpeakOnOpen } from "../components/Voice.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { firstName, formatPhone, initials } from "../lib/format.js";
import { WORDS } from "../lib/words.js";

function formatWait(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

export default function Login({ standalone = false }) {
  const { login, user, needsOnlineSignIn, locked, profiles } = useAuth();
  const { online } = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Reconnecting a farmer who is already signed in on this phone: show who they
  // are and ask only for the PIN, so the phone number is never typed twice.
  const addingPerson = Boolean(location.state?.addPerson);
  const knownFarmer = Boolean(
    !standalone &&
      !addingPerson &&
      !locked &&
      needsOnlineSignIn &&
      user?.role === "farmer" &&
      user.phoneNumber
  );
  const [useOtherNumber, setUseOtherNumber] = useState(false);
  // The home page's "For testers" box opens this page with the shared code filled in.
  const [identifier, setIdentifier] = useState(
    knownFarmer ? user.phoneNumber : (standalone && location.state?.accessCode) || ""
  );
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  // Which box the number keys fill: the phone number or the PIN.
  const [target, setTarget] = useState(knownFarmer ? "pin" : "phone");
  const [now, setNow] = useState(Date.now());

  const waitSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const waiting = waitSeconds > 0;

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(0);
        setError("");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const showIdentity = knownFarmer && !useOtherNumber;
  useSpeakOnOpen(standalone ? null : showIdentity ? WORDS.enterPinToSend : WORDS.phoneNumber);

  const phoneDigits = identifier.replace(/\D/g, "");
  const phoneFull = phoneDigits.startsWith("0") ? phoneDigits.length >= 10 : phoneDigits.length >= 9;

  function pressDigit(digit) {
    setError("");
    if (target === "phone" && !showIdentity) {
      const next = (phoneDigits + digit).slice(0, phoneDigits.startsWith("231") ? 12 : 10);
      setIdentifier(next);
      const done = next.startsWith("0") ? next.length >= 10 : next.length >= 9 && !next.startsWith("2");
      if (done || next.length >= 12) setTarget("pin");
      return;
    }
    setPin((current) => (current + digit).slice(0, 6));
  }

  function pressDelete() {
    setError("");
    if (target === "phone" && !showIdentity) {
      setIdentifier(phoneDigits.slice(0, -1));
      return;
    }
    if (pin.length === 0 && !showIdentity) {
      setTarget("phone");
      return;
    }
    setPin((current) => current.slice(0, -1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (waiting) return;
    setError("");

    if (!identifier.trim()) {
      setError(standalone ? "Enter your access code." : "Enter your phone number.");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError("Enter your 4 to 6 digit PIN.");
      return;
    }
    if (standalone && !online) {
      setError("Administrator sign-in needs an internet connection.");
      return;
    }

    setBusy(true);
    try {
      const signedIn = await login(identifier.trim(), pin);
      toast.success(`Welcome back, ${firstName(signedIn.displayName || signedIn.fullName)}.`);
      const requested = location.state?.from;
      const home = signedIn.role === "admin" ? "/admin" : "/app";
      const canReturn =
        typeof requested === "string" &&
        requested.startsWith(signedIn.role === "admin" ? "/admin" : "/app");
      navigate(canReturn ? requested : home, { replace: true });
    } catch (requestError) {
      const retryAfter = Number(requestError?.details?.retryAfterSeconds);
      if (requestError?.code === "ACCOUNT_LOCKED" && retryAfter > 0) {
        setNow(Date.now());
        setLockedUntil(Date.now() + retryAfter * 1000);
        setPin("");
      }
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 py-8 lg:items-center lg:justify-center">
      <div className="mx-auto w-full max-w-md lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-x-16">
        <div className="flex items-center justify-between gap-2 lg:col-start-1 lg:row-start-1">
          <Brand to="/" />
          {!standalone && <VoiceToggle compact />}
          {(standalone || knownFarmer) && (
            <Link
              to={knownFarmer ? "/app" : "/"}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary"
            >
              <ArrowLeft size={16} /> {knownFarmer ? "Back to my records" : "Home"}
            </Link>
          )}
        </div>

        <div className="mt-10 lg:col-start-1 lg:row-start-2 lg:mt-12">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-ink lg:text-3xl">
              {standalone ? "Welcome back" : showIdentity ? WORDS.pin.text : "Enter"}
            </h1>
            {!standalone && <SpeakButton phrase={showIdentity ? WORDS.enterPinToSend : WORDS.phoneNumber} />}
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {knownFarmer
              ? user?.pendingRegistration
                ? "Your account and work are saved on this phone. Enter your PIN once so they can be sent."
                : "Your work is safe on this phone. Enter your PIN once so it can be sent."
              : standalone
                ? "Sign in with your access code and PIN."
                : "Enter your phone number, then your PIN."}
          </p>
        </div>

        {!standalone && !online && (
          <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white px-4 py-3 lg:col-start-1 lg:row-start-3">
            <WifiOff size={18} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-ink-soft">
              Network not there. You can still enter the PIN you used on this phone before.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-0" noValidate>
          {waiting ? (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-800"
            >
              <Clock size={28} className="shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold" data-say={WORDS.waitPlease.say}>{WORDS.waitPlease.text}</p>
                <p className="text-sm">
                  Please wait{" "}
                  <span className="font-mono text-base font-bold">{formatWait(waitSeconds)}</span>, then
                  try again.
                </p>
              </div>
            </div>
          ) : (
            <ErrorBanner message={error} />
          )}

          {showIdentity ? (
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                {initials(user.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-ink">{user.fullName}</p>
                <p className="text-sm text-ink-soft">{formatPhone(user.phoneNumber)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseOtherNumber(true);
                  setIdentifier("");
                  setPin("");
                  setTarget("phone");
                }}
                data-say={WORDS.notYou.say}
                className="min-h-11 text-xs font-semibold text-primary hover:underline"
              >
                {WORDS.notYou.text}
              </button>
            </div>
          ) : !standalone ? (
            <button
              type="button"
              onClick={() => setTarget("phone")}
              data-say={WORDS.phoneNumber.say}
              className={`block w-full rounded-2xl border-2 bg-white p-4 text-left shadow-card ${
                target === "phone" ? "border-primary" : "border-line"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                <Phone size={18} aria-hidden="true" /> {WORDS.phoneNumber.text}
              </span>
              <span className="mt-1 block min-h-9 font-mono text-2xl font-bold tracking-wider text-ink">
                {phoneDigits || <span className="text-ink-soft/50">077 000 0000</span>}
              </span>
              {phoneFull && <span className="sr-only">done</span>}
            </button>
          ) : (
            <Field label="Access code" htmlFor="identifier">
              <div className="relative">
                {standalone ? (
                  <KeyRound
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    aria-hidden="true"
                  />
                ) : (
                  <Phone
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    aria-hidden="true"
                  />
                )}
                <TextInput
                  id="identifier"
                  name="identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={standalone ? "e.g. MND-7KQ2P9" : "e.g. 077 123 4567"}
                  inputMode={standalone ? "text" : "tel"}
                  autoComplete="username"
                  autoCapitalize={standalone ? "characters" : "none"}
                  className="pl-11"
                />
              </div>
            </Field>
          )}

          {!standalone && (
            <>
              <button
                type="button"
                onClick={() => setTarget("pin")}
                data-say={WORDS.pin.say}
                className={`block w-full rounded-2xl border-2 bg-white p-4 text-left shadow-card ${
                  target === "pin" || showIdentity ? "border-primary" : "border-line"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                  <LockKeyhole size={18} aria-hidden="true" /> {WORDS.pin.text}
                </span>
                <span className="mt-2 flex gap-3" aria-label={`${pin.length} numbers`}>
                  {Array.from({ length: 6 }, (_, index) => (
                    <span
                      key={index}
                      className={`h-5 w-5 rounded-full border-2 ${
                        index < pin.length ? "border-primary bg-primary" : index < 4 ? "border-ink-soft/50" : "border-dashed border-line"
                      }`}
                    />
                  ))}
                </span>
              </button>
              <NumberPad onDigit={pressDigit} onDelete={pressDelete} disabled={waiting} />
            </>
          )}

          {standalone && (
          <Field label="PIN" htmlFor="pin" hint="Your admin PIN.">
            <div className="relative">
              <LockKeyhole
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <TextInput
                id="pin"
                name="pin"
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                disabled={waiting}
                autoFocus={showIdentity}
                className="pl-11 pr-12 text-xl tracking-[0.35em]"
              />
              <button
                type="button"
                onClick={() => setShowPin((value) => !value)}
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-soft hover:bg-canvas"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full text-lg"
            loading={busy}
            disabled={waiting}
            data-say={WORDS.goIn.say}
          >
            {waiting ? `Wait ${formatWait(waitSeconds)}` : standalone ? "Sign in" : WORDS.goIn.text}
          </Button>

          <div className="text-center">
            <Link
              to="/forgot-pin"
              data-say={WORDS.forgotPin.say}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              {standalone ? "Forgot your PIN?" : WORDS.forgotPin.text}
            </Link>
          </div>
        </form>

        {!standalone && !knownFarmer && profiles.length > 0 && (
          <div className="mt-6 text-center lg:col-start-2 lg:row-start-5 lg:mt-4">
            <Link
              to="/who"
              data-say={WORDS.whoIsUsing.say}
              className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
            >
              {WORDS.whoIsUsing.text}
            </Link>
          </div>
        )}

        {!standalone && !knownFarmer && (
          <p className="mt-6 text-center text-sm text-ink-soft lg:col-start-2 lg:row-start-6 lg:mt-2">
            <Link
              to="/register"
              data-say={WORDS.newAccount.say}
              className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
            >
              {WORDS.newAccount.text}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
