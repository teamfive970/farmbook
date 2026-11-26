import { BadgeCheck, CalendarCheck, Phone, Printer, Sprout, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { PageLoading } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { formatDate, formatPhone } from "../lib/format.js";
import { formatMoney } from "../lib/ledger.js";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const monthName = (value) => MONTH.format(new Date(`${value}-01T00:00:00Z`));
const CURRENCIES = ["LRD", "USD"];

function Stat({ label, children }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <div className="mt-1 text-lg font-bold text-ink">{children}</div>
    </div>
  );
}

// What a lender sees from a farmer's "Show my record to a lender" link.
// No sign-in. Made to print or save as PDF.
export default function CreditRecord() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/credit/${encodeURIComponent(code)}`)
      .then(setData)
      .catch((problem) => setError(problem.message || "This link is not working."));
  }, [code]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-5 py-10 text-center">
        <Brand to="/" />
        <p className="rounded-2xl bg-white p-6 text-sm text-ink shadow-card">{error}</p>
      </div>
    );
  }
  if (!data) return <PageLoading label="Opening the farm record…" />;

  const { record, share } = data;
  const used = CURRENCIES.filter(
    (currency) => record.totals.in[currency] || record.totals.out[currency] || record.sales.some((row) => row.currency === currency)
  );
  const shown = used.length ? used : ["LRD"];
  const keeping = record.recordKeeping;
  const sizes = Object.entries(record.farms.size).map(([unit, value]) => `${value} ${unit}`).join(" + ");
  const grades = Object.entries(record.quality);

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 print:max-w-none print:px-0 print:py-0">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Brand to="/" />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-line bg-white px-4 text-sm font-bold text-ink print:hidden"
          >
            <Printer size={16} aria-hidden="true" /> Print or save as PDF
          </button>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-card print:shadow-none">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Farm record for a lender</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{record.farmer.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <span>{record.farmer.place}, Liberia</span>
            {record.farmer.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={14} aria-hidden="true" /> {formatPhone(record.farmer.phone)}
              </span>
            )}
            <span>Using FarmBok since {formatDate(record.farmer.usingFarmBokSince)}</span>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Last 12 months: {formatDate(record.period.from)} – {formatDate(record.period.to)}
            {share.lenderName ? ` · Shared with ${share.lenderName}` : ""} · Link works until {formatDate(share.expiresAt)}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {shown.map((currency) => (
            <Stat key={`in-${currency}`} label={`Money in (${currency === "LRD" ? "L$" : "US$"})`}>
              {formatMoney(record.totals.in[currency], currency)}
            </Stat>
          ))}
          {shown.map((currency) => (
            <Stat key={`out-${currency}`} label={`Farm costs (${currency === "LRD" ? "L$" : "US$"})`}>
              {formatMoney(record.totals.out[currency], currency)}
            </Stat>
          ))}
          {shown.map((currency) => (
            <Stat key={`p-${currency}`} label={`Profit (${currency === "LRD" ? "L$" : "US$"})`}>
              <span className={record.totals.profit[currency] < 0 ? "text-rose-700" : "text-emerald-700"}>
                {record.totals.profit[currency] < 0 ? "−" : ""}
                {formatMoney(Math.abs(record.totals.profit[currency]), currency)}
              </span>
            </Stat>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card print:shadow-none">
          <h2 className="text-base font-bold text-ink">Month by month</h2>
          <p className="text-xs text-ink-soft">Money in = payments received. Costs = farm expenses. Liberian and US dollars are never added together.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="py-2 pr-3 font-semibold">Month</th>
                  {shown.map((currency) => (
                    <th key={`h-in-${currency}`} className="py-2 pr-3 text-right font-semibold">In ({currency === "LRD" ? "L$" : "US$"})</th>
                  ))}
                  {shown.map((currency) => (
                    <th key={`h-out-${currency}`} className="py-2 pr-3 text-right font-semibold">Costs ({currency === "LRD" ? "L$" : "US$"})</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {record.monthly.map((row) => (
                  <tr key={row.month} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-3 text-ink">{monthName(row.month)}</td>
                    {shown.map((currency) => (
                      <td key={`in-${currency}`} className="py-2 pr-3 text-right tabular-nums text-ink">
                        {row.in[currency] ? formatMoney(row.in[currency], currency) : "–"}
                      </td>
                    ))}
                    {shown.map((currency) => (
                      <td key={`out-${currency}`} className="py-2 pr-3 text-right tabular-nums text-ink">
                        {row.out[currency] ? formatMoney(row.out[currency], currency) : "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-card print:shadow-none">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Sprout size={18} className="text-primary" aria-hidden="true" /> Farm, harvests and sales
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-ink">
              <li>
                {record.farms.count} {record.farms.count === 1 ? "farm" : "farms"}
                {sizes ? `, ${sizes}` : ""}
              </li>
              {record.farms.crops.length > 0 && <li>Grows / raises: {record.farms.crops.join(", ")}</li>}
              {record.harvests.length ? (
                record.harvests.map((row) => (
                  <li key={`${row.crop}-${row.unit}`}>
                    Harvest, {row.crop}: {row.quantity.toLocaleString("en-US")} {row.unit} ({row.batches} {row.batches === 1 ? "batch" : "batches"})
                  </li>
                ))
              ) : (
                <li className="text-ink-soft">No harvests recorded in the last 12 months.</li>
              )}
              {record.sales.map((row) => (
                <li key={row.currency}>
                  {row.count} {row.count === 1 ? "sale" : "sales"} worth {formatMoney(row.value, row.currency)}
                  {row.buyers ? ` to ${row.buyers} ${row.buyers === 1 ? "buyer" : "buyers"}` : ""}; {row.fullyPaid} fully paid
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-card print:shadow-none">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <CalendarCheck size={18} className="text-primary" aria-hidden="true" /> Record keeping
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-ink">
              <li>Farm work recorded in {keeping.monthsWithFarmWork} of 12 months ({keeping.activities} records)</li>
              <li>Money recorded in {keeping.monthsWithMoneyRecords} of 12 months</li>
              <li>Money came in during {keeping.monthsWithIncome} of 12 months</li>
            </ul>
            {grades.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-sm text-ink">
                <BadgeCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                Harvests checked by agriculture staff: {grades.map(([grade, count]) => `${count} × Grade ${grade}`).join(", ")}
              </p>
            )}
            {record.groups.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-sm text-ink">
                <Users size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                Member of {record.groups.map((group) => `${group.name}${group.role === "leader" ? " (leader)" : ""}`).join(", ")}
              </p>
            )}
          </section>
        </div>

        <p className="text-center text-xs leading-relaxed text-ink-soft">
          {data.note} Made {formatDate(data.generatedAt)}. Record code {share.code}.
        </p>
      </div>
    </div>
  );
}
