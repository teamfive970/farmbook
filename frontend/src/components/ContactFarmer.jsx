import { CircleCheck, Handshake, LockKeyhole, Send } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api.js";
import { unitText } from "../lib/words.js";
import { Button, ErrorBanner, Field, TextInput, Textarea } from "./ui.jsx";

// "Contact this farmer": the buyer leaves their name and number for the
// farmer. The farmer's own number is not shown; the farmer decides whether to
// call back or share it.
export default function ContactFarmer({ code, crop, unit, firstName, startOpen = false, onClose }) {
  const [open, setOpen] = useState(startOpen);
  const [form, setForm] = useState({ name: "", phone: "", organization: "", quantityWanted: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post(`/api/passport/${encodeURIComponent(code)}/contact`, {
        ...form,
        quantityWanted: form.quantityWanted === "" ? undefined : Number(form.quantityWanted)
      });
      setDone(result.message);
    } catch (requestError) {
      setError(requestError.isNetworkError ? "No internet. Check your connection and try again." : requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-primary/30 bg-primary-soft p-5" role="status">
        <p className="flex items-center gap-2 text-base font-bold text-primary-dark">
          <CircleCheck size={20} aria-hidden="true" /> Request sent to {firstName}
        </p>
        <p className="mt-1 text-sm text-ink">{done}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Handshake size={20} className="text-primary" aria-hidden="true" /> Want to buy this {crop.toLowerCase()}?
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Leave your number for {firstName}. The farmer will call you back if interested.
        </p>
        <Button size="lg" className="mt-3 w-full" onClick={() => setOpen(true)}>
          <Handshake size={18} aria-hidden="true" /> Contact this farmer
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="relative space-y-3 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Handshake size={20} className="text-primary" aria-hidden="true" /> Contact {firstName}
      </h2>
      <ErrorBanner message={error} />
      <Field label="Your name" htmlFor="buyer-name">
        <TextInput id="buyer-name" value={form.name} onChange={set("name")} autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Your phone number" htmlFor="buyer-phone" hint="The farmer will call or text this number.">
        <TextInput
          id="buyer-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0770 123 456"
          value={form.phone}
          onChange={set("phone")}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company or market" htmlFor="buyer-org" hint="Optional">
          <TextInput id="buyer-org" value={form.organization} onChange={set("organization")} maxLength={80} />
        </Field>
        <Field label={`How much (${unitText(unit)})`} htmlFor="buyer-qty" hint="Optional">
          <TextInput
            id="buyer-qty"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.quantityWanted}
            onChange={set("quantityWanted")}
          />
        </Field>
      </div>
      <Field label="Message" htmlFor="buyer-message" hint="Optional, e.g. price or when you can collect">
        <Textarea id="buyer-message" rows={3} maxLength={300} value={form.message} onChange={set("message")} />
      </Field>
      {/* Left empty by people; bots fill it in. */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={set("website")}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <p className="flex items-start gap-2 text-xs text-ink-soft">
        <LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Your name and number go only to this farmer. The farmer's number stays private unless they choose to share it.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={busy}>
          <Send size={16} aria-hidden="true" /> Send to farmer
        </Button>
      </div>
    </form>
  );
}
