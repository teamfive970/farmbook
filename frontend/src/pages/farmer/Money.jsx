import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChoiceButton, Section } from "../../components/Choices.jsx";
import { EmptyState, PageHeader, PageLoading, StatusChip } from "../../components/ui.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate } from "../../lib/format.js";
import { formatMoney, moneySummary, periodFor, saleStatus, sayMoney, usedCurrencies } from "../../lib/ledger.js";
import { EXPENSE_CATEGORIES, WORDS, growEmoji, optionFor, unitText } from "../../lib/words.js";

// "My money": what came in, what people owe, what was spent and what the
// farmer keeps. Worked out on the phone, so it works without network.
export default function Money() {
  const { records, loading } = useFarmerData();
  const [periodChoice, setPeriodChoice] = useState("year");
  const period = useMemo(() => periodFor(periodChoice), [periodChoice]);
  const summary = useMemo(() => moneySummary(records, period), [records, period]);

  if (loading && records.sales.length === 0 && records.expenses.length === 0) {
    return <PageLoading label="Opening your money…" />;
  }

  const currencies = usedCurrencies(summary);
  const owing = records.sales
    .map((sale) => ({ sale, status: saleStatus(sale, records.payments) }))
    .filter((item) => item.status.owed > 0);
  const recent = [
    ...records.sales.map((sale) => ({ type: "sale", date: sale.saleDate, item: sale })),
    ...records.expenses.map((expense) => ({ type: "expense", date: expense.expenseDate, item: expense }))
  ]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <PageHeader title={WORDS.moneyTitle.text} subtitle="What you sell, spend and keep." say={WORDS.moneyTitle} />

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/app/money/sell"
          data-say={WORDS.sell.say}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-base font-bold text-white shadow-card"
        >
          <span className="text-3xl" aria-hidden="true">💵</span>
          {WORDS.sell.text}
        </Link>
        <Link
          to="/app/money/spend"
          data-say={WORDS.spend.say}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-rose-600 text-base font-bold text-white shadow-card"
        >
          <span className="text-3xl" aria-hidden="true">💸</span>
          {WORDS.spend.text}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
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
        const rows = [
          ["💰", WORDS.received, summary.received[currency], "text-success"],
          ["🤝", WORDS.owed, summary.owed[currency], "text-amber-700"],
          ["💸", WORDS.spent, summary.spent[currency], "text-rose-700"]
        ];
        return (
          <Section key={currency}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
              {currency === "USD" ? "US dollars" : "Liberian dollars"}
            </p>
            <div className="space-y-2">
              {rows.map(([emoji, words, amount, tone]) => (
                <div
                  key={words.key}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5"
                  data-say={`${words.say} ${sayMoney(amount, currency)}.`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="text-2xl" aria-hidden="true">{emoji}</span> {words.text}
                  </span>
                  <span className={`text-lg font-bold ${tone}`}>{formatMoney(amount, currency)}</span>
                </div>
              ))}
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-3 ${profit >= 0 ? "bg-success/10" : "bg-danger/10"}`}
                data-say={
                  profit >= 0
                    ? `${WORDS.profit.say} ${sayMoney(profit, currency)}.`
                    : `${WORDS.loss.say} ${sayMoney(-profit, currency)}.`
                }
              >
                <span className="flex items-center gap-2 text-base font-bold text-ink">
                  <span className="text-2xl" aria-hidden="true">{profit >= 0 ? "😀" : "😟"}</span>
                  {profit >= 0 ? WORDS.profit.text : WORDS.loss.text}
                </span>
                <span className={`text-xl font-bold ${profit >= 0 ? "text-success" : "text-danger"}`}>
                  {formatMoney(Math.abs(profit), currency)}
                </span>
              </div>
            </div>
          </Section>
        );
      })}

      {owing.length > 0 && (
        <Section title={WORDS.owed}>
          <div className="space-y-2">
            {owing.map(({ sale, status }) => {
              const buyer = records.buyers.find((item) => item.clientId === sale.buyerClientId);
              return (
                <Link
                  key={sale.clientId}
                  to={`/app/money/sales/${sale.clientId}`}
                  data-say={`${buyer?.name || "Somebody"} owe you ${sayMoney(status.owed, sale.currency)}.`}
                  className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5"
                >
                  <span className="text-sm font-semibold text-ink">
                    {growEmoji(sale.crop)} {buyer?.name || "Buyer"} · {formatDate(sale.saleDate)}
                  </span>
                  <span className="text-base font-bold text-amber-800">{formatMoney(status.owed, sale.currency)}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={{ text: "Lately", say: "What you sold and spent lately." }}>
        {recent.length === 0 ? (
          <EmptyState title="Nothing yet" description="Touch the green or red button to start." />
        ) : (
          <div className="space-y-2">
            {recent.map(({ type, item }) =>
              type === "sale" ? (
                <Link
                  key={item.clientId}
                  to={`/app/money/sales/${item.clientId}`}
                  data-say={`You sold ${item.quantity} ${unitText(item.unit)} ${item.crop} for ${sayMoney(item.totalAmount, item.currency)}.`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                >
                  <span className="min-w-0 text-sm text-ink">
                    <span aria-hidden="true">{growEmoji(item.crop)} </span>
                    <strong>{item.crop}</strong> · {item.quantity} {unitText(item.unit)}
                    <span className="block text-xs text-ink-soft">{formatDate(item.saleDate)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-success">+{formatMoney(item.totalAmount, item.currency)}</span>
                    {item.syncStatus && item.syncStatus !== "synced" && <StatusChip status={item.syncStatus} showLabel={false} />}
                  </span>
                </Link>
              ) : (
                <Link
                  key={item.clientId}
                  to={`/app/money/spend/${item.clientId}`}
                  data-say={`You spend ${sayMoney(item.amount, item.currency)} on ${optionFor(EXPENSE_CATEGORIES, item.category)?.text || "something"}.`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                >
                  <span className="min-w-0 text-sm text-ink">
                    <span aria-hidden="true">{optionFor(EXPENSE_CATEGORIES, item.category)?.emoji} </span>
                    <strong>{optionFor(EXPENSE_CATEGORIES, item.category)?.text}</strong>
                    <span className="block text-xs text-ink-soft">{formatDate(item.expenseDate)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-rose-700">−{formatMoney(item.amount, item.currency)}</span>
                    {item.syncStatus && item.syncStatus !== "synced" && <StatusChip status={item.syncStatus} showLabel={false} />}
                  </span>
                </Link>
              )
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
