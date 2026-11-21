import { ClipboardCopy, Eye, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  TextInput
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { formatPhone } from "../../lib/format.js";

const EMPTY = {
  currentPin: "",
  newAccessCode: "",
  newPin: "",
  confirmPin: "",
  phoneNumber: "",
  securityQuestion: "",
  securityAnswer: ""
};

export default function AdminSettings() {
  const { user, token, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY, phoneNumber: user.phoneNumber || "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealPin, setRevealPin] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealedCode, setRevealedCode] = useState("");

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!/^\d{4,6}$/.test(form.currentPin)) return setError("Enter your current PIN.");
    const changingPin = form.newPin.length > 0;
    const changingCode = form.newAccessCode.trim().length > 0;
    const changingPhone = form.phoneNumber.trim() !== (user.phoneNumber || "");
    const settingQuestion = form.securityQuestion.length > 0;

    if (changingPin && !/^\d{6}$/.test(form.newPin)) {
      return setError("Your new PIN must be 6 digits.");
    }
    if (changingPin && form.newPin !== form.confirmPin) {
      return setError("The new PIN and confirmation do not match.");
    }
    if (settingQuestion && !form.securityAnswer.trim()) {
      return setError("Enter an answer for your recovery question.");
    }
    if (!changingPin && !changingCode && !changingPhone && !settingQuestion) {
      return setError("Choose at least one credential to update.");
    }

    setBusy(true);
    try {
      const result = await api.patch(
        "/api/admin/me/credentials",
        {
          currentPin: form.currentPin,
          ...(changingCode ? { newAccessCode: form.newAccessCode.trim() } : {}),
          ...(changingPin ? { newPin: form.newPin, confirmPin: form.confirmPin } : {}),
          ...(changingPhone ? { phoneNumber: form.phoneNumber.trim() } : {}),
          ...(settingQuestion
            ? {
                securityQuestion: form.securityQuestion,
                securityAnswer: form.securityAnswer.trim()
              }
            : {})
        },
        { token }
      );
      setUser({
        ...user,
        phoneNumber: result.admin.phoneNumber,
        hasSecurityQuestion: result.admin.hasSecurityQuestion,
        canRevealAccessCode: result.admin.canRevealAccessCode
      });
      setForm({ ...EMPTY, phoneNumber: result.admin.phoneNumber || "" });
      toast.success("Your admin credentials have been updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal(event) {
    event.preventDefault();
    setRevealError("");
    if (!/^\d{4,6}$/.test(revealPin)) return setRevealError("Enter your current PIN.");
    setRevealBusy(true);
    try {
      const result = await api.post(
        "/api/admin/me/access-code/reveal",
        { currentPin: revealPin },
        { token }
      );
      setRevealedCode(result.accessCode);
      setRevealPin("");
    } catch (requestError) {
      setRevealError(requestError.message);
    } finally {
      setRevealBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(revealedCode);
      toast.success("Access code copied.");
    } catch {
      toast.error("Could not copy. Write the code down instead.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Your administrator account and credentials."
      />

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <UserRound size={22} />
          </span>
          <div>
            <p className="font-bold text-ink">{user.displayName}</p>
            <p className="text-sm text-ink-soft">
              Administrator{user.phoneNumber ? ` · ${formatPhone(user.phoneNumber)}` : ""}
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-xs leading-relaxed text-ink-soft">
          Your access code is secret and stored securely. It can be used to sign in together with
          your PIN. Changing it does not affect your access until you sign in again.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRevealOpen(true);
              setRevealError("");
              setRevealedCode("");
              setRevealPin("");
            }}
            disabled={!user.canRevealAccessCode}
          >
            <Eye size={15} /> Show my access code
          </Button>
          {!user.canRevealAccessCode && (
            <p className="text-xs text-ink-soft">
              Set a new access code below to turn on secure viewing.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <KeyRound size={16} className="text-primary" /> Update credentials
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Enter your current PIN, then change any of the details you need.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <ErrorBanner message={error} />

          <Field label="Current PIN" htmlFor="currentPin">
            <TextInput
              id="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={form.currentPin}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currentPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                }))
              }
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="New access code"
              htmlFor="newAccessCode"
              hint="6 to 40 letters, numbers or dashes."
            >
              <TextInput
                id="newAccessCode"
                value={form.newAccessCode}
                onChange={update("newAccessCode")}
                placeholder="e.g. MND-7KQ2P9"
                autoCapitalize="characters"
              />
            </Field>
            <Field
              label="Phone number"
              htmlFor="phoneNumber"
              hint="Optional — used to send you a PIN reset code by SMS. Sign-in always uses your access code."
            >
              <TextInput
                id="phoneNumber"
                value={form.phoneNumber}
                onChange={update("phoneNumber")}
                placeholder="e.g. 077 123 4567"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="New PIN" htmlFor="newPin" hint="6 digits. Leave blank to keep your current PIN.">
              <TextInput
                id="newPin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={form.newPin}
                onChange={(event) =>
                  setForm((current) => ({
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
                value={form.confirmPin}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmPin: event.target.value.replace(/\D/g, "").slice(0, 6)
                  }))
                }
              />
            </Field>
          </div>

          <p className="rounded-xl border border-line bg-canvas/70 p-4 text-xs leading-relaxed text-ink-soft">
            Recovery questions are not used for administrator accounts because the answers can be
            guessed. If you forget your PIN, use SMS recovery with your phone number or ask another
            administrator for help.
          </p>

          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              Save credentials
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldCheck size={16} className="text-primary" /> Admin accounts
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Administrator accounts are created only by the system owners using the server
          provisioning script. There is no public admin registration.
        </p>
      </Card>

      <Modal
        open={revealOpen}
        title="Your access code"
        onClose={() => {
          setRevealOpen(false);
          setRevealedCode("");
          setRevealPin("");
        }}
        footer={
          revealedCode ? (
            <Button onClick={() => setRevealOpen(false)}>Done</Button>
          ) : undefined
        }
      >
        {revealedCode ? (
          <div>
            <p className="text-sm leading-relaxed text-ink-soft">
              Keep this private. Anyone with this code and your PIN can sign in as an
              administrator.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3">
              <code className="flex-1 break-all font-mono text-lg font-bold tracking-wider text-ink">
                {revealedCode}
              </code>
              <Button variant="secondary" size="sm" onClick={copyCode}>
                <ClipboardCopy size={15} /> Copy
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              This reveal was recorded in the security log.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReveal} className="space-y-4">
            <ErrorBanner message={revealError} />
            <Field
              label="Current PIN"
              htmlFor="revealPin"
              hint="Your PIN is required before the code is shown."
            >
              <TextInput
                id="revealPin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                value={revealPin}
                onChange={(event) =>
                  setRevealPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>
            <Button type="submit" className="w-full" loading={revealBusy}>
              <Eye size={16} /> Show access code
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
