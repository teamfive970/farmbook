import { Handshake, MessageSquareText, Phone, Send, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CropIcon } from "../../components/Choices.jsx";
import { SpeakButton } from "../../components/Voice.jsx";
import { Button, EmptyState, ErrorBanner, PageHeader, PageLoading } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { WORDS, unitText } from "../../lib/words.js";

const STATUS = {
  new: { label: "New", tone: "bg-primary text-white" },
  shared: { label: "Answered", tone: "bg-primary-soft text-primary-dark" },
  declined: { label: "Not now", tone: "bg-slate-100 text-slate-600" }
};

function RequestCard({ request, onAction, busy }) {
  const status = STATUS[request.status] || STATUS.new;
  const who = request.buyer.organization ? `${request.buyer.name} (${request.buyer.organization})` : request.buyer.name;
  const said = `${who} wants your ${request.crop}${request.quantityWanted ? `, ${request.quantityWanted} ${request.unit || ""}` : ""}. ${
    request.message || ""
  }`;
  return (
    <li className={`rounded-2xl bg-white p-4 shadow-card ${request.status === "new" ? "ring-2 ring-primary/30" : ""}`}>
      <div className="flex items-start gap-3">
        <CropIcon name={request.crop} size={22} />
        <div className="min-w-0 flex-1" data-say={said}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${status.tone}`}>{status.label}</span>
            <span className="text-xs text-ink-soft">{formatDate(request.createdAt)}</span>
          </div>
          <p className="mt-1 text-base font-bold text-ink">{who}</p>
          <p className="text-sm text-ink-soft">
            Wants your{" "}
            {request.harvestClientId ? (
              <Link to={`/app/harvests/${encodeURIComponent(request.harvestClientId)}`} className="font-semibold text-primary">
                {request.crop}
              </Link>
            ) : (
              request.crop
            )}
            {request.quantityWanted ? ` · ${request.quantityWanted} ${unitText(request.unit)}` : ""}
          </p>
          {request.message && (
            <p className="mt-2 rounded-xl bg-canvas px-3 py-2 text-sm text-ink">“{request.message}”</p>
          )}
          <p className="mt-2 font-mono text-sm font-semibold text-ink">{request.buyer.phoneDisplay}</p>
        </div>
        <SpeakButton phrase={{ say: said }} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`tel:${request.buyer.phone}`}
          onClick={() => onAction(request, "called")}
          data-say={WORDS.requestCall.say}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-white"
        >
          <Phone size={18} aria-hidden="true" /> {WORDS.requestCall.text}
        </a>
        <a
          href={`sms:${request.buyer.phone}`}
          onClick={() => onAction(request, "called")}
          data-say="Send this buyer a text message."
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-white px-3 text-sm font-bold text-ink"
        >
          <MessageSquareText size={18} aria-hidden="true" /> Text
        </a>
        {request.status !== "shared" && (
          <Button variant="secondary" disabled={busy} onClick={() => onAction(request, "share")} data-say={WORDS.requestShare.say}>
            <Send size={16} aria-hidden="true" /> {WORDS.requestShare.text}
          </Button>
        )}
        {request.status === "new" && (
          <Button variant="ghost" disabled={busy} onClick={() => onAction(request, "decline")} data-say={WORDS.requestDecline.say}>
            <X size={16} aria-hidden="true" /> {WORDS.requestDecline.text}
          </Button>
        )}
      </div>
    </li>
  );
}

// "Buyer requests": buyers who scanned a Harvest Passport and left their
// number. The farmer calls back, shares their own number, or says not now.
export default function BuyerRequests() {
  const { token, user } = useAuth();
  const { online } = useSync();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const canAsk = Boolean(online && token && !user?.pendingRegistration);

  const load = useCallback(async () => {
    if (!canAsk) return;
    try {
      setData(await api.get("/api/buyer-requests", { token }));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [canAsk, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(request, action) {
    setBusyId(request.id);
    try {
      const result = await api.post(`/api/buyer-requests/${request.id}/${action}`, undefined, { token });
      if (action === "share") {
        if (result.smsSent) toast.success(result.message);
        else toast.info(result.message);
      }
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <PageHeader title={WORDS.requestsTitle.text} subtitle="Buyers who scanned your Harvest Passport." say={WORDS.requestsTitle} backTo="/app/money/buyers" />
  );

  if (!canAsk) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <p className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          <WifiOff size={18} aria-hidden="true" /> Buyer requests need network. Connect, then open this page again.
        </p>
      </div>
    );
  }
  if (!data && !error) return <PageLoading label="Opening buyer requests…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {header}
      <ErrorBanner message={error} />
      {data?.requests?.length ? (
        <ul className="space-y-3">
          {data.requests.map((request) => (
            <RequestCard key={request.id} request={request} onAction={act} busy={busyId === request.id} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Handshake}
          title={WORDS.requestsNone.text}
          description="Turn on the Harvest Passport for a harvest. Buyers who scan it can leave their number here."
        />
      )}
      <p className="text-center text-xs text-ink-soft">
        Your phone number is never shown to buyers. It is only sent when you tap “Share my number”.
      </p>
    </div>
  );
}
