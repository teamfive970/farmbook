import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  MapPin,
  Phone,
  ShieldQuestion,
  UserRound
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { StepIndicator } from "../components/FormSteps.jsx";
import { Button, ErrorBanner, Field, Select, TextInput } from "../components/ui.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { firstName } from "../lib/format.js";
import { COUNTIES, SECURITY_QUESTIONS } from "../lib/labels.js";

const EMPTY = {
  fullName: "",
  phoneNumber: "",
  county: "",
  district: "",
  community: "",
  pin: "",
  confirmPin: "",
  securityQuestion: "",
  securityAnswer: ""
};

const STEPS = ["Your details", "Where you farm", "Secure your account"];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function validateStep(index) {
    if (index === 0) {
      if (form.fullName.trim().length < 2) return "Enter your full name.";
      if (!form.phoneNumber.trim()) return "Enter your phone number.";
    }
    if (index === 1) {
      if (!form.county) return "Choose your county.";
      if (!form.district.trim()) return "Enter your district.";
      if (!form.community.trim()) return "Enter your community.";
    }
    if (index === 2) {
      if (!/^\d{4,6}$/.test(form.pin)) return "Your PIN must be 4 to 6 digits.";
      if (form.pin !== form.confirmPin) return "The PIN and confirmation do not match.";
      if (form.securityQuestion && !form.securityAnswer.trim()) {
        return "Enter an answer for your recovery question.";
      }
    }
    return "";
  }

  function goToStep(nextStep) {
    setError("");
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (step < STEPS.length - 1) {
      const message = validateStep(step);
      if (message) return setError(message);
      goToStep(step + 1);
      return;
    }

    for (let index = 0; index < STEPS.length; index += 1) {
      const message = validateStep(index);
      if (message) {
        setError(message);
        setStep(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setBusy(true);
    try {
      const user = await register({
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        county: form.county,
        district: form.district.trim(),
        community: form.community.trim(),
        pin: form.pin,
        confirmPin: form.confirmPin,
        ...(form.securityQuestion
          ? {
              securityQuestion: form.securityQuestion,
              securityAnswer: form.securityAnswer.trim()
            }
          : {})
      });
      toast.success(`Welcome to Minders, ${firstName(user.fullName)}.`);
      navigate("/app", { replace: true });
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
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary"
          >
            <ArrowLeft size={16} /> Sign in
          </Link>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-bold text-ink">Create your account</h1>
          <p className="mt-2 text-sm text-ink-soft">
            It only takes a minute. You can start recording your farm work right away.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <StepIndicator step={step} steps={STEPS} />
          <ErrorBanner message={error} />

          {step === 0 && (
            <>
              <Field label="Full name" htmlFor="fullName">
                <div className="relative">
                  <UserRound
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    aria-hidden="true"
                  />
                  <TextInput
                    id="fullName"
                    value={form.fullName}
                    onChange={update("fullName")}
                    placeholder="e.g. James Kollie"
                    autoComplete="name"
                    className="pl-11"
                  />
                </div>
              </Field>

              <Field
                label="Phone number"
                htmlFor="phoneNumber"
                hint="Use the number you can always reach."
              >
                <div className="relative">
                  <Phone
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    aria-hidden="true"
                  />
                  <TextInput
                    id="phoneNumber"
                    value={form.phoneNumber}
                    onChange={update("phoneNumber")}
                    placeholder="e.g. 077 123 4567"
                    inputMode="tel"
                    autoComplete="tel"
                    className="pl-11"
                  />
                </div>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="County" htmlFor="county">
                <div className="relative">
                  <MapPin
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    aria-hidden="true"
                  />
                  <Select
                    id="county"
                    value={form.county}
                    onChange={update("county")}
                    className="pl-11 pr-10"
                  >
                    <option value="">Choose your county</option>
                    {COUNTIES.map((county) => (
                      <option key={county} value={county}>
                        {county}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>

              <Field label="District" htmlFor="district">
                <TextInput
                  id="district"
                  value={form.district}
                  onChange={update("district")}
                  placeholder="e.g. Gbarnga"
                />
              </Field>

              <Field label="Community" htmlFor="community">
                <TextInput
                  id="community"
                  value={form.community}
                  onChange={update("community")}
                  placeholder="e.g. Kpelleh Town"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <LockKeyhole size={16} className="text-primary" /> Create your PIN
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Choose 4 to 6 numbers you will remember. You will use it to sign in.
                </p>
                <div className="mt-3 space-y-3">
                  <Field label="PIN" htmlFor="pin">
                    <div className="relative">
                      <TextInput
                        id="pin"
                        type={showPin ? "text" : "password"}
                        value={form.pin}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pin: event.target.value.replace(/\D/g, "").slice(0, 6)
                          }))
                        }
                        placeholder="••••"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={6}
                        className="pr-11 tracking-[0.3em]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((value) => !value)}
                        aria-label={showPin ? "Hide PIN" : "Show PIN"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-soft hover:bg-canvas"
                      >
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm PIN" htmlFor="confirmPin">
                    <TextInput
                      id="confirmPin"
                      type={showPin ? "text" : "password"}
                      value={form.confirmPin}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          confirmPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                        }))
                      }
                      placeholder="••••"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      className="tracking-[0.3em]"
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldQuestion size={16} className="text-primary" /> Recovery question
                  <span className="text-[11px] font-medium text-ink-soft">Optional</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  If you forget your PIN, this question helps you get back into your account.
                </p>
                <div className="mt-3 space-y-3">
                  <Field label="Choose a question" htmlFor="securityQuestion">
                    <Select
                      id="securityQuestion"
                      value={form.securityQuestion}
                      onChange={update("securityQuestion")}
                    >
                      <option value="">Skip for now</option>
                      {SECURITY_QUESTIONS.map((question) => (
                        <option key={question.key} value={question.key}>
                          {question.text}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {form.securityQuestion && (
                    <Field label="Your answer" htmlFor="securityAnswer">
                      <TextInput
                        id="securityAnswer"
                        value={form.securityAnswer}
                        onChange={update("securityAnswer")}
                        placeholder="Type your answer"
                        autoComplete="off"
                      />
                    </Field>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => goToStep(step - 1)}
              >
                Back
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              className={step > 0 ? "flex-1" : "w-full"}
              loading={busy}
            >
              {step === STEPS.length - 1 ? "Create account" : "Continue"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
