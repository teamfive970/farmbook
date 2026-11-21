import { ChevronRight, FileText, Image as ImageIcon, LayoutGrid, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CropIcon, GradeBadge, QrCode, Section } from "../../components/Choices.jsx";
import { SpeakButton } from "../../components/Voice.jsx";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  PageLoading,
  StatusChip,
  buttonClass
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate } from "../../lib/format.js";
import { harvestTagPdf, qrPng, tagData, tagFileName } from "../../lib/harvestTag.js";
import { batchMoney, batchStatus, formatMoney, latestInspection, sayMoney } from "../../lib/ledger.js";
import { ICONS } from "../../lib/icons.js";
import { GRADES, QUALITY_CHECKS, WORDS, unitText } from "../../lib/words.js";
import { BATCH_STATE_WORDS } from "./Harvests.jsx";

export function passportUrl(code) {
  return `${window.location.origin}/p/${code}`;
}

function saveFile(data, name, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Copies the link even when the browser blocks the clipboard (old phone,
// plain http, tab not focused): try the clipboard, then the old copy command.
async function copyLink(text) {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the old way.
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "-1000px";
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}

export default function HarvestDetail() {
  const { clientId } = useParams();
  const { user } = useAuth();
  const [saving, setSaving] = useState("");
  const { farms, records, loading } = useFarmerData();
  const { updateRecord, deleteRecord, online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

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
  const checks = records.inspections
    .filter((item) => item.harvestClientId === harvest.clientId)
    .sort((a, b) => String(b.inspectionDate).localeCompare(String(a.inspectionDate)));
  const latest = latestInspection(harvest, records.inspections);
  const money = batchMoney(records).filter((row) => row.harvestClientId === harvest.clientId);
  const hasSales = status.sales.length > 0;
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
    if (navigator.share) {
      try {
        await navigator.share({ title: `${harvest.crop} – Harvest Passport`, url });
        return;
      } catch (error) {
        // The farmer closed the share window; there is nothing else to do.
        if (error?.name === "AbortError") return;
      }
    }
    if (await copyLink(url)) {
      toast.success("The link is copied. Send it to the buyer.");
      return;
    }
    // Copy was blocked. Show the link so it can still be copied by hand.
    setLinkOpen(true);
  }

  // The QR code as a picture, and the product tag as PDF. Made on the phone.
  async function saveTag(kind) {
    setSaving(kind);
    try {
      const tag = tagData({
        harvest,
        farm,
        user,
        grade: status.grade,
        gradeText: grade?.text,
        checks: QUALITY_CHECKS.filter((check) => latest?.checks?.[check.value] === true).map((check) => check.text),
        unit,
        url: passportUrl(harvest.passportCode)
      });
      if (kind === "png") {
        const blob = await qrPng(tag.url, { caption: [`${tag.crop} · ${tag.code}`, "Scan to see where it came from"] });
        saveFile(blob, tagFileName(tag, "png"), "image/png");
        toast.success("The QR picture is saved. Look in your Downloads.");
      } else {
        const layout = kind === "sheet" ? "sheet" : "label";
        saveFile(harvestTagPdf(tag, { layout }), tagFileName(tag, "pdf", layout === "sheet" ? "-sheet" : ""), "application/pdf");
        toast.success("The tag is saved as PDF. Look in your Downloads.");
      }
    } catch {
      toast.error("It could not be saved. Try again.");
    } finally {
      setSaving("");
    }
  }

  async function remove() {
    setConfirmDelete(false);
    if (hasSales) return;
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
          <CropIcon name={harvest.crop} size={36} />
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
          <ICONS.quality size={20} aria-hidden="true" /> {WORDS.checkQuality.text}
        </Link>
        <Link
          to={`/app/money/sell?harvest=${clientId}`}
          data-say={WORDS.sell.say}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-sm font-bold text-white shadow-card"
        >
          <ICONS.sale size={20} aria-hidden="true" /> {WORDS.sell.text}
        </Link>
      </div>

      {/* Quality */}
      <Section title={WORDS.grade}>
        {latest ? (
          <div data-say={`${GRADES[latest.grade]?.say} Checked ${formatDate(latest.inspectionDate)}.`}>
            <div className="flex items-center gap-2">
              <GradeBadge grade={latest.grade} words={GRADES[latest.grade]} size="lg" />
              <span className="text-xs text-ink-soft">{formatDate(latest.inspectionDate)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUALITY_CHECKS.filter((check) => latest.checks?.[check.value] !== undefined).map((check) => (
                <span
                  key={check.value}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                    latest.checks[check.value] ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  }`}
                >
                  <check.Icon size={12} aria-hidden="true" /> {check.text}: {latest.checks[check.value] ? "yes" : "no"}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {checks.map((check) => (
                <Link
                  key={check.clientId}
                  to={`/app/harvests/${harvest.clientId}/check/${check.clientId}`}
                  data-say={`${GRADES[check.grade]?.text}, ${formatDate(check.inspectionDate)}. Touch to change it.`}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <GradeBadge grade={check.grade} words={GRADES[check.grade]} />
                    {formatDate(check.inspectionDate)}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    Change <ChevronRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Not checked yet. Touch "{WORDS.checkQuality.text}".</p>
        )}
      </Section>

      {/* Money from this batch: sales, income, its own costs and profit */}
      <Section title={{ text: "Money from this harvest", say: "The money from this harvest." }}>
        {money.length === 0 ? (
          <p className="text-sm text-ink-soft">No sales or costs for this harvest yet.</p>
        ) : (
          <div className="space-y-3">
            {money.map((row) => (
              <div key={row.currency}>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { Icon: ICONS.sale, words: WORDS.totalSales, amount: row.sold, tone: "text-ink" },
                    { Icon: ICONS.income, words: WORDS.totalIncome, amount: row.income, tone: "text-success" },
                    { Icon: ICONS.expense, words: WORDS.totalExpenses, amount: row.spent, tone: "text-rose-700" }
                  ].map(({ Icon, words, amount, tone }) => (
                    <div key={words.key} className="rounded-xl bg-canvas p-2.5" data-say={`${words.say} ${sayMoney(amount, row.currency)}.`}>
                      <Icon size={16} className="mx-auto text-ink-soft" aria-hidden="true" />
                      <p className="text-[11px] leading-tight text-ink-soft">{words.text}</p>
                      <p className={`text-sm font-bold ${tone}`}>{formatMoney(amount, row.currency)}</p>
                    </div>
                  ))}
                </div>
                <div
                  className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 ${row.profit >= 0 ? "bg-success/10" : "bg-danger/10"}`}
                  data-say={`${row.profit >= 0 ? WORDS.profit.say : WORDS.loss.say} ${sayMoney(Math.abs(row.profit), row.currency)}.`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-ink">
                    {row.profit >= 0 ? <ICONS.profit size={18} aria-hidden="true" /> : <ICONS.loss size={18} aria-hidden="true" />}
                    {row.profit >= 0 ? WORDS.profit.text : WORDS.loss.text}
                  </span>
                  <span className={`font-bold ${row.profit >= 0 ? "text-success" : "text-danger"}`}>
                    {formatMoney(Math.abs(row.profit), row.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link
          to={`/app/money/spend?harvest=${harvest.clientId}`}
          data-say="Put money you spend for this harvest."
          className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-line text-sm font-bold text-ink"
        >
          <ICONS.expense size={18} aria-hidden="true" /> Put a cost for this harvest
        </Link>
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
          <span className="flex items-center gap-2">
            {harvest.passportPublic ? <ICONS.visible size={18} aria-hidden="true" /> : <ICONS.hidden size={18} aria-hidden="true" />}
            {harvest.passportPublic ? WORDS.passportOn.text : WORDS.passportOff.text}
          </span>
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
              <div className="w-full space-y-2 border-t border-line pt-3">
                <p className="text-center text-xs font-semibold text-ink-soft">Save to print or send</p>
                <Button
                  className="w-full"
                  loading={saving === "label"}
                  onClick={() => saveTag("label")}
                  data-say="Save the product tag as PDF, to print and put on the bag."
                >
                  <FileText size={18} aria-hidden="true" /> Product tag (PDF)
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    loading={saving === "sheet"}
                    onClick={() => saveTag("sheet")}
                    data-say="Save four tags on one page, to print and cut."
                  >
                    <LayoutGrid size={16} aria-hidden="true" /> 4 tags (A4)
                  </Button>
                  <Button
                    variant="secondary"
                    loading={saving === "png"}
                    onClick={() => saveTag("png")}
                    data-say="Save the QR code as a picture."
                  >
                    <ImageIcon size={16} aria-hidden="true" /> QR picture
                  </Button>
                </div>
              </div>
              {(harvest.syncStatus && harvest.syncStatus !== "synced") && (
                <p className="text-center text-xs text-amber-700">
                  Buyers can see it after this change goes on the internet.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" data-say="The code will appear when you are online.">
              The code will appear when you are online. {online ? "Sending now…" : ""}
            </p>
          ))}
      </Section>

      {linkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Send this link to the buyer"
          onClick={() => setLinkOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-card" onClick={(event) => event.stopPropagation()}>
            <p className="text-sm font-bold text-ink">Send this link to the buyer</p>
            <p className="mt-1 text-xs text-ink-soft">Copy it, then send it on WhatsApp or let the buyer type it.</p>
            <input
              readOnly
              autoFocus
              value={passportUrl(harvest.passportCode)}
              onFocus={(event) => event.target.select()}
              aria-label="Harvest Passport link"
              className="mt-3 w-full rounded-xl border-2 border-line px-3 py-2 font-mono text-xs text-ink"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  if (await copyLink(passportUrl(harvest.passportCode))) {
                    toast.success("The link is copied.");
                  } else {
                    toast.error("Copy did not work. Touch the link, then copy it yourself.");
                  }
                }}
              >
                Copy
              </Button>
              <Button onClick={() => setLinkOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Sales from this batch */}
      {hasSales && (
        <Section title={{ text: "Sold from this harvest", say: "What you sold from this harvest." }}>
          <div className="space-y-2">
            {status.sales.map((sale) => (
              <Link
                key={sale.clientId}
                to={`/app/money/sales/${sale.clientId}`}
                className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm"
              >
                <span>
                  {sale.quantity} {unitText(sale.unit)} · {formatDate(sale.saleDate)}
                </span>
                <span className="font-bold">{formatMoney(sale.totalAmount, sale.currency)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
        <Trash2 size={16} /> Delete this harvest
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title={hasSales ? "You sold from this harvest" : "Delete this harvest?"}
        message={
          hasSales
            ? `You sold from it ${status.sales.length} time(s). Delete those sales first, then you can delete the harvest.`
            : "The harvest, its quality checks and its passport will be deleted."
        }
        confirmLabel={hasSales ? "OK" : "Delete"}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
