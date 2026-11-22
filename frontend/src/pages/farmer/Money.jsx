import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChoiceButton, CropIcon, Section } from "../../components/Choices.jsx";
import { EmptyState, PageHeader, PageLoading, StatusChip } from "../../components/ui.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { farmMoney, formatMoney, moneySummary, periodFor, sayMoney, usedCurrencies } from "../../lib/ledger.js";
import { EXPENSE_CATEGORIES, WORDS, optionFor, unitText } from "../../lib/words.js";

const CURRENCY_NAME = { LRD: "Liberian dollars", USD: "US dollars" };

// "My money": total sales, total expenses, total income and profit for the
// chosen time, then where the money went and how each farm did. Worked out on
// the phone (lib/ledger.js), so it works without network.
//   total sales    = what the sales were worth
//   total income   = money already in hand
//   total expenses = money spent on the farm
//   profit         = income − expenses
export default function Money() {
  const { farms, records, loading } = useFarmerData();
  const [periodChoice, setPeriodChoice] = useState("year");
  const period = useMemo(() => periodFor(periodChoice), [periodChoice]);
  const summary = useMemo(() => moneySummary(records, period), [records, period]);
  const perFarm = useMemo(() => farmMoney(records, period), [records, period]);

  if (loading && records.sales.length === 0 && records.expenses.length === 0) {
    return <PageLoading label="Opening your money…" />;
  }

  const currencies = usedCurrencies(summary);
  const recent = [
    ...records.sales.map((sale) => ({ type: "sale", date: sale.saleDate, item: sale })),
    ...records.expenses.map((expense) => ({ type: "expense", date: expense.expenseDate, item: expense }))
  ]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 12);

  return (
    <div className="space-y-4 desk-flow lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-4 lg:space-y-0">
      <PageHeader className="lg:col-span-12 desk-span" title={WORDS.moneyTitle.text} subtitle="What you sell, spend and keep." say={WORDS.moneyTitle} />

      <div className="grid grid-cols-2 gap-2 lg:col-span-4">
        <Link
          to="/app/money/sell"
          data-say={WORDS.sell.say}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-base font-bold text-white shadow-card"
        >
          <ICONS.sale size={28} aria-hidden="true" />
          {WORDS.sell.text}
        </Link>
        <Link
          to="/app/money/spend"
          data-say={WORDS.spend.say}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-rose-600 text-base font-bold text-white shadow-card"
        >
          <ICONS.expense size={28} aria-hidden="true" />
          {WORDS.spend.text}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:col-span-8">
        {[
          ["month", WORDS.thisMonth],
          ["year", WORDS.thisYear],
          ["all", WORDS.allTime]
        ].map(([value, words]) => (
          <ChoiceButton key={value} words={words} selected={periodChoice === value} onClick={() => setPeriodChoice(value)}>
            {words.text}
          </ChoiceButton>
        ))}
      </div>

      {currencies.map((currency) => {
        const profit = summary.profit[currency];
        const tiles = [
          { Icon: ICONS.sale, words: WORDS.totalSales, amount: summary.sold[currency], tone: "text-ink" },
          { Icon: ICONS.income, words: WORDS.totalIncome, amount: summary.income[currency], tone: "text-success" },
          { Icon: ICONS.expense, words: WORDS.totalExpenses, amount: summary.spent[currency], tone: "text-rose-700" }
        ];
        const ProfitIcon = profit >= 0 ? ICONS.profit : ICONS.loss;
        return (
          <Section key={currency} className="lg:col-span-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">{CURRENCY_NAME[currency]}</p>
            <div className="grid grid-cols-3 gap-2">
              {tiles.map(({ Icon, words, amount, tone }) => (
                <div
                  key={words.key}
                  className="rounded-xl bg-canvas px-2 py-3 text-center"
                  data-say={`${words.say} ${sayMoney(amount, currency)}.`}
                >
                  <Icon size={22} className="mx-auto text-ink-soft" aria-hidden="true" />
                  <p className="mt-1 text-[11px] font-semibold leading-tight text-ink-soft">{words.text}</p>
                  <p className={`mt-1 text-base font-bold ${tone}`}>{formatMoney(amount, currency)}</p>
                </div>
              ))}
            </div>
            <div
              className={`mt-2 flex items-center justify-between rounded-xl px-3 py-3 ${profit >= 0 ? "bg-success/10" : "bg-danger/10"}`}
              data-say={
                profit >= 0
                  ? `${WORDS.profit.say} ${sayMoney(profit, currency)}.`
                  : `${WORDS.loss.say} ${sayMoney(-profit, currency)}.`
              }
            >
              <span className="flex items-center gap-2 text-base font-bold text-ink">
                <ProfitIcon size={22} aria-hidden="true" />
                <span>
                  {profit >= 0 ? WORDS.profit.text : WORDS.loss.text}
                  <span className="block text-[11px] font-normal text-ink-soft">Income − expenses</span>
                </span>
              </span>
              <span className={`text-xl font-bold ${profit >= 0 ? "text-success" : "text-danger"}`}>
                {formatMoney(Math.abs(profit), currency)}
              </span>
            </div>
          </Section>
        );
      })}

      <Section title={{ text: "In this time", say: "What you did in this time." }} className="lg:col-span-6 lg:flex lg:flex-col">
        <div className="grid grid-cols-3 gap-2 text-center lg:flex-1">
          {[
            { Icon: ICONS.sale, label: "Sales", value: summary.counts.sales },
            { Icon: ICONS.expense, label: "Costs", value: summary.counts.expenses },
            { Icon: ICONS.harvest, label: "Harvests", value: summary.counts.harvests }
          ].map(({ Icon, label, value }) => (
                          <div key={label} className="rounded-xl bg-canvas p-2.5 lg:flex lg:flex-col lg:items-center lg:justify-center" data-say={`${value} ${label.toLowerCase()}.`}>
              <Icon size={18} className="mx-auto text-ink-soft" aria-hidden="true" />
              <p className="mt-1 text-lg font-bold text-ink">{value}</p>
              <p className="text-[11px] text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {summary.spentByCategory.length > 0 && (
        <Section title={{ text: "Where the money went", say: "What you spend the money on." }} className="lg:col-span-6">
          <div className="space-y-1.5">
            {summary.spentByCategory.map((row) => {
              const category = optionFor(EXPENSE_CATEGORIES, row.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
              const largest = summary.spentByCategory.find((item) => item.currency === row.currency)?.total || 1;
              return (
                <div key={`${row.category}-${row.currency}`} data-say={`${category.text}: ${sayMoney(row.total, row.currency)}.`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      <category.Icon size={16} className="text-ink-soft" aria-hidden="true" /> {category.text}
                    </span>
                    <span className="font-bold text-ink">{formatMoney(row.total, row.currency)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-canvas">
                    <div className="h-2 rounded-full bg-rose-400" style={{ width: `${Math.max(4, (row.total / largest) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {perFarm.length > 0 && (
        <Section title={{ text: "Each farm", say: "How each farm did. Income from its harvests, take away its costs." }} className="lg:col-span-6">
          <div className="space-y-2">
            {perFarm.map((row) => {
              const farm = farms.find((item) => item.clientId === row.farmClientId);
              return (
                <Link
                  key={`${row.farmClientId}-${row.currency}`}
                  to={farm ? `/app/farms/${farm.id}` : "/app/farms"}
                  className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                  data-say={`${farm?.farmName || "Farm"}. ${row.profit >= 0 ? "Profit" : "Loss"} ${sayMoney(Math.abs(row.profit), row.currency)}.`}
                >
                  <span className="min-w-0 text-sm">
                    <strong className="text-ink">{farm?.farmName || "Farm"}</strong>
                    <span className="block text-xs text-ink-soft">
                      Income {formatMoney(row.income, row.currency)} · Costs {formatMoney(row.spent, row.currency)}
                    </span>
                  </span>
                  <span className={`shrink-0 font-bold ${row.profit >= 0 ? "text-success" : "text-danger"}`}>
                    {row.profit < 0 ? "−" : ""}
                    {formatMoney(Math.abs(row.profit), row.currency)}
                  </span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <Link
        to="/app/report"
        data-say={WORDS.reportOpen.say}
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card lg:col-span-6"
      >
        <ICONS.report size={22} className="text-primary" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-ink">{WORDS.reportOpen.text}</span>
          <span className="block text-xs text-ink-soft">Save as PDF or for Excel</span>
        </span>
        <ChevronRight size={18} className="text-ink-soft" />
      </Link>

      <Link
        to="/app/money/buyers"
        data-say="See and change your buyers."
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card lg:col-span-6"
      >
        <ICONS.buyer size={22} className="text-ink-soft" aria-hidden="true" />
        <span className="flex-1 text-sm font-bold text-ink">My buyers</span>
        <ChevronRight size={18} className="text-ink-soft" />
      </Link>

      <Section title={{ text: "Lately", say: "What you sold and spent lately." }} className="lg:col-span-12 desk-span">
        {recent.length === 0 ? (
          <EmptyState title="Nothing yet" description="Touch the green or red button to start." />
        ) : (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {recent.map(({ type, item }) => {
              if (type === "sale") {
                return (
                  <Link
                    key={item.clientId}
                    to={`/app/money/sales/${item.clientId}`}
                    data-say={`You sold ${item.quantity} ${unitText(item.unit)} ${item.crop} for ${sayMoney(item.totalAmount, item.currency)}.`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                      <CropIcon name={item.crop} size={18} />
                      <span>
                        <strong>{item.crop}</strong> · {item.quantity} {unitText(item.unit)}
                        <span className="block text-xs text-ink-soft">{formatDate(item.saleDate)}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-bold text-ink">+{formatMoney(item.totalAmount, item.currency)}</span>
                      {item.syncStatus && item.syncStatus !== "synced" && <StatusChip status={item.syncStatus} showLabel={false} />}
                    </span>
                  </Link>
                );
              }
              const category = optionFor(EXPENSE_CATEGORIES, item.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
              return (
                <Link
                  key={item.clientId}
                  to={`/app/money/spend/${item.clientId}`}
                  data-say={`You spend ${sayMoney(item.amount, item.currency)} on ${category.text}.`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                      <category.Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{category.text}</strong>
                      <span className="block text-xs text-ink-soft">{formatDate(item.expenseDate)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-rose-700">−{formatMoney(item.amount, item.currency)}</span>
                    {item.syncStatus && item.syncStatus !== "synced" && <StatusChip status={item.syncStatus} showLabel={false} />}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
