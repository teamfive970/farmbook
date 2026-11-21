import { ArrowLeft, Clock, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { NumberPad, SpeakButton, VoiceToggle, useSpeakOnOpen } from "../components/Voice.jsx";
import { Button, ErrorBanner } from "../components/ui.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { firstName, initials } from "../lib/format.js";
import { maskedPhone } from "../lib/profiles.js";
import { WORDS } from "../lib/words.js";

const COLORS = ["bg-primary", "bg-amber-600", "bg-sky-700", "bg-rose-700", "bg-violet-700", "bg-teal-700"];

// Shared phone: everyone saved on this phone, as big name circles. Touch your
// name, put your PIN, and only your farms and records open.
export default function WhoIsUsing() {
  const { profiles, unlockProfile, removeProfile, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [chosen, setChosen] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [removing, setRemoving] = useState(false);

  useSpeakOnOpen(chosen ? WORDS.putYourPin(firstName(chosen.user.fullName)) : WORDS.whoIsUsing);

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) setLockedUntil(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  if (profiles.length === 0) return <Navigate to="/login" replace />;

  const waitSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  function handleError(requestError) {
    const retryAfter = Number(requestError?.details?.retryAfterSeconds);
    if (requestError?.code === "ACCOUNT_LOCKED" && retryAfter > 0) {
      setNow(Date.now());
      setLockedUntil(Date.now() + retryAfter * 1000);
    }
    setError(requestError?.message || "Something went wrong.");
    setPin("");
  }

  async function submit(nextPin = pin) {
    if (!chosen || nextPin.length < 4 || busy || waitSeconds > 0) return;
    setBusy(true);
    setError("");
    try {
      if (removing) {
        await removeProfile(chosen.user.id, nextPin);
        toast.success(`${firstName(chosen.user.fullName)} is off this phone.`);
        setChosen(null);
        setRemoving(false);
        setPin("");
        return;
      }
      const signedIn = await unlockProfile(chosen.user.id, nextPin);
      toast.success(`Hello, ${firstName(signedIn.fullName)}.`);
      navigate("/app", { replace: true });
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  function pressDigit(digit) {
    setError("");
    setPin((current) => (current + digit).slice(0, 6));
  }

  if (chosen) {
    const name = firstName(chosen.user.fullName);
    const ask = WORDS.putYourPin(name);
    return (
      <div className="flex min-h-dvh flex-col bg-canvas px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setPin("");
                setError("");
                setRemoving(false);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-soft"
              data-say="Go back"
            >
              <ArrowLeft size={18} /> Back
            </button>
            <VoiceToggle compact />
          </div>

          <div className="mt-6 flex flex-col items-center text-center">
            <span
              className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white ${chosen.color}`}
            >
              {initials(chosen.user.fullName)}
            </span>
            <div className="mt-3 flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink">
                {removing ? `Take ${name} off this phone` : ask.text}
              </h1>
              <SpeakButton phrase={removing ? WORDS.removePerson : ask} />
            </div>
            {removing && (
              <p className="mt-1 text-sm text-ink-soft">
                Put {name}'s PIN. Their work stays safe on the internet.
              </p>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {waitSeconds > 0 ? (
              <div
                role="alert"
                className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-800"
                data-say={WORDS.waitPlease.say}
              >
                <Clock size={26} aria-hidden="true" />
                <p className="text-sm font-bold">
                  {WORDS.waitPlease.text} · {Math.floor(waitSeconds / 60)}:
                  {String(waitSeconds % 60).padStart(2, "0")}
                </p>
              </div>
            ) : (
              <ErrorBanner message={error} />
            )}

            <div className="flex justify-center gap-3" aria-label={`${pin.length} numbers`}>
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  key={index}
                  className={`h-5 w-5 rounded-full border-2 ${
                    index < pin.length ? "border-primary bg-primary" : index < 4 ? "border-ink-soft/50" : "border-dashed border-line"
                  }`}
                />
              ))}
            </div>

            <NumberPad
              onDigit={pressDigit}
              onDelete={() => setPin((current) => current.slice(0, -1))}
              disabled={busy || waitSeconds > 0}
            />

            <Button
              size="lg"
              className="w-full text-lg"
              variant={removing ? "danger" : "primary"}
              loading={busy}
              disabled={pin.length < 4 || waitSeconds > 0}
              onClick={() => submit()}
              data-say={removing ? WORDS.removePerson.say : WORDS.goIn.say}
            >
              {removing ? WORDS.removePerson.text : WORDS.goIn.text}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-2">
          <Brand to="/who" />
          <VoiceToggle compact />
        </div>

        <div className="mt-8 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">{WORDS.whoIsUsing.text}</h1>
          <SpeakButton phrase={WORDS.whoIsUsing} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {profiles.map((profile, index) => {
            const color = COLORS[index % COLORS.length];
            const name = firstName(profile.user.fullName);
            return (
              <div key={profile.user.id} className="relative">
                <button
                  type="button"
                  onClick={() => setChosen({ ...profile, color })}
                  data-say={`${profile.user.fullName}.`}
                  className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 bg-white p-4 shadow-card ${
                    user?.id === profile.user.id ? "border-primary" : "border-line"
                  }`}
                >
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white ${color}`}>
                    {initials(profile.user.fullName)}
                  </span>
                  <span className="text-base font-bold text-ink">{name}</span>
                  <span className="text-xs text-ink-soft">{maskedPhone(profile.user.phoneNumber)}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${WORDS.removePerson.text}: ${name}`}
                  data-say={WORDS.removePerson.say}
                  onClick={() => {
                    setRemoving(true);
                    setChosen({ ...profile, color });
                  }}
                  className="absolute right-1.5 top-1.5 rounded-full p-2 text-ink-soft hover:bg-canvas hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => navigate("/login", { state: { addPerson: true } })}
            data-say={WORDS.addPerson.say}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/50 bg-primary-soft/40 p-4 text-primary-dark"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <UserPlus size={28} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold">{WORDS.addPerson.text}</span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">
          Each person has their own PIN. Nobody can open another person's farm records.
        </p>
      </div>
    </div>
  );
}

