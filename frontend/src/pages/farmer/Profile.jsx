import {
  CloudUpload,
  KeyRound,
  UserPlus,
  Users,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  ShieldQuestion,
  Sprout,
  Volume2
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  Select,
  TextInput
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { formatPhone, initials } from "../../lib/format.js";
import { SECURITY_QUESTIONS } from "../../lib/labels.js";
import { api } from "../../lib/api.js";
import { rememberOfflineLogin } from "../../lib/offlineAuth.js";
import { VoiceToggle } from "../../components/Voice.jsx";
import { WORDS } from "../../lib/words.js";

const EMPTY_PIN = { currentPin: "", newPin: "", confirmPin: "" };
const EMPTY_RECOVERY = { currentPin: "", securityQuestion: "", securityAnswer: "" };

export default function Profile() {
  const { user, token, logout, setUser, lock } = useAuth();
  const { online, pendingCount, syncing } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const pendingAccount = Boolean(user.pendingRegistration);

  const [pinOpen, setPinOpen] = useState(false);
  const [pinForm, setPinForm] = useState(EMPTY_PIN);
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState(EMPTY_RECOVERY);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleChangePin(event) {
    event.preventDefault();
    setPinError("");
    if (!/^\d{4,6}$/.test(pinForm.currentPin)) {
      return setPinError("Enter your current PIN.");
    }
    if (!/^\d{4,6}$/.test(pinForm.newPin)) {
      return setPinError("Your new PIN must be 4 to 6 digits.");
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      return setPinError("The new PIN and confirmation do not match.");
    }
    setPinBusy(true);
    try {
      await api.post("/api/auth/pin", pinForm, { token });
      rememberOfflineLogin(user.phoneNumber, pinForm.newPin, user).catch(() => {});
      toast.success("Your PIN has been updated.");
      setPinOpen(false);
      setPinForm(EMPTY_PIN);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinBusy(false);
    }
  }

  async function handleSaveRecovery(event) {
    event.preventDefault();
    setRecoveryError("");
    if (!/^\d{4,6}$/.test(recoveryForm.currentPin)) {
      return setRecoveryError("Enter your current PIN.");
    }
    if (!recoveryForm.securityQuestion) {
      return setRecoveryError("Choose a recovery question.");
    }
    if (!recoveryForm.securityAnswer.trim()) {
      return setRecoveryError("Enter an answer for your recovery question.");
    }
    setRecoveryBusy(true);
    try {
      await api.post(
        "/api/auth/recovery/setup",
        { ...recoveryForm, securityAnswer: recoveryForm.securityAnswer.trim() },
        { token }
      );
      setUser({ ...user, hasSecurityQuestion: true });
      toast.success("Your recovery question has been saved.");
      setRecoveryOpen(false);
      setRecoveryForm(EMPTY_RECOVERY);
    } catch (error) {
      setRecoveryError(error.message);
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await logout();
    // Other people on this phone (or this person, to come back offline).
    navigate("/who", { replace: true });
  }

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
      <PageHeader className="lg:col-span-12" title={WORDS.navMe.text} subtitle="Your name, your PIN and how the app work." say={WORDS.navMe} />

      <div
        className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-white p-4 shadow-card lg:col-span-5"
        data-say={WORDS.voiceSwitch.say}
      >
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Volume2 size={18} className="text-primary" aria-hidden="true" /> {WORDS.voiceSwitch.text}
          </p>
          <p className="text-xs text-ink-soft">
            The phone will say the words when you touch them.
          </p>
        </div>
        <VoiceToggle compact />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card lg:col-span-7">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-ink">{user.fullName}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
              <Phone size={13} /> {formatPhone(user.phoneNumber)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
              <MapPin size={13} /> {user.community}, {user.district}, {user.county}
            </p>
          </div>
        </div>
      </div>

      {pendingAccount && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 lg:col-span-12">
          <p className="text-sm font-bold text-amber-900">Account not sent yet</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
            Your account and work are saved on this phone. Enter your PIN when you have
            network to send them.
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-amber-900 shadow-card hover:bg-amber-100"
          >
            <KeyRound size={16} /> Send my account
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:col-span-6">
        <button
          type="button"
          onClick={() => {
            lock();
            navigate("/who");
          }}
          data-say={WORDS.switchPerson.say}
          className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 text-sm font-bold text-ink shadow-card"
        >
          <Users size={24} className="text-primary" aria-hidden="true" />
          {WORDS.switchPerson.text}
        </button>
        <button
          type="button"
          onClick={() => {
            lock();
            navigate("/login", { state: { addPerson: true } });
          }}
          data-say={WORDS.addPerson.say}
          className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 text-sm font-bold text-ink shadow-card"
        >
          <UserPlus size={24} className="text-primary" aria-hidden="true" />
          {WORDS.addPerson.text}
        </button>
      </div>

      <Link
        to="/app/sync"
        className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card lg:col-span-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CloudUpload size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">My work on the phone</p>
            <p className="text-xs text-ink-soft">
              {!online
                ? "Network not there — your work on this phone"
                : pendingCount > 0
                  ? `${pendingCount} still on your phone`
                  : "All gone on the internet"}
            </p>
          </div>
        </div>
        {syncing && <span className="text-xs font-semibold text-sky-600">Syncing…</span>}
      </Link>

      <section className="rounded-2xl bg-white p-5 shadow-card lg:col-span-4">
        <h2 className="text-sm font-bold text-ink">Account security</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {pendingAccount
            ? "Send your account first. After that you can change your PIN."
            : "Your PIN keeps your farm records private. Change it if you think someone else knows it."}
        </p>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={pendingAccount}
          onClick={() => setPinOpen(true)}
        >
          <KeyRound size={16} /> Change my PIN
        </Button>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card lg:col-span-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldQuestion size={16} className="text-primary" /> PIN recovery
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          {pendingAccount
            ? "Send your account first. After that you can add a recovery question."
            : user.hasSecurityQuestion
              ? "Your recovery question is set. You can use it to reset your PIN if you ever forget it."
              : "Add a recovery question so you can reset your PIN yourself instead of asking an administrator."}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          When text message recovery is switched on, a code can also be sent to{" "}
          {formatPhone(user.phoneNumber)}.
        </p>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={pendingAccount}
          onClick={() => {
            setRecoveryForm(EMPTY_RECOVERY);
            setRecoveryError("");
            setRecoveryOpen(true);
          }}
        >
          <ShieldQuestion size={16} />
          {user.hasSecurityQuestion ? "Change recovery question" : "Add recovery question"}
        </Button>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card lg:col-span-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldCheck size={16} className="text-primary" /> About FarmBok
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          FarmBok helps smallholder farmers keep simple farm records. Records are saved on this
          phone first, then synced to your account when you have internet.
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
          <Sprout size={14} className="text-primary" /> Version 1.0 · Core MVP
        </p>
      </section>

      <Button
        variant="secondary"
        className="w-full text-danger lg:col-span-12"
        onClick={() => setConfirmSignOut(true)}
      >
        <LogOut size={16} /> Sign out
      </Button>

      <Modal
        open={pinOpen}
        title="Change your PIN"
        onClose={() => {
          setPinOpen(false);
          setPinError("");
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePin} loading={pinBusy}>
              Save new PIN
            </Button>
          </>
        }
      >
        <form onSubmit={handleChangePin} className="space-y-4">
          <ErrorBanner message={pinError} />
          <Field label="Current PIN" htmlFor="currentPin">
            <TextInput
              id="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pinForm.currentPin}
              onChange={(event) =>
                setPinForm((current) => ({
                  ...current,
                  currentPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                }))
              }
            />
          </Field>
          <Field label="New PIN" htmlFor="newPin" hint="4 to 6 numbers.">
            <TextInput
              id="newPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pinForm.newPin}
              onChange={(event) =>
                setPinForm((current) => ({
                  ...current,
                  newPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                }))
              }
            />
          </Field>
          <Field label="Confirm new PIN" htmlFor="confirmPin">
            <TextInput
              id="confirmPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pinForm.confirmPin}
              onChange={(event) =>
                setPinForm((current) => ({
                  ...current,
                  confirmPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                }))
              }
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={recoveryOpen}
        title="Recovery question"
        onClose={() => {
          setRecoveryOpen(false);
          setRecoveryError("");
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecoveryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecovery} loading={recoveryBusy}>
              Save question
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveRecovery} className="space-y-4">
          <ErrorBanner message={recoveryError} />
          <Field
            label="Recovery question"
            htmlFor="recoveryQuestion"
            hint="Pick something only you would know."
          >
            <Select
              id="recoveryQuestion"
              value={recoveryForm.securityQuestion}
              onChange={(event) =>
                setRecoveryForm((current) => ({
                  ...current,
                  securityQuestion: event.target.value
                }))
              }
            >
              <option value="">Choose a question</option>
              {SECURITY_QUESTIONS.map((question) => (
                <option key={question.key} value={question.key}>
                  {question.text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Your answer" htmlFor="recoveryAnswer">
            <TextInput
              id="recoveryAnswer"
              value={recoveryForm.securityAnswer}
              onChange={(event) =>
                setRecoveryForm((current) => ({ ...current, securityAnswer: event.target.value }))
              }
              placeholder="Type your answer"
              autoComplete="off"
            />
          </Field>
          <Field label="Current PIN" htmlFor="recoveryPin">
            <TextInput
              id="recoveryPin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={recoveryForm.currentPin}
              onChange={(event) =>
                setRecoveryForm((current) => ({
                  ...current,
                  currentPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                }))
              }
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of FarmBok?"
        message="Your records stay safe. You will need your phone number and PIN to sign in again."
        confirmLabel="Sign out"
        busy={signingOut}
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
