import {
  ArrowLeft,
  CloudOff,
  KeyRound,
  MessageSquareText,
  ShieldQuestion
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { Button, ErrorBanner, Field, Select, TextInput } from "../components/ui.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { api } from "../lib/api.js";
import { firstName } from "../lib/format.js";
import { SECURITY_QUESTIONS } from "../lib/labels.js";
import { rememberOfflineLogin } from "../lib/offlineAuth.js";

const TABS = [
  { key: "question", label: "Security question", Icon: ShieldQuestion },
  { key: "sms", label: "Text message", Icon: MessageSquareText }
];

function PinFields({ pin, confirmPin, onChange, showHint = false }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="New PIN" htmlFor="newPin" hint={showHint ? "4 to 6 numbers." : undefined}>
        <TextInput
          id="newPin"
          type="password"
          value={pin}
          onChange={(event) => onChange("newPin", event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          className="tracking-[0.3em]"
        />
      </Field>
      <Field label="Confirm new PIN" htmlFor="confirmPin">
        <TextInput
          id="confirmPin"
          type="password"
          value={confirmPin}
          onChange={(event) =>
            onChange("confirmPin", event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="••••"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          className="tracking-[0.3em]"
        />
      </Field>
    </div>
  );
}

export default function ForgotPin() {
  const { establishSession } = useAuth();
  const { online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState("question");
  const [questions, setQuestions] = useState(SECURITY_QUESTIONS);
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [form, setForm] = useState({
    identifier: "",
    securityQuestion: "",
    securityAnswer: "",
    newPin: "",
    confirmPin: "",
    code: ""
  });
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/api/auth/recovery/options")
      .then((result) => {
        if (!active) return;
        if (Array.isArray(result.questions) && result.questions.length > 0) {
          setQuestions(result.questions);
        }
        setSmsAvailable(Boolean(result.smsAvailable));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function updateValue(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function finish(result) {
    rememberOfflineLogin(result.user.phoneNumber || form.identifier, form.newPin, result.user).catch(
      () => {}
    );
    establishSession(result.token, result.user);
    toast.success(`Welcome back, ${firstName(result.user.displayName || result.user.fullName)}.`);
    navigate(result.user.role === "admin" ? "/admin" : "/app", { replace: true });
  }

  function validateNewPin() {
    if (!/^\d{4,6}$/.test(form.newPin)) {
      setError("Your new PIN must be 4 to 6 digits.");
      return false;
    }
    if (form.newPin !== form.confirmPin) {
      setError("The new PIN and confirmation do not match.");
      return false;
    }
    return true;
  }

  async function handleQuestionSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.identifier.trim()) return setError("Enter your phone number or access code.");
    if (!form.securityQuestion) return setError("Choose your recovery question.");
    if (!form.securityAnswer.trim()) return setError("Enter your answer.");
    if (!validateNewPin()) return;

    setBusy(true);
    try {
      const result = await api.post("/api/auth/recovery/security-question", {
        identifier: form.identifier.trim(),
        securityQuestion: form.securityQuestion,
        securityAnswer: form.securityAnswer,
        newPin: form.newPin,
        confirmPin: form.confirmPin
      });
      finish(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendCode(event) {
    event?.preventDefault();
    setError("");
    if (!form.identifier.trim()) return setError("Enter your phone number or access code.");

    setSending(true);
    try {
      const result = await api.post("/api/auth/recovery/sms/request", {
        identifier: form.identifier.trim()
      });
      setCodeSent(true);
      setResendIn(60);
      toast.info(result.message || "If SMS recovery is available, a code has been sent.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    setError("");
    if (!form.identifier.trim()) return setError("Enter your phone number or access code.");
    if (!/^\d{6}$/.test(form.code)) return setError("Enter the 6 digit code from the SMS.");
    if (!validateNewPin()) return;

    setBusy(true);
    try {
      const result = await api.post("/api/auth/recovery/sms/verify", {
        identifier: form.identifier.trim(),
        code: form.code,
        newPin: form.newPin,
        confirmPin: form.confirmPin
      });
      finish(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const smsDisabled = !online || !smsAvailable;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <Brand to="/" />
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary"
          >
            <ArrowLeft size={16} /> Sign in
          </Link>
        </div>

        <div className="mt-10">
          <h1 className="text-2xl font-bold text-ink">Recover your account</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Forgot your PIN? Choose a way to prove it is your account, then set a new PIN.
          </p>
        </div>

        {!online && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-800">
            <CloudOff size={17} className="mt-0.5 shrink-0" />
            You are offline. Connect to the internet to recover your PIN, or ask an administrator
            to reset it for you.
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-white p-1.5 shadow-card">
          {TABS.map(({ key, label, Icon }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTab(key);
                  setError("");
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${
                  selected ? "bg-primary text-white shadow-sm" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>

        {tab === "question" ? (
          <form onSubmit={handleQuestionSubmit} className="mt-5 space-y-4" noValidate>
            <ErrorBanner message={error} />
            <Field
              label="Phone number or access code"
              htmlFor="identifier"
              hint="Use the number or access code you sign in with."
            >
              <TextInput
                id="identifier"
                value={form.identifier}
                onChange={update("identifier")}
                placeholder="e.g. 077 123 4567"
                autoComplete="username"
                autoCapitalize="none"
              />
            </Field>
            <Field label="Your recovery question" htmlFor="securityQuestion">
              <Select
                id="securityQuestion"
                value={form.securityQuestion}
                onChange={update("securityQuestion")}
              >
                <option value="">Choose your question</option>
                {questions.map((question) => (
                  <option key={question.key} value={question.key}>
                    {question.text}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Your answer"
              htmlFor="securityAnswer"
              hint="Capital letters and extra spaces do not matter."
            >
              <TextInput
                id="securityAnswer"
                value={form.securityAnswer}
                onChange={update("securityAnswer")}
                placeholder="Type the answer you saved"
                autoComplete="off"
              />
            </Field>
            <PinFields
              pin={form.newPin}
              confirmPin={form.confirmPin}
              onChange={updateValue}
              showHint
            />
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!online}>
              <KeyRound size={17} /> Set new PIN and sign in
            </Button>
            <p className="text-center text-xs leading-relaxed text-ink-soft">
              You told us this answer when you created your account. If you never set one, use text
              message recovery or ask an administrator for help.
            </p>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <ErrorBanner message={error} />

            {!smsAvailable && (
              <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
                Text message recovery is not switched on for this app yet. Use your security
                question, or ask an administrator to reset your PIN.
              </div>
            )}

            <form onSubmit={handleSendCode} className="space-y-4" noValidate>
              <Field
                label="Phone number or access code"
                htmlFor="smsIdentifier"
                hint="We send the code to the phone number on the account."
              >
                <TextInput
                  id="smsIdentifier"
                  value={form.identifier}
                  onChange={update("identifier")}
                  placeholder="e.g. 077 123 4567"
                  inputMode="tel"
                  autoComplete="username"
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
                loading={sending}
                disabled={smsDisabled || resendIn > 0}
              >
                <MessageSquareText size={17} />
                {codeSent
                  ? resendIn > 0
                    ? `Send again in ${resendIn}s`
                    : "Send a new code"
                  : "Send me a code"}
              </Button>
            </form>

            {codeSent && (
              <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
                <Field label="6 digit code" htmlFor="code">
                  <TextInput
                    id="code"
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value.replace(/\D/g, "").slice(0, 6)
                      }))
                    }
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="tracking-[0.4em]"
                  />
                </Field>
                <PinFields pin={form.newPin} confirmPin={form.confirmPin} onChange={updateValue} />
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  <KeyRound size={17} /> Set new PIN and sign in
                </Button>
                <p className="text-center text-xs text-ink-soft">
                  The code expires after 10 minutes.
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
