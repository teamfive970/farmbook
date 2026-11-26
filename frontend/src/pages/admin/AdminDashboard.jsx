import {
  Download,
  Landmark,
  MapPin,
  Network,
  RefreshCw,
  ShoppingBasket,
  Sprout,
  Wheat
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarList,
  ChartCard,
  ColumnChart,
  DataTable,
  HeroFigure,
  LineChart,
  SegmentedBar,
  StatTile,
  VIZ,
  foldOther,
  formatCompact,
  formatNumber,
  monthLabel
} from "../../components/charts.jsx";
import { ErrorBanner, PageLoading, buttonClass } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api, downloadFile } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { ACTIVITY_TYPES, COUNTIES, FARM_TYPES } from "../../lib/labels.js";
import { EXPENSE_CATEGORIES } from "../../lib/words.js";

// Ministry of Agriculture overview. One filter row (period, county,
// currency) scopes every figure, chart and CSV download on the page.

// ---------- period presets ----------

function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const PERIODS = [
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "ytd", label: "This year" },
  { key: "last_year", label: "Last year" },
  { key: "custom", label: "Custom range" }
];

function periodRange(key, custom) {
  const today = new Date();
  const monthsBack = { "3m": 2, "6m": 5, "12m": 11 }[key];
  if (monthsBack !== undefined) {
    return { from: iso(new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)), to: iso(today) };
  }
  if (key === "ytd") return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
  if (key === "last_year") {
    const y = today.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return custom;
}

const EXPORTS = [
  { key: "farmers", label: "Farmers (one row each)" },
  { key: "counties", label: "County summary" },
  { key: "cooperatives", label: "Cooperatives" },
  { key: "monthly", label: "Monthly trends" }
];

const COUNTY_MEASURES = [
  { key: "farmers", label: "Farmers" },
  { key: "farms", label: "Farms" },
  { key: "areaHectares", label: "Land (ha)" },
  { key: "activities", label: "Activities" },
  { key: "harvests", label: "Harvests" },
  { key: "sold", label: "Sales" }
];

const GRADE_PARTS = [
  { key: "A", label: "Grade A" },
  { key: "B", label: "Grade B" },
  { key: "C", label: "Grade C" },
  { key: "rejected", label: "Rejected" }
];

const englishActivity = (value) => {
  const meta = ACTIVITY_TYPES.find((item) => item.value === value);
  return meta?.englishLabel || meta?.label || value;
};
const expenseLabel = (value) => EXPENSE_CATEGORIES.find((item) => item.value === value)?.text || value;

function money(value, currency) {
  return `${currency === "USD" ? "US$" : "L$"}${formatNumber(Math.round(value))}`;
}
function moneyCompact(value, currency) {
  const sign = value < 0 ? "−" : "";
  return `${sign}${currency === "USD" ? "US$" : "L$"}${formatCompact(Math.abs(value))}`;
}

// ---------- page ----------

export default function AdminDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState("12m");
  const [custom, setCustom] = useState(() => periodRange("12m"));
  const [county, setCounty] = useState("");
  const [currency, setCurrency] = useState("LRD");
  const [countyMeasure, setCountyMeasure] = useState("farmers");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState("");
  const [purpose, setPurpose] = useState("");
  const requestId = useRef(0);

  const range = useMemo(() => periodRange(period, custom), [period, custom]);
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (county) params.set("county", county);
    return params.toString();
  }, [range, county]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await api.get(`/api/admin/analytics?${queryString}`, { token });
      if (id !== requestId.current) return;
      // Keep the previous render on screen until new data arrives.
      setData(result);
      setError("");
    } catch (failure) {
      if (id !== requestId.current) return;
      if (failure?.status === 404) {
        // Ask the server what it is, so the message says exactly what to fix.
        let started = "";
        try {
          const health = await api.get("/api/health");
          if (health?.startedAt) started = ` It was started ${new Date(health.startedAt).toLocaleString()}.`;
        } catch {
          // ignore: the message below still applies
        }
        if (id !== requestId.current) return;
        setError(
          `The API server answering on port 8000 is an older copy of FarmBok without the reports.${started} ` +
            "Close every backend terminal (or end all node.exe processes), start the backend again with npm run dev in the backend folder, then press Refresh."
        );
      } else {
        setError(failure?.message || "Could not load the reports.");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [queryString, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Start the money charts on whichever currency farmers actually use.
  const autoCurrency = useRef(false);
  useEffect(() => {
    if (!data || autoCurrency.current) return;
    autoCurrency.current = true;
    const m = data.kpis.money;
    if (!m.sold.LRD && !m.spent.LRD && (m.sold.USD || m.spent.USD)) setCurrency("USD");
  }, [data]);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const close = (event) => {
      if (event.key === "Escape" || event.type === "pointerdown") setExportOpen(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", close);
      window.addEventListener("keydown", close);
    });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [exportOpen]);

  async function handleExport(dataset) {
    const why = purpose.trim();
    if (why.length < 3) {
      toast.error("Say why you need this file before downloading.");
      return;
    }
    setExportOpen(false);
    setExporting(dataset);
    try {
      const params = `${queryString}&purpose=${encodeURIComponent(why)}`;
      await downloadFile(`/api/admin/exports/${dataset}?${params}`, {
        token,
        fallbackName: `farmbok-${dataset}.csv`
      });
    } catch (downloadError) {
      toast.error(downloadError.message);
    } finally {
      setExporting("");
    }
  }

  if (!data && loading && !error) return <PageLoading label="Loading national overview…" />;

  const scopeName = county ? `${county} County` : "All of Liberia";
  const periodText = `${formatDate(range.from)} – ${formatDate(range.to)}`;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-ink">Admin overview</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Farmers, farms, harvests, sales and cooperatives · {scopeName} · {periodText}
        </p>
      </div>

      {/* One filter row: it scopes every number below. */}
      <div className="sticky top-[65px] z-20 -mx-4 mb-5 border-b border-line/70 bg-canvas/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="period">
            Period
          </label>
          <select
            id="period"
            value={period}
            onChange={(event) => {
              if (event.target.value === "custom") setCustom(range);
              setPeriod(event.target.value);
            }}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-medium text-ink"
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          {period === "custom" ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="date"
                aria-label="From"
                value={custom.from}
                max={custom.to}
                onChange={(event) => event.target.value && setCustom((c) => ({ ...c, from: event.target.value }))}
                className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              />
              <span className="text-xs text-ink-soft">to</span>
              <input
                type="date"
                aria-label="To"
                value={custom.to}
                min={custom.from}
                onChange={(event) => event.target.value && setCustom((c) => ({ ...c, to: event.target.value }))}
                className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              />
            </span>
          ) : null}

          <label className="sr-only" htmlFor="county">
            County
          </label>
          <select
            id="county"
            value={county}
            onChange={(event) => setCounty(event.target.value)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-medium text-ink"
          >
            <option value="">All counties</option>
            {COUNTIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="inline-flex h-9 rounded-lg border border-line bg-white p-0.5" role="group" aria-label="Currency">
            {["LRD", "USD"].map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={currency === code}
                onClick={() => setCurrency(code)}
                className={`rounded-md px-3 text-xs font-semibold transition ${
                  currency === code ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                {code === "LRD" ? "L$ LRD" : "US$ USD"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={load} className={buttonClass("secondary", "sm")} aria-label="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                disabled={Boolean(exporting)}
                className={buttonClass("primary", "sm")}
              >
                <Download size={14} /> {exporting ? "Preparing…" : "Download CSV"}
              </button>
              {exportOpen ? (
                <div
                  role="menu"
                  onPointerDown={(event) => event.stopPropagation()}
                  className="absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-float"
                >
                  <p className="px-3 py-1.5 text-[11px] text-ink-soft">
                    Uses the period and county above. Each file is capped at 5,000 rows and every
                    download is saved in the audit log.
                  </p>
                  <div className="px-3 pb-2">
                    <label htmlFor="exportPurpose" className="text-[11px] font-semibold text-ink">
                      Why do you need this file?
                    </label>
                    <input
                      id="exportPurpose"
                      value={purpose}
                      maxLength={200}
                      onChange={(event) => setPurpose(event.target.value)}
                      placeholder="For example: monthly county report"
                      className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm text-ink"
                    />
                  </div>
                  {EXPORTS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      disabled={purpose.trim().length < 3}
                      onClick={() => handleExport(item.key)}
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ErrorBanner message={error} />

      {data ? (
        <Dashboard
          data={data}
          busy={loading}
          currency={currency}
          county={county}
          countyMeasure={countyMeasure}
          setCountyMeasure={setCountyMeasure}
          onPickCounty={setCounty}
        />
      ) : null}
    </div>
  );
}

function Dashboard({ data, busy, currency, county, countyMeasure, setCountyMeasure, onPickCounty }) {
  const { kpis, monthly, engagement } = data;
  const m = kpis.money;
  const monthKeys = monthly.map((row) => row.month);
  const spansYears = new Set(monthKeys.map((k) => k.slice(0, 4))).size > 1;
  const axisLabels = monthKeys.map((k, i) =>
    spansYears && (i === 0 || k.endsWith("-01")) ? `${monthLabel(k)} ’${k.slice(2, 4)}` : monthLabel(k)
  );
  const tooltipLabels = monthKeys.map((k) => monthLabel(k, { withYear: true }));
  const soldKey = currency === "USD" ? "soldUSD" : "soldLRD";
  const monthlyTable = {
    caption: "Monthly figures",
    columns: [
      { key: "month", label: "Month", render: (r) => monthLabel(r.month, { withYear: true }) },
      { key: "newFarmers", label: "New farmers", numeric: true },
      { key: "activities", label: "Activities", numeric: true },
      { key: "harvests", label: "Harvests", numeric: true },
      { key: "soldLRD", label: "Sales (L$)", numeric: true },
      { key: "soldUSD", label: "Sales (US$)", numeric: true }
    ],
    rows: monthly.map((r) => ({ ...r, key: r.month }))
  };

  // County comparison
  const countyValue = (row) => (countyMeasure === "sold" ? row[soldKey] : row[countyMeasure]);
  const countyFormat =
    countyMeasure === "sold"
      ? (v) => moneyCompact(v, currency)
      : countyMeasure === "areaHectares"
        ? (v) => `${formatNumber(v)} ha`
        : formatNumber;
  const countyItems = [...data.counties]
    .map((row) => ({ key: row.county, label: row.county, value: countyValue(row) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const countiesWithFarmers = data.counties.filter((row) => row.farmers > 0).length;

  // Colour follows the farm type (fixed order), never its rank.
  const farmTypeParts = FARM_TYPES.map((type, i) => ({
    label: type.englishLabel || type.label,
    value: data.farmTypes.find((row) => row.type === type.value)?.count || 0,
    color: VIZ.series[i]
  }));
  const cropItems = foldOther(
    data.crops.map((row) => ({ key: row.crop, label: row.crop, value: row.farms })),
    7
  );
  const activityItems = foldOther(
    data.activityTypes.map((row) => ({ key: row.type, label: englishActivity(row.type), value: row.count })),
    7
  );
  const gradeParts = GRADE_PARTS.map((g, i) => ({ label: g.label, value: data.grades[g.key] || 0, color: VIZ.ordinal[i] }));
  const gradeTotal = gradeParts.reduce((s, p) => s + p.value, 0);
  const engagementParts = [
    { label: "Recorded in last 7 days", value: engagement.last7Days },
    { label: "8–30 days ago", value: engagement.last30Days },
    { label: "31–90 days ago", value: engagement.last90Days },
    { label: "Nothing in 90+ days", value: engagement.dormant }
  ].map((p, i) => ({ ...p, color: VIZ.ordinal[i] }));
  const engagedPct = kpis.activeFarmers
    ? Math.round(((engagement.last7Days + engagement.last30Days) / kpis.activeFarmers) * 100)
    : 0;

  const moneyItems = [
    { key: "sold", label: "Total sales", value: m.sold[currency] },
    { key: "received", label: "Total income", value: m.received[currency] },
    { key: "spent", label: "Total expenses", value: m.spent[currency] }
  ];
  const profit = m.profit[currency];
  const expenseItems = foldOther(
    data.spentByCategory
      .filter((row) => row.currency === currency)
      .map((row) => ({ key: row.category, label: expenseLabel(row.category), value: row.total })),
    7
  );

  const coopItems = data.cooperatives
    .filter((c) => c.status === "active")
    .slice(0, 10)
    .map((c) => ({ key: c.id, label: c.name, value: c.members }));

  return (
    <div className="space-y-4">
      {/* Headline figures */}
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <HeroFigure
          label="Registered farmers"
          value={formatNumber(kpis.farmers)}
          detail={`${formatNumber(kpis.activeFarmers)} active · ${formatNumber(kpis.newFarmers)} new in this period`}
          trend={monthly.map((r) => r.newFarmers)}
          trendLabel="New registrations per month"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile Icon={Sprout} label="Farms" value={formatNumber(kpis.farms)} detail={`${countiesWithFarmers} of 15 counties reached`} />
          <StatTile
            Icon={MapPin}
            label="Land recorded"
            value={`${formatNumber(kpis.areaHectares)} ha`}
            detail={
              [
                kpis.lots ? `+ ${formatNumber(kpis.lots)} lots` : null,
                kpis.farmsWithoutSize ? `${formatNumber(kpis.farmsWithoutSize)} farms without a size` : null
              ]
                .filter(Boolean)
                .join(" · ") || "Every farm has a size"
            }
          />
          <StatTile
            Icon={Network}
            label="In a cooperative"
            value={`${kpis.coopCoveragePercent}%`}
            detail={`${formatNumber(kpis.coopMembers)} farmers · ${formatNumber(kpis.cooperatives)} groups`}
          />
          <StatTile
            Icon={Wheat}
            label="Harvest batches"
            value={formatNumber(kpis.harvests)}
            detail={`${formatNumber(kpis.activities)} farm activities recorded`}
            trend={monthly.map((r) => r.harvests)}
          />
          <StatTile
            Icon={ShoppingBasket}
            label={`Sales (${currency})`}
            value={moneyCompact(m.sold[currency], currency)}
            detail={`${formatNumber(kpis.sales)} sales · income ${moneyCompact(m.received[currency], currency)}`}
            trend={monthly.map((r) => r[soldKey])}
          />
          <StatTile
            Icon={Landmark}
            label={`Farmer profit (${currency})`}
            value={moneyCompact(profit, currency)}
            detail="Total income minus total expenses"
          />
        </div>
      </div>

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Farm records per month"
          subtitle="Activities and harvest batches, by the date of the work"
          busy={busy}
          legend={[
            { label: "Activities", color: VIZ.series[0], shape: "line" },
            { label: "Harvest batches", color: VIZ.series[1], shape: "line" }
          ]}
          table={monthlyTable}
        >
          <LineChart
            labels={axisLabels}
            tooltipLabels={tooltipLabels}
            ariaLabel="Line chart of activities and harvest batches per month. Use the arrow keys to read each month."
            series={[
              { key: "activities", name: "Activities", color: VIZ.series[0], values: monthly.map((r) => r.activities) },
              { key: "harvests", name: "Harvest batches", color: VIZ.series[1], values: monthly.map((r) => r.harvests) }
            ]}
          />
        </ChartCard>

        <ChartCard title="New farmer registrations" subtitle="Farmers who joined each month" busy={busy} table={monthlyTable}>
          <ColumnChart
            labels={axisLabels}
            tooltipLabels={tooltipLabels}
            values={monthly.map((r) => r.newFarmers)}
            seriesName="new farmers"
            ariaLabel="Column chart of new farmer registrations per month"
          />
        </ChartCard>
      </div>

      {/* Counties */}
      <ChartCard
        title="Counties"
        subtitle={
          county
            ? `${county} is highlighted. Click it again to see all counties.`
            : "By the farmer’s registered county. Click a county to focus the page on it."
        }
        busy={busy}
        action={
          <select
            aria-label="Compare counties by"
            value={countyMeasure}
            onChange={(event) => setCountyMeasure(event.target.value)}
            className="h-7 rounded-md border border-line bg-white px-1.5 text-[11px] font-semibold text-ink"
          >
            {COUNTY_MEASURES.map((measure) => (
              <option key={measure.key} value={measure.key}>
                {measure.key === "sold" ? `Sales (${currency})` : measure.label}
              </option>
            ))}
          </select>
        }
        table={{
          caption: "County summary",
          maxHeight: 560,
          columns: [
            { key: "county", label: "County" },
            { key: "farmers", label: "Farmers", numeric: true },
            { key: "newFarmers", label: "New", numeric: true },
            { key: "farms", label: "Farms", numeric: true },
            { key: "areaHectares", label: "Land (ha)", numeric: true },
            { key: "coopMembers", label: "Co-op members", numeric: true },
            { key: "activities", label: "Activities", numeric: true },
            { key: "harvests", label: "Harvests", numeric: true },
            { key: "soldLRD", label: "Sales (L$)", numeric: true },
            { key: "soldUSD", label: "Sales (US$)", numeric: true }
          ],
          rows: data.counties.map((row) => ({ ...row, key: row.county }))
        }}
      >
        <CountyBars items={countyItems} format={countyFormat} highlight={county} onPick={onPickCounty} />
      </ChartCard>

      {/* What is farmed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Farm types"
          subtitle={`${formatNumber(kpis.farms)} farms`}
          busy={busy}
          table={{
            columns: [
              { key: "label", label: "Farm type" },
              { key: "value", label: "Farms", numeric: true }
            ],
            rows: farmTypeParts
          }}
        >
          <SegmentedBar parts={farmTypeParts} emptyText="No farms registered yet." />
        </ChartCard>
        <ChartCard
          title="Main crops and animals"
          subtitle="Number of farms growing or raising each"
          busy={busy}
          table={{
            columns: [
              { key: "crop", label: "Crop / animal" },
              { key: "farms", label: "Farms", numeric: true }
            ],
            rows: data.crops.map((r) => ({ ...r, key: r.crop }))
          }}
        >
          <BarList items={cropItems} emptyText="No main crops recorded yet." />
        </ChartCard>
        <ChartCard
          title="Work recorded"
          subtitle="Farm activities in this period, by type"
          busy={busy}
          table={{
            columns: [
              { key: "type", label: "Activity", render: (r) => englishActivity(r.type) },
              { key: "count", label: "Records", numeric: true }
            ],
            rows: data.activityTypes.map((r) => ({ ...r, key: r.type }))
          }}
        >
          <BarList items={activityItems} emptyText="No activities in this period." />
        </ChartCard>
      </div>

      {/* Harvest & quality */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Harvest by crop" subtitle="Units differ by crop, so quantities are not added together" busy={busy}>
          <DataTable
            caption="Harvest by crop"
            columns={[
              { key: "crop", label: "Crop" },
              { key: "quantity", label: "Quantity", numeric: true },
              { key: "unit", label: "Unit" },
              { key: "batches", label: "Batches", numeric: true }
            ]}
            rows={data.harvestByCrop.map((r) => ({ ...r, key: `${r.crop}-${r.unit}` }))}
          />
        </ChartCard>
        <ChartCard
          title="Harvest quality"
          subtitle={
            gradeTotal
              ? `${formatNumber(gradeTotal)} of ${formatNumber(kpis.harvests)} batches checked (latest check per batch)`
              : "No batches checked in this period"
          }
          busy={busy}
          table={{
            columns: [
              { key: "label", label: "Grade" },
              { key: "value", label: "Batches", numeric: true }
            ],
            rows: gradeParts
          }}
        >
          <SegmentedBar parts={gradeParts} emptyText="No quality checks in this period." />
          {kpis.harvests > gradeTotal ? (
            <p className="mt-3 text-[11px]" style={{ color: VIZ.inkSoft }}>
              {formatNumber(kpis.harvests - gradeTotal)} batches have not been checked yet.
            </p>
          ) : null}
        </ChartCard>
      </div>

      {/* Money */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={`Sales value per month (${currency})`}
          subtitle="L$ and US$ are never converted or added together"
          className="lg:col-span-2"
          busy={busy}
          table={monthlyTable}
        >
          <ColumnChart
            labels={axisLabels}
            tooltipLabels={tooltipLabels}
            values={monthly.map((r) => r[soldKey])}
            seriesName="sold"
            format={(v) => moneyCompact(v, currency)}
            valueFormat={(v) => money(v, currency)}
            ariaLabel={`Column chart of sales value per month in ${currency}`}
          />
        </ChartCard>
        <ChartCard
          title={`Farmer money (${currency})`}
          subtitle="Totals for this period"
          busy={busy}
          table={{
            columns: [
              { key: "label", label: "" },
              { key: "value", label: currency, numeric: true }
            ],
            rows: [...moneyItems, { key: "profit", label: "Profit (income − expenses)", value: profit }]
          }}
        >
          <BarList items={moneyItems} format={(v) => moneyCompact(v, currency)} emptyText="No money recorded in this period." />
          <p className="mt-3 border-t pt-3 text-xs" style={{ borderColor: VIZ.grid, color: VIZ.inkSoft }}>
            Profit (income − expenses):{" "}
            <span className="font-semibold" style={{ color: profit < 0 ? VIZ.ink : VIZ.successText }}>
              {profit < 0 ? "−" : ""}
              {money(Math.abs(profit), currency)}
            </span>
          </p>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`Farm costs by type (${currency})`}
          subtitle="What farmers spent money on in this period"
          busy={busy}
          table={{
            columns: [
              { key: "label", label: "Cost" },
              { key: "value", label: currency, numeric: true }
            ],
            rows: expenseItems
          }}
        >
          <BarList items={expenseItems} format={(v) => moneyCompact(v, currency)} emptyText="No costs recorded in this period." />
        </ChartCard>
        <ChartCard
          title="Farmer engagement"
          subtitle={`${engagedPct}% of active farmers recorded something in the last 30 days`}
          busy={busy}
          table={{
            columns: [
              { key: "label", label: "Last record" },
              { key: "value", label: "Farmers", numeric: true }
            ],
            rows: engagementParts
          }}
        >
          <SegmentedBar parts={engagementParts} emptyText="No active farmers yet." />
          <p className="mt-3 text-[11px]" style={{ color: VIZ.inkSoft }}>
            Based on when records reached the server. Farmers working offline show up after their phone syncs.
          </p>
        </ChartCard>
      </div>

      {/* Cooperatives */}
      <ChartCard
        title="Cooperatives by members"
        subtitle={county ? `Groups registered in ${county}` : "Largest active groups"}
        busy={busy}
        action={
          <Link to="/admin/cooperatives" className="text-xs font-semibold text-primary hover:underline">
            Manage
          </Link>
        }
        table={{
          caption: "Cooperatives",
          columns: [
            {
              key: "name",
              label: "Cooperative",
              render: (r) => (
                <Link to={`/admin/cooperatives/${r.id}`} className="font-semibold text-primary hover:underline">
                  {r.name}
                </Link>
              )
            },
            { key: "county", label: "County" },
            { key: "members", label: "Members", numeric: true },
            { key: "leaders", label: "Leaders", numeric: true },
            { key: "harvests", label: "Harvests", numeric: true },
            { key: "soldLRD", label: "Sales (L$)", numeric: true },
            { key: "soldUSD", label: "Sales (US$)", numeric: true },
            { key: "status", label: "Status" }
          ],
          rows: data.cooperatives.map((r) => ({ ...r, key: r.id }))
        }}
      >
        <BarList items={coopItems} emptyText="No cooperatives yet. Create one under Cooperatives." />
      </ChartCard>

    </div>
  );
}

// Ranked county bars; a click focuses the whole page on that county.
function CountyBars({ items, format, highlight, onPick }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  // Column-major on wide screens, so the ranking reads straight down.
  return (
    <ul className="gap-x-8 md:columns-2">
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        const selected = highlight === item.key;
        const fill = highlight ? (selected ? VIZ.series[0] : VIZ.de) : VIZ.series[0];
        return (
          <li key={item.key} className="break-inside-avoid pb-1">
            <button
              type="button"
              onClick={() => onPick(selected ? "" : item.key)}
              aria-pressed={selected}
              aria-label={`${item.label}: ${format(item.value)}. ${selected ? "Show all counties" : "Focus on this county"}`}
              className={`grid w-full grid-cols-[112px_1fr] items-center gap-3 rounded-md px-1.5 py-1 text-left transition hover:bg-canvas ${
                selected ? "bg-primary-soft/60" : ""
              }`}
            >
              <span className={`truncate text-xs ${selected ? "font-semibold text-ink" : "text-ink-soft"}`}>{item.label}</span>
              <span className="relative block min-w-0 pr-20">
                <span
                  className="relative block h-3"
                  style={{ width: `${pct}%`, minWidth: item.value > 0 ? 2 : 0, background: fill, borderRadius: "0 4px 4px 0" }}
                >
                  <span
                    className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold tabular-nums"
                    style={{ color: item.value ? VIZ.ink : VIZ.muted }}
                  >
                    {format(item.value)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
