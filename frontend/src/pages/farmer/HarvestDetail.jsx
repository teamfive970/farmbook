import { Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrCode, Section } from "../../components/Choices.jsx";
import { SpeakButton } from "../../components/Voice.jsx";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  PageLoading,
  StatusChip,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate } from "../../lib/format.js";
import { batchStatus, formatMoney, saleStatus } from "../../lib/ledger.js";
import { GRADES, QUALITY_CHECKS, WORDS, growEmoji, unitText } from "../../lib/words.js";
import { BATCH_STATE_WORDS } from "./Harvests.jsx";

export function passportUrl(code) {
  return `${window.location.origin}/p/${code}`;
}

export default function HarvestDetail() {
  const { clientId } = useParams();
  const { farms, records, loading } = useFarmerData();
  const { updateRecord, deleteRecord, online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const harvest = records.harvests.find((item) => item.clientId === clientId);
  if (!harvest) {
    if (loading) return <PageLoading label="Opening…" />;
    return (
      <div>
        <PageHeader title="Harvest not found" backTo="/app/harvests" />
        <p className="text-sm text-ink-soft">This harvest is not on this phone.</p>
      </div>
    );
  }

  const status = batchStatus(harvest, records.sales, records.inspections);
  const state = BATCH_STATE_WORDS[status.state];
  const farm = farms.find((item) => item.clientId === harvest.farmClientId);
  const checks = records.inspections.filter((item) => item.harvestClientId === harvest.clientId);
  const latest = checks[0];
  const grade = status.grade ? GRADES[status.grade] : null;
  const unit = unitText(harvest.unit);
  const summary = `${harvest.crop}. ${harvest.quantity} ${unit}. ${state.say} ${grade ? grade.say : ""}`;

  async function togglePassport() {
    setBusy(true);
    try {
      await updateRecord(harvest, { passportPublic: !harvest.passportPublic });
      toast.success(harvest.passportPublic ? "Buyers can't see it now." : "Buyers can see it now.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = passportUrl(harvest.passportCode);
    try {
      if (navigator.share) await navigator.share({ title: `${harvest.crop} – Harvest Passport`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("The link is copied.");
      }
    } catch {
      // The farmer closed the share window.
    }
  }

  async function remove() {
    await deleteRecord(harvest);
    toast.success("The harvest is deleted.");
    navigate("/app/harvests", { replace: true });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${harvest.crop} harvest`}
        subtitle={`${farm?.farmName || "Farm"} · ${formatDate(harvest.harvestDate)}`}
        backTo="/app/harvests"
        say={{ say: summary }}
        action={
          <Link to={`/app/harvests/${clientId}/edit`} className={buttonClass("secondary", "sm")} data-say="Change it">
            <Pencil size={14} /> Change
          </Link>
        }
      />

      <Section>
        <div className="flex items-center gap-4">
          <span className="text-5xl" aria-hidden="true">
            {growEmoji(harvest.crop)}
          </span>
          <div className="flex-1">
            <p className="text-2xl font-bold text-ink">
              {harvest.quantity} {unit}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.tone}`} data-say={state.say}>
                {state.text}
              </span>
              {harvest.syncStatus && <StatusChip status={harvest.syncStatus} />}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-canvas p-3" data-say={`You sold ${status.sold} ${unit}.`}>
            <p className="text-xs text-ink-soft">{WORDS.sold.text}</p>
            <p className="text-xl font-bold text-ink">{status.sold}</p>
          </div>
          <div className="rounded-xl bg-canvas p-3" data-say={`${status.remaining} ${unit} still left.`}>
            <p className="text-xs text-ink-soft">{WORDS.left.text}</p>
            <p className="text-xl font-bold text-ink">{status.remaining}</p>
          </div>
        </div>
        {harvest.storage && <p className="mt-3 text-sm text-ink-soft">Kept: {harvest.storage}</p>}
        {harvest.notes && <p className="mt-2 text-sm text-ink-soft">{harvest.notes}</p>}
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={`/app/harvests/${clientId}/check`}
          data-say={WORDS.checkQuality.say}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-bold text-ink shadow-card"
        >
          🔍 {WORDS.checkQuality.text}
        </Link>
        <Link
          to={`/app/money/sell?harvest=${clientId}`}
          data-say={WORDS.sell.say}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-sm font-bold text-white shadow-card"
        >
          💵 {WORDS.sell.text}
        </Link>
      </div>

      {/* Quality */}
      <Section title={WORDS.grade}>
        {latest ? (
          <div data-say={`${GRADES[latest.grade]?.say} Checked ${formatDate(latest.inspectionDate)}.`}>
            <p className="text-lg font-bold text-ink">
              {GRADES[latest.grade]?.emoji} {GRADES[latest.grade]?.text}
              <span className="ml-2 text-xs font-normal text-ink-soft">{formatDate(latest.inspectionDate)}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUALITY_CHECKS.map((check) => (
                <span
                  key={check.value}
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    latest.checks?.[check.value] ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  }`}
                >
                  {latest.checks?.[check.value] ? "✓" : "✗"} {check.text}
                </span>
              ))}
            </div>
            {checks.length > 1 && <p className="mt-2 text-xs text-ink-soft">Checked {checks.length} times.</p>}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Not checked yet. Touch "{WORDS.checkQuality.text}".</p>
        )}
      </Section>

      {/* Harvest Passport */}
      <Section title={WORDS.passport}>
        <p className="text-sm text-ink-soft">
          Buyers scan the code to see where this crop came from, the farm work and the grade. Your
          phone number and full name are never shown.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={harvest.passportPublic}
          onClick={togglePassport}
          disabled={busy}
          data-say={harvest.passportPublic ? WORDS.passportOn.say : WORDS.passportOff.say}
          className={`mt-3 flex min-h-14 w-full items-center justify-between rounded-xl border-2 px-4 text-sm font-bold ${
            harvest.passportPublic ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white text-ink"
          }`}
        >
          <span>{harvest.passportPublic ? `👁️ ${WORDS.passportOn.text}` : `🙈 ${WORDS.passportOff.text}`}</span>
          <span>{harvest.passportPublic ? "On" : WORDS.showBuyers.text}</span>
        </button>

        {harvest.passportPublic &&
          (harvest.passportCode ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <QrCode text={passportUrl(harvest.passportCode)} size={220} />
              <p className="font-mono text-lg font-bold tracking-wider text-ink">{harvest.passportCode}</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={share} data-say="Send the link to the buyer.">
                  <Share2 size={16} /> Send link
                </Button>
                <SpeakButton phrase={{ say: `Your code is ${harvest.passportCode.split("").join(" ")}.` }} />
              </div>
              {(harvest.syncStatus && harvest.syncStatus !== "synced") && (
                <p className="text-center text-xs text-amber-700">
                  Buyers can see it after this change goes on the internet.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" data-say="The code will come when network come.">
              The code will come when network come. {online ? "Sending now…" : ""}
            </p>
          ))}
      </Section>

      {/* Sales from this batch */}
      {status.sales.length > 0 && (
        <Section title={{ text: "Sold from this harvest", say: "What you sold from this harvest." }}>
          <div className="space-y-2">
            {status.sales.map((sale) => {
              const paid = saleStatus(sale, records.payments);
              return (
                <Link
                  key={sale.clientId}
                  to={`/app/money/sales/${sale.clientId}`}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm"
                >
                  <span>
                    {sale.quantity} {unitText(sale.unit)} · {formatDate(sale.saleDate)}
                  </span>
                  <span className="font-bold">{formatMoney(sale.totalAmount, sale.currency)}</span>
                  {paid.owed > 0 && <span className="text-xs text-amber-700">owe {formatMoney(paid.owed, sale.currency)}</span>}
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
        <Trash2 size={16} /> Delete this harvest
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this harvest?"
        message="The harvest, its quality checks and its passport will be deleted. Sales stay."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
