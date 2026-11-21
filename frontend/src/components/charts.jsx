import { BarChart3, Table2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

// Small, dependency-free chart kit for the admin (Ministry) dashboard.
// Rules followed throughout:
//   * categorical colours are used in a fixed order and follow the entity;
//   * one y-axis per chart (never two scales);
//   * thin marks: bars <= 24px with a 4px rounded data end, 2px lines;
//   * a legend for 2+ series, direct labels used sparingly;
//   * every chart has hover/focus tooltips AND a table view, so no value is
//     only reachable by hovering and colour is never the only cue;
//   * text is always ink colour, never the series colour.
// The palette was checked with the dataviz validator (light mode; the admin
// app has no dark theme). Slots 3–5 sit below 3:1 on the surface, so those
// charts always ship visible labels + a table view.

export const VIZ = {
  surface: "#fcfcfb",
  ink: "#0b0b0b",
  inkSoft: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  de: "#c3c2b7", // de-emphasis grey for "the rest" when one entity is highlighted
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  // Ordinal blue ramp (dark → light, lightest step still clears 2:1).
  ordinal: ["#0d366b", "#1c5cab", "#3987e5", "#86b6ef"],
  successText: "#006300"
};

// Text placed inside a filled block: white, except near-black on yellow.
export function textOn(color) {
  return color === VIZ.series[3] || color === VIZ.ordinal[3] ? VIZ.ink : "#ffffff";
}

// ---------- number formatting ----------

const fullFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatNumber(value) {
  return fullFmt.format(Number(value || 0));
}

export function formatCompact(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim(n / 1e9)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e4) return `${trim(n / 1e3)}K`;
  return fullFmt.format(n);
}

function trim(n) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
}

export function formatPercent(part, whole) {
  if (!whole) return "0%";
  const pct = (part / whole) * 100;
  return `${pct < 10 && pct > 0 ? pct.toFixed(1).replace(/\.0$/, "") : Math.round(pct)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(key, { withYear = false } = {}) {
  const [year, month] = key.split("-");
  const name = MONTHS[Number(month) - 1] || key;
  return withYear ? `${name} ${year}` : name;
}

// Clean axis ticks: 0 and 3–5 round steps that cover the maximum.
export function niceTicks(max, target = 4) {
  if (!max || max <= 0) return [0, 1];
  const rough = max / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) || power * 10;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.0001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  // Whole-number data never gets fractional ticks.
  return step < 1 ? ticks.filter((t) => Number.isInteger(t)) : ticks;
}

// ---------- layout helpers ----------

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Rough text width for the system sans at a given size; used only to decide
// whether a label fits, never to clip one.
function textWidth(text, size = 12) {
  return String(text).length * size * 0.56;
}

// Rect with 4px rounded data end and a square baseline end.
function columnPath(x, y, w, h, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

// ---------- tooltip ----------

function Tooltip({ tip }) {
  if (!tip) return null;
  const { x, y, title, rows, width } = tip;
  const flip = width && x > width - 170;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-20 min-w-32 rounded-lg border bg-white px-3 py-2 text-xs shadow-float"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? width - x + 12 : undefined,
        top: Math.max(0, y - 8),
        borderColor: "rgba(11,11,11,0.10)"
      }}
    >
      {title ? (
        <p className="mb-1 font-medium" style={{ color: VIZ.inkSoft }}>
          {title}
        </p>
      ) : null}
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 py-0.5">
          {row.color ? (
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-3 rounded-full"
              style={{ background: row.color }}
            />
          ) : null}
          <span className="font-semibold tabular-nums" style={{ color: VIZ.ink }}>
            {row.value}
          </span>
          <span style={{ color: VIZ.inkSoft }}>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- card with chart / table toggle ----------

export function ChartCard({ title, subtitle, action, legend, table, children, className = "", busy = false }) {
  const [view, setView] = useState("chart");
  return (
    <section
      className={`rounded-2xl border bg-white p-4 shadow-card sm:p-5 ${className}`}
      style={{ borderColor: "rgba(11,11,11,0.06)" }}
      aria-busy={busy}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold" style={{ color: VIZ.ink }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs" style={{ color: VIZ.inkSoft }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table ? (
            <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: VIZ.grid }} role="group" aria-label="Show as">
              {[
                { key: "chart", Icon: BarChart3, label: "Chart" },
                { key: "table", Icon: Table2, label: "Table" }
              ].map(({ key, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  title={`Show as ${label.toLowerCase()}`}
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition ${
                    view === key ? "bg-canvas text-ink" : "text-ink-soft hover:bg-canvas/60"
                  }`}
                >
                  <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <div className={`transition-opacity ${busy ? "opacity-50" : "opacity-100"}`}>
        {view === "table" && table ? (
          <DataTable {...table} />
        ) : (
          <>
            {legend ? <Legend items={legend} /> : null}
            {children}
          </>
        )}
      </div>
    </section>
  );
}

export function Legend({ items }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: VIZ.inkSoft }}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.shape === "line" ? (
            <span aria-hidden="true" className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: item.color }} />
          ) : (
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// ---------- table view ----------

export function DataTable({ columns, rows, caption, maxHeight = 320 }) {
  return (
    <div className="overflow-auto rounded-lg border" style={{ borderColor: VIZ.grid, maxHeight }}>
      <table className="w-full border-collapse text-xs">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 bg-canvas">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 font-semibold ${column.numeric ? "text-right" : "text-left"}`}
                style={{ color: VIZ.inkSoft }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key ?? index} className="border-t" style={{ borderColor: VIZ.grid }}>
              {columns.map((column) => {
                const value = column.render ? column.render(row) : row[column.key];
                return (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-1.5 ${column.numeric ? "text-right tabular-nums" : ""}`}
                    style={{ color: VIZ.ink }}
                  >
                    {column.numeric && typeof value === "number" ? formatNumber(value) : value}
                  </td>
                );
              })}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center" style={{ color: VIZ.muted }}>
                No data for this selection.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// ---------- stat tile + hero figure ----------

export function Sparkline({ values, width = 96, height = 28 }) {
  if (!values?.length || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)]);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <path d={d} fill="none" stroke={VIZ.de} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth="2" />
    </svg>
  );
}

export function StatTile({ label, value, detail, trend, Icon }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-card" style={{ borderColor: "rgba(11,11,11,0.06)" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium" style={{ color: VIZ.inkSoft }}>
          {Icon ? <Icon size={14} className="mr-1 inline -translate-y-px" aria-hidden="true" /> : null}
          {label}
        </p>
        {trend ? (
          <span className="hidden sm:block">
            <Sparkline values={trend} width={64} height={22} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold" style={{ color: VIZ.ink }}>
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-[11px]" style={{ color: VIZ.inkSoft }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function HeroFigure({ label, value, detail, trend, trendLabel }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-card" style={{ borderColor: "rgba(11,11,11,0.06)" }}>
      <p className="text-sm font-medium" style={{ color: VIZ.inkSoft }}>
        {label}
      </p>
      <p className="mt-1 text-5xl font-semibold leading-none" style={{ color: VIZ.ink }}>
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-xs" style={{ color: VIZ.inkSoft }}>
          {detail}
        </p>
      ) : null}
      {trend ? (
        <div className="mt-4">
          <Sparkline values={trend} width={220} height={40} />
          {trendLabel ? (
            <p className="mt-1 text-[11px]" style={{ color: VIZ.muted }}>
              {trendLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------- shared axes for line and column charts ----------

const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

// Left padding wide enough for the longest tick label (e.g. "L$800K").
function padLeft(ticks, format) {
  return Math.max(28, ...ticks.map((t) => textWidth(format(t), 11) + 12));
}

function YAxis({ ticks, scaleY, width, format, left = PAD.left }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={width - PAD.right}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            stroke={tick === 0 ? VIZ.baseline : VIZ.grid}
            strokeWidth="1"
          />
          <text
            x={left - 6}
            y={scaleY(tick)}
            dy="0.32em"
            textAnchor="end"
            fontSize="11"
            fill={VIZ.muted}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({ labels, scaleX, height, band }) {
  // Thin out labels when the widest one would collide with its neighbour.
  const widest = Math.max(0, ...labels.map((label) => textWidth(label, 11)));
  const every = Math.max(1, Math.ceil((widest + 8) / Math.max(band, 1)));
  return (
    <g>
      {labels.map((label, i) =>
        i % every === 0 ? (
          <text
            key={`${label}-${i}`}
            x={scaleX(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize="11"
            fill={VIZ.muted}
          >
            {label}
          </text>
        ) : null
      )}
    </g>
  );
}

// ---------- line chart (crosshair + one tooltip for every series) ----------

export function LineChart({ labels, tooltipLabels, series, height = 220, format = formatCompact, valueFormat = formatNumber, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const left = padLeft(ticks, format);
  const endRoom = Math.max(...series.map((s) => textWidth(s.name, 11))) + 14;
  const innerW = Math.max(10, width - left - PAD.right - endRoom); // room for end labels
  const innerH = height - PAD.top - PAD.bottom;
  const n = labels.length;
  const band = n > 1 ? innerW / (n - 1) : innerW;
  const scaleX = (i) => left + (n > 1 ? i * band : innerW / 2);
  const scaleY = (v) => PAD.top + innerH - (v / top) * innerH;

  // Direct end labels only when they don't collide (otherwise legend + tooltip).
  const ends = series.map((s) => ({ s, y: scaleY(s.values[n - 1] || 0) }));
  const collide = ends.some((a, i) => ends.some((b, j) => j > i && Math.abs(a.y - b.y) < 14));
  const showEnds = series.length <= 4 && !collide && width > 0;

  function onMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - left) / (band || 1))));
    setHover(i);
  }

  const tip =
    hover !== null
      ? {
          x: scaleX(hover),
          y: PAD.top,
          width,
          title: (tooltipLabels || labels)[hover],
          rows: series.map((s) => ({ label: s.name, value: valueFormat(s.values[hover] || 0), color: s.color }))
        }
      : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(n - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
            if (event.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? 0) + 1));
          }}
          className="touch-pan-y outline-none"
        >
          <YAxis ticks={ticks} scaleY={scaleY} width={width - endRoom} format={format} left={left} />
          <XLabels labels={labels} scaleX={scaleX} height={height} band={band} />
          {series.map((s) => {
            const d = s.values.map((v, i) => `${i ? "L" : "M"}${scaleX(i).toFixed(1)},${scaleY(v || 0).toFixed(1)}`).join("");
            return (
              <g key={s.key}>
                <path d={`${d}L${scaleX(n - 1)},${scaleY(0)}L${scaleX(0)},${scaleY(0)}Z`} fill={s.color} opacity="0.08" />
                <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={scaleX(n - 1)} cy={scaleY(s.values[n - 1] || 0)} r="4" fill={s.color} stroke={VIZ.surface} strokeWidth="2" />
              </g>
            );
          })}
          {showEnds
            ? ends.map(({ s, y }) => (
                <text key={s.key} x={scaleX(n - 1) + 8} y={y} dy="0.32em" fontSize="11" fill={VIZ.inkSoft}>
                  {s.name}
                </text>
              ))
            : null}
          {hover !== null ? (
            <g>
              <line x1={scaleX(hover)} x2={scaleX(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke={VIZ.baseline} strokeWidth="1" />
              {series.map((s) => (
                <circle key={s.key} cx={scaleX(hover)} cy={scaleY(s.values[hover] || 0)} r="4" fill={s.color} stroke={VIZ.surface} strokeWidth="2" />
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- column chart (one series, per-column hover) ----------

export function ColumnChart({ labels, tooltipLabels, values, color = VIZ.series[0], height = 220, format = formatCompact, valueFormat = formatNumber, seriesName = "", ariaLabel, highlightLast = false }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...values);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const left = padLeft(ticks, format);
  const innerW = Math.max(10, width - left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const n = values.length;
  const band = innerW / Math.max(n, 1);
  const barW = Math.min(24, Math.max(4, band - 2 - band * 0.35));
  const scaleX = (i) => left + band * i + band / 2;
  const scaleY = (v) => PAD.top + innerH - (v / top) * innerH;
  const maxIndex = values.indexOf(Math.max(...values));

  const tip =
    hover !== null
      ? {
          x: scaleX(hover),
          y: scaleY(values[hover]) - 40,
          width,
          title: (tooltipLabels || labels)[hover],
          rows: [{ label: seriesName, value: valueFormat(values[hover]), color }]
        }
      : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          <YAxis ticks={ticks} scaleY={scaleY} width={width} format={format} left={left} />
          <XLabels labels={labels} scaleX={scaleX} height={height} band={band} />
          {values.map((v, i) => {
            const y = scaleY(v);
            const h = PAD.top + innerH - y;
            const muted = highlightLast && i !== n - 1;
            return (
              <g key={i}>
                <path
                  d={columnPath(scaleX(i) - barW / 2, y, barW, h)}
                  fill={muted ? VIZ.de : color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
                {/* Hit target: the whole band, taller than the mark. */}
                <rect
                  x={left + band * i}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${(tooltipLabels || labels)[i]}: ${valueFormat(v)}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
          {/* Label only the peak, on its cap. */}
          {n && values[maxIndex] > 0 && hover === null ? (
            <text x={scaleX(maxIndex)} y={scaleY(values[maxIndex]) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={VIZ.ink}>
              {format(values[maxIndex])}
            </text>
          ) : null}
        </svg>
      ) : null}
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- ranked horizontal bars ----------

export function BarList({ items, format = formatNumber, color = VIZ.series[0], highlight, max: maxOverride, emptyText = "Nothing recorded yet.", total }) {
  const [hover, setHover] = useState(null);
  const max = maxOverride ?? Math.max(1, ...items.map((item) => item.value));
  const sum = total ?? items.reduce((s, item) => s + item.value, 0);
  if (!items.length || !items.some((item) => item.value > 0)) {
    return (
      <p className="py-8 text-center text-xs" style={{ color: VIZ.muted }}>
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => {
        const pct = Math.max(0, (item.value / max) * 100);
        const fill = highlight ? (highlight === item.key ? color : VIZ.de) : item.color || color;
        return (
          <li
            key={item.key ?? item.label}
            tabIndex={0}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className={`grid grid-cols-[minmax(84px,30%)_1fr] items-center gap-3 rounded-md px-1 py-0.5 outline-none transition ${
              hover === i ? "bg-canvas" : ""
            }`}
            aria-label={`${item.label}: ${format(item.value)} (${formatPercent(item.value, sum)})`}
          >
            <span className="truncate text-xs" style={{ color: VIZ.inkSoft }} title={item.label}>
              {item.label}
            </span>
            <span className="relative block min-w-0 pr-20">
              <span
                className="relative block h-3"
                style={{
                  width: `${pct}%`,
                  minWidth: item.value > 0 ? 2 : 0,
                  background: fill,
                  borderRadius: "0 4px 4px 0"
                }}
              >
                <span
                  className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold tabular-nums"
                  style={{ color: VIZ.ink }}
                >
                  {format(item.value)}
                  {hover === i ? (
                    <span className="ml-1 font-normal" style={{ color: VIZ.muted }}>
                      {formatPercent(item.value, sum)}
                    </span>
                  ) : null}
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- tall segmented bar (one whole split into <= 6 parts) ----------

export function SegmentedBar({ parts, format = formatNumber, emptyText = "Nothing recorded yet." }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const visible = parts.filter((p) => p.value > 0);
  if (!total) {
    return (
      <p className="py-8 text-center text-xs" style={{ color: VIZ.muted }}>
        {emptyText}
      </p>
    );
  }
  const gap = 2;
  const usable = Math.max(0, width - gap * (visible.length - 1));
  let cursor = 0;
  const blocks = visible.map((p) => {
    const w = (p.value / total) * usable;
    const block = { ...p, x: cursor, w, share: formatPercent(p.value, total) };
    cursor += w + gap;
    return block;
  });
  const hovered = hover !== null ? blocks[hover] : null;

  return (
    <div>
      <div ref={ref} className="relative h-7 w-full">
        {blocks.map((b, i) => (
          <div
            key={b.label}
            tabIndex={0}
            role="img"
            aria-label={`${b.label}: ${format(b.value)} (${b.share})`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="absolute top-0 flex h-7 items-center overflow-visible rounded px-2 text-[11px] font-semibold outline-none transition"
            style={{
              left: b.x,
              width: Math.max(b.w, 2),
              background: b.color,
              color: textOn(b.color),
              opacity: hover === null || hover === i ? 1 : 0.6
            }}
          >
            {b.w >= textWidth(b.share, 11) + 16 ? b.share : null}
          </div>
        ))}
        {hovered ? (
          <Tooltip
            tip={{
              x: hovered.x + hovered.w / 2,
              y: 34,
              width,
              title: hovered.label,
              rows: [{ label: hovered.share, value: format(hovered.value), color: hovered.color }]
            }}
          />
        ) : null}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: VIZ.inkSoft }}>
        {parts.map((p) => (
          <li key={p.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.icon ? <p.icon size={12} aria-hidden="true" /> : null}
            {p.label}
            <span className="font-semibold tabular-nums" style={{ color: VIZ.ink }}>
              {format(p.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Fold a ranked list into the first `keep` items plus "Other".
export function foldOther(items, keep = 7, otherLabel = "Other") {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= keep + 1) return sorted;
  const head = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((s, item) => s + item.value, 0);
  return [...head, { key: "__other", label: otherLabel, value: rest }];
}
