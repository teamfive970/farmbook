import { ArrowDownRight, ArrowUpRight, Info, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatMoney } from "../lib/ledger.js";
import { unitText } from "../lib/words.js";
import { CropIcon } from "./Choices.jsx";
import { SpeakButton } from "./Voice.jsx";
import { Button, EmptyState, ErrorBanner, Select } from "./ui.jsx";
import { COUNTIES } from "../lib/labels.js";

const ALL = "all";

function sayPrice(item) {
  const currency = item.currency === "USD" ? "US dollars" : "Liberian dollars";
  return `${item.crop}: about ${Math.round(item.median).toLocaleString("en-US")} ${currency} for one ${unitText(item.unit).replace(/s$/, "").toLowerCase()}.`;
}

// Typical prices from what FarmBok farmers recorded in the last 60 days.
// Shown only when at least a few different farmers sold that crop.
export default function MarketPrices({ defaultCounty = ALL, wide = false }) {
  const [county, setCounty] = useState(defaultCounty || ALL);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setData(null);
    api
      .get(`/api/market/prices${county === ALL ? "" : `?county=${encodeURIComponent(county)}`}`)
      .then((result) => active && (setData(result), setError("")))
      .catch((requestError) =>
        active && setError(requestError.isNetworkError ? "No network. Prices need the internet." : requestError.message)
      );
    return () => {
      active = false;
    };
  }, [county]);

  const counties = [...new Set([...(data?.counties || []), ...(county !== ALL ? [county] : [])])].sort();
  const spoken = (data?.prices || []).slice(0, 6).map(sayPrice).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <label className="flex-1" htmlFor="price-county">
          <span className="label">Where</span>
          <Select id="price-county" value={county} onChange={(event) => setCounty(event.target.value)}>
            <option value={ALL}>All of Liberia</option>
            {(counties.length ? counties : COUNTIES).map((item) => (
              <option key={item} value={item}>
                {item} County
              </option>
            ))}
          </Select>
        </label>
        {spoken && <SpeakButton phrase={{ say: spoken }} />}
      </div>

      <ErrorBanner message={error} />
      {!data && !error && <p className="py-6 text-center text-sm text-ink-soft">Loading prices…</p>}

      {data && data.prices.length === 0 && (
        <EmptyState
          icon={Tags}
          title={county === ALL ? "Not enough sales yet" : `Not enough sales in ${county} yet`}
          description={`Prices show once at least ${data.rule.minFarmers} different farmers${
            county === ALL ? "" : ` in ${county}`
          } have recorded sales of a crop in the last ${data.days} days.`}
          action={
            county !== ALL && (
              <Button variant="secondary" onClick={() => setCounty(ALL)}>
                See prices for all of Liberia
              </Button>
            )
          }
        />
      )}

      {data && data.prices.length > 0 && (
        <ul className={wide ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
          {data.prices.map((item) => {
            const up = item.changePercent > 0;
            return (
              <li
                key={`${item.crop}-${item.unit}-${item.currency}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
                data-say={sayPrice(item)}
              >
                <CropIcon name={item.crop} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {item.crop} <span className="text-sm font-medium text-ink-soft">· per {unitText(item.unit).replace(/s$/, "").toLowerCase()}</span>
                  </p>
                  <p className="text-xl font-bold tabular-nums text-ink">{formatMoney(item.median, item.currency)}</p>
                  <p className="text-xs text-ink-soft">
                    Usually {formatMoney(item.low, item.currency)} – {formatMoney(item.high, item.currency)} · {item.sales} sales by{" "}
                    {item.farmers} farmers
                  </p>
                </div>
                {item.changePercent !== null && item.changePercent !== 0 && (
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs font-bold ${
                      up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                    title="Compared with the 60 days before"
                  >
                    {up ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                    {Math.abs(item.changePercent)}%
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && (
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          From sales FarmBok farmers recorded in the last {data.days} days. A price shows only when at least{" "}
          {data.rule.minFarmers} different farmers sold that crop, so no one farmer's price can be seen. A guide, not an
          official price.
        </p>
      )}
    </div>
  );
}
