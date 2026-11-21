import { FileSpreadsheet, FileText, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceButton, CropIcon, Section } from "../../components/Choices.jsx";
import { Button, PageHeader, PageLoading, TextInput } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { REPORT_PERIODS, buildFarmerReport, longDate, reportFileName } from "../../lib/farmReport.js";
import { todayInputValue } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { farmMeta } from "../../lib/labels.js";
import { formatMoney, sayMoney } from "../../lib/ledger.js";
import { reportCsv, reportPdf } from "../../lib/reportExport.js";
import { WORDS } from "../../lib/words.js";

const CURRENCY_NAME = { LRD: "Liberian dollars", USD: "US dollars" };

function saveFile(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// "My farm report": the summary for a chosen time and farm, on screen, and
// saved as a PDF (to print or send) or a CSV (for Excel). Everything is made
// from the records on this phone, so it works without network.
export default function Report() {
  const { user } = useAuth();
  const { farms, records, activities, loading } = useFarmerData();
  const toast = useToast();
  const [choice, setChoice] = useState("year");
  const [custom, setCustom] = useState({ from: "", to: todayInputValue() });
  const [farmClientId, setFarmClientId] = useState("");
  const [busy, setBusy] = useState("");

  const farm = farms.find((item) => item.clientId === farmClientId) || null;
  const report = useMemo(
    () => buildFarmerReport({ user, farms, records, activities, choice, custom, farm }),
    [user, farms, records, activities, choice, custom, farm]
  );

  if (loading && records.sales.length === 0 && records.expenses.length === 0 && farms.length === 0) {
    return <PageLoading label="Making your report…" />;
  }

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof File !== "undefined" &&
    navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] });

  async function exportAs(kind) {
    setBusy(kind);
    try {
      // Let the button show it is working before the file is made.
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (kind === "csv") {
        saveFile(reportCsv(report), reportFileName(report, "csv"), "text/csv;charset=utf-8");
        toast.success("The report is saved for Excel. Look in your Downloads.");
      } else if (kind === "pdf") {
        saveFile(reportPdf(report), reportFileName(report, "pdf"), "application/pdf");
        toast.success("The PDF report is saved. Look in your Downloads.");
      } else {
        const file = new File([reportPdf(report)], reportFileName(report, "pdf"), { type: "application/pdf" });
        await navigator.share({ files: [file], title: "Farm report", text: `Farm report · ${report.periodText}` });
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast.error("The report could not be saved. Try again.");
    } finally {
      setBusy("");
    }
  }

  const c = report.counts;
  const nothing = c.sales + c.expenses + c.harvests + c.work + c.crops + c.animalGroups === 0;

  return (
    <div className="space-y-4">
      <PageHeader title={WORDS.reportTitle.text} subtitle="Your summary, to keep, print or send." backTo="/app/money" say={WORDS.reportTitle} />

      <Section title={WORDS.reportWhen}>
        <div className="grid grid-cols-3 gap-2">
          {REPORT_PERIODS.map((item) => (
            <ChoiceButton key={item.value} words={item} selected={choice === item.value} onClick={() => setChoice(item.value)} className="text-xs">
              {item.text}
            </ChoiceButton>
          ))}
        </div>
        {choice === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-ink-soft" data-say={WORDS.reportFrom.say}>
              {WORDS.reportFrom.text}
              <TextInput
                type="date"
                className="mt-1"
                value={custom.from}
                max={todayInputValue()}
                onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-ink-soft" data-say={WORDS.reportTo.say}>
              {WORDS.reportTo.text}
              <TextInput
                type="date"
                className="mt-1"
                value={custom.to}
                max={todayInputValue()}
                onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))}
              />
            </label>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-soft">{report.periodText}</p>
      </Section>

      {farms.length > 1 && (
        <Section title={WORDS.reportFarms}>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton words={{ say: "All my farms." }} selected={!farmClientId} onClick={() => setFarmClientId("")}>
              <ICONS.farm size={16} aria-hidden="true" /> All my farms
            </ChoiceButton>
            {farms.map((item) => {
              const meta = farmMeta(item.farmType);
              return (
                <ChoiceButton
                  key={item.clientId || item.id}
                  words={{ say: item.farmName }}
                  selected={farmClientId === item.clientId}
                  onClick={() => setFarmClientId(item.clientId)}
                  className="justify-start text-left"
                >
                  <meta.Icon size={16} aria-hidden="true" /> {item.farmName}
                </ChoiceButton>
              );
            })}
          </div>
        </Section>
      )}

      {report.currencies.map((currency) => {
        const t = report.totals[currency];
        const tiles = [
          { Icon: ICONS.sale, words: WORDS.totalSales, amount: t.sold, tone: "text-ink" },
          { Icon: ICONS.income, words: WORDS.totalIncome, amount: t.income, tone: "text-success" },
          { Icon: ICONS.expense, words: WORDS.totalExpenses, amount: t.spent, tone: "text-rose-700" },
          {
            Icon: t.profit >= 0 ? ICONS.profit : ICONS.loss,
            words: t.profit >= 0 ? WORDS.profit : WORDS.loss,
            amount: Math.abs(t.profit),
            tone: t.profit >= 0 ? "text-success" : "text-danger",
            box: t.profit >= 0 ? "bg-success/10" : "bg-danger/10"
          }
        ];
        return (
          <Section key={currency}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">{CURRENCY_NAME[currency]}</p>
            <div className="grid grid-cols-2 gap-2">
              {tiles.map(({ Icon, words, amount, tone, box }) => (
                <div key={words.key} className={`rounded-xl px-3 py-3 ${box || "bg-canvas"}`} data-say={`${words.say} ${sayMoney(amount, currency)}.`}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
                    <Icon size={15} aria-hidden="true" /> {words.text}
                  </p>
                  <p className={`mt-1 text-lg font-bold ${tone}`}>{formatMoney(amount, currency)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-soft">Profit is total income − total expenses.</p>
          </Section>
        );
      })}

      <Section title={{ text: "In this time", say: "What you did in this time." }}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { Icon: ICONS.sale, label: "Sales", value: c.sales },
            { Icon: ICONS.expense, label: "Expenses", value: c.expenses },
            { Icon: ICONS.harvest, label: "Harvests", value: c.harvests },
            { Icon: ICONS.planting, label: "Crops", value: c.crops },
            { Icon: ICONS.animals, label: "Animal groups", value: c.animalGroups },
            { Icon: ICONS.farm, label: "Work done", value: c.work }
          ].map(({ Icon, label, value }) => (
            <div key={label} className="rounded-xl bg-canvas p-2.5" data-say={`${value} ${label.toLowerCase()}.`}>
              <Icon size={18} className="mx-auto text-ink-soft" aria-hidden="true" />
              <p className="mt-1 text-lg font-bold text-ink">{value}</p>
              <p className="text-[11px] leading-tight text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-card">
        {nothing && (
          <p className="text-sm text-ink-soft" data-say="No records for this time yet. Choose another time.">
            No records for this time yet. You can still save the report, or choose another time.
          </p>
        )}
        <Button size="lg" className="w-full text-base" loading={busy === "pdf"} onClick={() => exportAs("pdf")} data-say={WORDS.reportSavePdf.say}>
          <FileText size={20} aria-hidden="true" /> {WORDS.reportSavePdf.text}
        </Button>
        <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
          <Button variant="secondary" loading={busy === "csv"} onClick={() => exportAs("csv")} data-say={WORDS.reportSaveCsv.say}>
            <FileSpreadsheet size={18} aria-hidden="true" /> {WORDS.reportSaveCsv.text}
          </Button>
          {canShare && (
            <Button variant="secondary" loading={busy === "share"} onClick={() => exportAs("share")} data-say={WORDS.reportShare.say}>
              <Share2 size={18} aria-hidden="true" /> {WORDS.reportShare.text}
            </Button>
          )}
        </div>
        <p className="text-center text-[11px] text-ink-soft">
          Made from the records on this phone, {longDate(report.madeOn)}. Works without network.
        </p>
      </section>

      {report.byProduction.length > 0 && (
        <Section title={{ text: "Each crop and animal group", say: "How each crop and animal group did." }}>
          <ul className="divide-y divide-line">
            {report.byProduction.slice(0, 8).map((row) => (
              <li key={`${row.productionClientId}-${row.currency}`} className="flex items-center gap-3 py-2.5">
                <CropIcon name={row.name.split(" · ")[0]} size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{row.name}</span>
                  <span className="block text-xs text-ink-soft">
                    Income {formatMoney(row.income, row.currency)} · Expenses {formatMoney(row.spent, row.currency)}
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-bold ${row.profit >= 0 ? "text-success" : "text-danger"}`}>
                  {row.profit < 0 ? "−" : ""}
                  {formatMoney(Math.abs(row.profit), row.currency)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.harvests.length > 0 && (
        <Section title={{ text: "Harvest", say: "What you harvested, sold, and what is still in store." }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-ink-soft">
                <th className="pb-1 text-left font-semibold">Crop</th>
                <th className="pb-1 text-right font-semibold">Got</th>
                <th className="pb-1 text-right font-semibold">Sold</th>
                <th className="pb-1 text-right font-semibold">In store</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.harvests.map((row) => (
                <HarvestRow key={`${row.crop}-${row.unit}`} row={row} />
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {report.animals.length > 0 && (
        <Section title={{ text: "Animals", say: "Your animals: born, died, sold, and how many now." }}>
          <ul className="divide-y divide-line">
            {report.animals.map((row) => (
              <li key={row.name + row.farm} className="flex items-center gap-3 py-2.5">
                <CropIcon name={row.name.split(" · ")[0]} size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{row.name}</span>
                  <span className="block text-xs text-ink-soft">
                    +{row.added} · died {row.died} · sold {row.sold}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold text-ink">{row.now}</span>
                  <span className="block text-[10px] text-ink-soft">{WORDS.countNow.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

    </div>
  );
}

function HarvestRow({ row }) {
  const n = (value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <tr data-say={`${row.crop}: ${n(row.harvested)} ${row.unit}, sold ${n(row.sold)}, ${n(row.left)} still in store.`}>
      <td className="py-2 font-semibold text-ink">
        {row.crop} <span className="text-xs font-normal text-ink-soft">({row.unit})</span>
      </td>
      <td className="py-2 text-right text-ink">{n(row.harvested)}</td>
      <td className="py-2 text-right text-ink">{n(row.sold)}</td>
      <td className="py-2 text-right font-bold text-ink">{n(row.left)}</td>
    </tr>
  );
}
