import { ArrowLeft, Eye, EyeOff, LockKeyhole, Phone, WifiOff } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { Button, ErrorBanner, Field, TextInput } from "../components/ui.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { firstName } from "../lib/format.js";

export default function Login({ standalone = false }) {
  const { login, user, needsOnlineSignIn } = useAuth();
  const { online } = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [identifier, setIdentifier] = useState(
    needsOnlineSignIn && user?.phoneNumber ? user.phoneNumber : ""
  );
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError(standalone ? "Enter your phone number or access code." : "Enter your phone number.");
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
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <Brand to="/" />
          {standalone && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary"
            >
              <ArrowLeft size={16} /> Home
            </Link>
          )}
        </div>

        <div className="mt-10">
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {needsOnlineSignIn
              ? "Sign in again to send the records saved on this phone to your account."
              : standalone
                ? "Sign in to manage farmers and farm records."
                : "Sign in with your phone number and PIN to see your farm records."}
          </p>
        </div>

        {!standalone && (!online || needsOnlineSignIn) && (
          <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white px-4 py-3">
            <WifiOff size={17} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-ink-soft">
              {online
                ? "You are signed in on this phone only. Enter your PIN to connect your account and sync."
                : "You are offline. You can sign in with the PIN you used on this phone before."}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <ErrorBanner message={error} />
          <Field label={standalone ? "Phone number or access code" : "Phone number"} htmlFor="identifier">
            <div className="relative">
              <Phone
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <TextInput
                id="identifier"
                name="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={standalone ? "e.g. MND-7KQ2P9" : "e.g. 077 123 4567"}
                inputMode={standalone ? "text" : "tel"}
                autoComplete="username"
                autoCapitalize="none"
                className="pl-11"
              />
            </div>
          </Field>

          <Field label="PIN" htmlFor="pin" hint="Your 4 to 6 digit PIN.">
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
                className="pl-11 pr-12 tracking-[0.35em]"
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

          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Sign in
          </Button>

          <div className="text-center">
            <Link
              to="/forgot-pin"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Forgot your PIN?
            </Link>
          </div>
        </form>

        {!standalone && (
          <p className="mt-6 text-center text-sm text-ink-soft">
            New to Minders?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
