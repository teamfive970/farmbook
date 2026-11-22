import { ArrowDownRight, ArrowUpRight, ChartColumn, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceButton, CropIcon } from "../../components/Choices.jsx";
import { SpeakButton } from "../../components/Voice.jsx";
import { EmptyState, PageHeader, PageLoading } from "../../components/ui.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { ICONS } from "../../lib/icons.js";
import { formatMoney } from "../../lib/ledger.js";
import { COMPARE_CHOICES, comparePeriods, compareSeasons, trend } from "../../lib/seasonCompare.js";
import { WORDS, unitText } from "../../lib/words.js";

// For costs and animals lost, going up is bad news.
function Change({ now, before, upIsGood = true }) {
  const way = trend(now, before);
  if (way === "same") {
    return (
      <span className="inline-flex items-center text-ink-soft" aria-label="Same">
        <Minus size={16} aria-hidden="true" />
      </span>
    );
  }
  const good = (way === "up") === upIsGood;
  const Icon = way === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center ${good ? "text-success" : "text-danger"}`} aria-label={way === "up" ? "Up" : "Down"}>
      <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
    </span>
  );
}

function money(value, currency) {
  return `${value < 0 ? "−" : ""}${formatMoney(Math.abs(value), currency)}`;
}

// One line of a card: the label, before, now, and an arrow.
function Line({ label, before, now, show = (value) => value, upIsGood = true, strong = false }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_1.25rem] items-center gap-x-3 py-1.5 text-sm">
      <span className={`text-ink-soft ${strong ? "font-bold text-ink" : ""}`}>{label}</span>
      <span className="text-right tabular-nums text-ink-soft">{show(before)}</span>
      <span className={`text-right tabular-nums ${strong ? "font-bold" : "font-semibold"} text-ink`}>{show(now)}</span>
      <Change now={now} before={before} upIsGood={upIsGood} />
    </div>
  );
}

function ColumnHeads({ periods }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_1.25rem] gap-x-3 border-b border-line pb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
      <span />
      <span className="text-right">{periods.previous.short}</span>
      <span className="text-right text-ink">{periods.current.short}</span>
      <span />
    </div>
  );
}

function RowCard({ row, periods, currencies }) {
  const harvest = row.current.harvest || row.previous.harvest;
  const percent = (share) => (share === null ? "–" : `${Math.round(share * 100)}%`);
  const Icon = row.kind === "other" ? ICONS.expense : null;
  return (
    <article className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center gap-3">
        {Icon ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600" aria-hidden="true">
            <Icon size={24} />
          </span>
        ) : (
          <CropIcon name={row.name} size={24} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-ink">{row.name}</h2>
          <p className="text-xs text-ink-soft">
            {row.kind === "animal" ? "Animals" : row.kind === "crop" ? "Crop" : "Farm costs"}
            {row.mixedUnits && " · harvests in more than one unit; the main one is shown"}
          </p>
        </div>
        {row.isNew && (
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold uppercase text-primary-dark">New</span>
        )}
      </div>
      <ColumnHeads periods={periods} />
      {harvest && (
        <Line
          label={`Harvest (${unitText(harvest.unit)})`}
          before={row.previous.harvest?.quantity || 0}
          now={row.current.harvest?.quantity || 0}
          show={(value) => value.toLocaleString("en-US")}
        />
      )}
      {currencies.map((currency) => (
        <div key={currency}>
          {(row.current.received[currency] || row.previous.received[currency]) !== 0 && (
            <Line
              label={`Money in${currencies.length > 1 ? ` (${currency === "USD" ? "US$" : "L$"})` : ""}`}
              before={row.previous.received[currency]}
              now={row.current.received[currency]}
              show={(value) => money(value, currency)}
            />
          )}
          {(row.current.spent[currency] || row.previous.spent[currency]) !== 0 && (
            <Line
              label={`Costs${currencies.length > 1 ? ` (${currency === "USD" ? "US$" : "L$"})` : ""}`}
              before={row.previous.spent[currency]}
              now={row.current.spent[currency]}
              show={(value) => money(value, currency)}
              upIsGood={false}
            />
          )}
          {row.kind !== "other" && (row.current.profit[currency] || row.previous.profit[currency]) !== 0 && (
            <Line
              label={`Profit${currencies.length > 1 ? ` (${currency === "USD" ? "US$" : "L$"})` : ""}`}
              before={row.previous.profit[currency]}
              now={row.current.profit[currency]}
              show={(value) => money(value, currency)}
              strong
            />
          )}
        </div>
      ))}
      {(row.current.checks > 0 || row.previous.checks > 0) && (
        <Line
          label="Grade A"
          before={row.previous.gradeAShare ?? 0}
          now={row.current.gradeAShare ?? 0}
          show={(value) => percent(value)}
        />
      )}
      {row.kind === "animal" && (row.current.animalsLost > 0 || row.previous.animalsLost > 0) && (
        <Line label="Animals died" before={row.previous.animalsLost} now={row.current.animalsLost} upIsGood={false} />
      )}
    </article>
  );
}

// "Compare seasons": this season next to the one before, crop by crop. Worked
// out on the phone (lib/seasonCompare.js), so it works without network.
export default function SeasonCompare() {
  const { records, loading } = useFarmerData();
  const [choice, setChoice] = useState("season");
  const periods = useMemo(() => comparePeriods(choice), [choice]);
  const result = useMemo(() => compareSeasons(records, periods), [records, periods]);

  if (loading && records.harvests.length === 0 && records.sales.length === 0) {
    return <PageLoading label="Comparing your seasons…" />;
  }

  const totalsRow = {
    current: result.totals.current,
    previous: result.totals.previous
  };
  const spoken = result.insights.map((item) => item.say).join(" ");

  return (
    <div className="space-y-4">
      <PageHeader
        title={WORDS.compareTitle.text}
        subtitle="This season next to the one before, crop by crop."
        say={WORDS.compareTitle}
        backTo="/app/money"
      />

      <div className="grid grid-cols-2 gap-2 lg:max-w-md">
        {COMPARE_CHOICES.map((item) => (
          <ChoiceButton
            key={item.value}
            selected={choice === item.value}
            onClick={() => setChoice(item.value)}
            words={{ text: item.label, say: item.hint }}
          >
            {item.label}
          </ChoiceButton>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center lg:max-w-md">
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{periods.previous.short}</p>
          <p className="text-sm font-semibold text-ink">{periods.previous.label}</p>
        </div>
        <div className="rounded-2xl bg-primary px-3 py-2.5 text-white shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">{periods.current.short}</p>
          <p className="text-sm font-semibold">{periods.current.label}</p>
        </div>
      </div>

      {!result.hasCurrent && !result.hasPrevious ? (
        <EmptyState icon={ChartColumn} title={WORDS.compareNothing.text} description="Record your harvests, sales and costs, and come back here." />
      ) : (
        <>
          {!result.hasPrevious && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" data-say={WORDS.compareNothingBefore.say}>
              {WORDS.compareNothingBefore.text}
            </p>
          )}

          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          {result.insights.length > 0 && (
            <section className="rounded-2xl bg-primary-dark p-4 text-white shadow-card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-white/80">What changed</h2>
                <SpeakButton phrase={{ say: spoken }} className="bg-white/15 text-white hover:bg-white hover:text-primary-dark" />
              </div>
              <ul className="space-y-2">
                {result.insights.map((item) => (
                  <li key={item.text} className="flex items-start gap-2 text-[15px] font-semibold leading-snug" data-say={item.say}>
                    {item.tone === "up" ? (
                      <ArrowUpRight size={20} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight size={20} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" />
                    )}
                    {item.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl bg-white p-4 shadow-card">
            <h2 className="label" data-say="All your crops and animals together.">
              All together
            </h2>
            <ColumnHeads periods={periods} />
            <Line label="Harvests" before={totalsRow.previous.harvests} now={totalsRow.current.harvests} />
            {result.currencies.map((currency) => (
              <div key={currency}>
                <Line
                  label={`Money in${result.currencies.length > 1 ? ` (${currency === "USD" ? "US$" : "L$"})` : ""}`}
                  before={totalsRow.previous.received[currency]}
                  now={totalsRow.current.received[currency]}
                  show={(value) => money(value, currency)}
                />
                <Line
                  label={`Costs${result.currencies.length > 1 ? ` (${currency === "USD" ? "US$" : "L$"})` : ""}`}
                  before={totalsRow.previous.spent[currency]}
                  now={totalsRow.current.spent[currency]}
                  show={(value) => money(value, currency)}
                  upIsGood={false}
                />
                <Line
                  label={`Profit${result.currencies.length > 1 ? ` (${currency === "USD" ? "US$" : "L$"})` : ""}`}
                  before={totalsRow.previous.profit[currency]}
                  now={totalsRow.current.profit[currency]}
                  show={(value) => money(value, currency)}
                  strong
                />
              </div>
            ))}
            <p className="mt-2 text-xs text-ink-soft">Profit = money in − costs. Liberian and US dollars are kept apart.</p>
          </section>
          </div>

          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 2xl:grid-cols-3">
            {result.rows.map((row) => (
              <RowCard key={row.key} row={row} periods={periods} currencies={result.currencies} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
