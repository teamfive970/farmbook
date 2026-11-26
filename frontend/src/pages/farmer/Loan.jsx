import { Ban, Check, Copy, Eye, HandCoins, Link2, Loader2, Share2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SpeakButton, useSpeakOnOpen } from "../../components/Voice.jsx";
import { Button, ErrorBanner, PageHeader, TextInput } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { passportBase } from "../../lib/passportLink.js";
import { WORDS } from "../../lib/words.js";

const DAYS = [
  { value: 7, label: "1 week" },
  { value: 30, label: "1 month" },
  { value: 90, label: "3 months" }
];

const STATUS = {
  active: ["Working", "bg-emerald-100 text-emerald-800"],
  expired: ["Finished", "bg-slate-100 text-slate-700"],
  stopped: ["Stopped", "bg-rose-100 text-rose-800"]
};

export const creditUrl = (code) => `${passportBase()}/credit/${encodeURIComponent(code)}`;

// "Show my record to a lender": a private link to a summary of the last
// 12 months, for a loan from a micro-finance group, bank, VSLA or cooperative.
export default function Loan() {
  const { token } = useAuth();
  const { online } = useSync();
  const toast = useToast();
  const [shares, setShares] = useState(null);
  const [lenderName, setLenderName] = useState("");
  const [includeContact, setIncludeContact] = useState(true);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(null);
  useSpeakOnOpen(WORDS.loanTitle);

  const load = useCallback(async () => {
    if (!online || !token) return;
    try {
      const result = await api.get("/api/credit-shares", { token });
      setShares(result.shares);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [online, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post("/api/credit-shares", { lenderName: lenderName.trim() || undefined, includeContact, days }, { token });
      setFresh(result.share);
      setLenderName("");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function stop(share) {
    try {
      await api.post(`/api/credit-shares/${share.id}/stop`, undefined, { token });
      if (fresh?.id === share.id) setFresh(null);
      toast.success("The link is stopped. Nobody can open it now.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function shareLink(share) {
    const url = creditUrl(share.code);
    const text = `My FarmBok farm record: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My FarmBok farm record", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Paste it in a message to the lender.");
    } catch {
      // The farmer closed the share sheet.
    }
  }

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-3xl">
      <PageHeader
        title={WORDS.loanTitle.text}
        subtitle="Show a lender how your farm is doing, from your own records."
        say={WORDS.loanTitle}
        backTo="/app/money"
      />

      <section className="rounded-2xl bg-white p-5 shadow-card" data-say="A lender can see your money in and out for the last twelve months, your harvests and sales, and how well you keep records. Only people with the link can see it, and you can stop it any time.">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <HandCoins size={22} aria-hidden="true" />
          </span>
          <div className="flex-1 text-sm leading-relaxed text-ink">
            <p className="font-bold">What the lender sees</p>
            <p className="text-ink-soft">
              Money in and out for each of the last 12 months, your harvests and sales, quality checks, your farmer group,
              and how regularly you keep records. Not your PIN, not each record.
            </p>
          </div>
          <SpeakButton phrase={{ say: "A lender can see your money in and out for the last twelve months, your harvests and sales, and how well you keep records. Only people with the link can see it, and you can stop it any time." }} className="h-9 w-9" />
        </div>
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
          <ShieldCheck size={16} aria-hidden="true" /> Only people with the link can open it. You can stop it any time.
        </p>
      </section>

      {!online && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Making a link needs network.</p>}
      <ErrorBanner message={error} />

      <form onSubmit={create} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-base font-bold text-ink">Make a link for a lender</h2>
        <label className="block" htmlFor="lender-name">
          <span className="label">Who is it for? (you can leave it)</span>
          <TextInput id="lender-name" value={lenderName} maxLength={80} placeholder="For example: LEAP, my VSLA, LBDI" onChange={(event) => setLenderName(event.target.value)} />
        </label>
        <div>
          <p className="label">How long can they open it?</p>
          <div className="grid grid-cols-3 gap-2">
            {DAYS.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={days === choice.value}
                onClick={() => setDays(choice.value)}
                className={`min-h-12 rounded-xl border-2 text-sm font-bold ${days === choice.value ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white text-ink"}`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-canvas p-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={includeContact} onChange={(event) => setIncludeContact(event.target.checked)} />
          <span className="text-sm">
            <span className="block font-bold text-ink">Show my full name and phone number</span>
            <span className="block text-ink-soft">Lenders usually need these to give a loan. If off, they see your first name and county only.</span>
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={busy || !online}>
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />} Make the link
        </Button>
      </form>

      {fresh && (
        <section className="rounded-2xl border-2 border-primary bg-primary-soft p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-primary-dark">
            <Check size={18} aria-hidden="true" /> Your link is ready. Send it to the lender.
          </p>
          <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-sm text-ink">{creditUrl(fresh.code)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => shareLink(fresh)}>
              <Share2 size={16} aria-hidden="true" /> Send
            </Button>
            <a href={creditUrl(fresh.code)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-white text-sm font-bold text-ink">
              <Eye size={16} aria-hidden="true" /> See what they see
            </a>
          </div>
        </section>
      )}

      {shares?.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-ink">My links</h2>
          <ul className="space-y-2">
            {shares.map((share) => {
              const [label, tone] = STATUS[share.status];
              return (
                <li key={share.id} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{share.lenderName || "Lender link"}</p>
                      <p className="text-xs text-ink-soft">
                        Made {formatDate(share.createdAt)} · {share.status === "active" ? `works until ${formatDate(share.expiresAt)}` : label.toLowerCase()} ·{" "}
                        {share.includeContact ? "name and phone shown" : "first name only"}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        Opened {share.viewCount} {share.viewCount === 1 ? "time" : "times"}
                        {share.lastViewedAt ? `, last on ${formatDate(share.lastViewedAt)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>
                  </div>
                  {share.status === "active" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => shareLink(share)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-line px-3 text-sm font-bold text-ink">
                        <Copy size={15} aria-hidden="true" /> Send again
                      </button>
                      <button type="button" onClick={() => stop(share)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-rose-200 px-3 text-sm font-bold text-rose-700">
                        <Ban size={15} aria-hidden="true" /> Stop this link
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
