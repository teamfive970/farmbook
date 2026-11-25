import { ArrowLeft, Handshake, MapPin, QrCode, Store, Tags, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { CropIcon, GradeBadge } from "../components/Choices.jsx";
import ContactFarmer from "../components/ContactFarmer.jsx";
import MarketPrices from "../components/MarketPrices.jsx";
import { Button, EmptyState, ErrorBanner, Select } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { GRADES, unitText } from "../lib/words.js";

const ALL = "all";

// "1 piece", "5 pieces", "1 bag": the unit words are written in the plural.
function unitFor(unit, count) {
  const text = unitText(unit);
  if (count !== 1) return text;
  if (/ieces$/i.test(text)) return text.replace(/ieces$/i, "iece");
  return text.replace(/s$/i, "");
}

function HarvestCard({ item }) {
  const [contact, setContact] = useState(false);
  const place = [item.place.community, item.place.district, item.place.county].filter(Boolean).join(", ");
  return (
    <li className="flex flex-col rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <CropIcon name={item.crop} size={26} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-ink">{item.crop}</h2>
            {item.grade && <GradeBadge grade={item.grade} words={GRADES[item.grade]} size="sm" />}
          </div>
          <p className="text-sm font-semibold text-ink">
            {item.quantityLeft.toLocaleString("en-US")} {unitFor(item.unit, item.quantityLeft)} for sale
            {item.quantityLeft < item.quantity && (
              <span className="font-normal text-ink-soft"> · of {item.quantity.toLocaleString("en-US")}</span>
            )}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
            <MapPin size={13} aria-hidden="true" /> {place}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <Users size={13} aria-hidden="true" /> {item.farmer.firstName}
            {item.farmer.groups.length ? ` · ${item.farmer.groups.join(", ")}` : ""} · harvested {formatDate(item.harvestDate)}
          </p>
        </div>
      </div>
      {contact ? (
        <div className="mt-3">
          <ContactFarmer
            code={item.passportCode}
            crop={item.crop}
            unit={item.unit}
            firstName={item.farmer.firstName}
            startOpen
            onClose={() => setContact(false)}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to={`/p/${item.passportCode}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-line px-3 text-sm font-bold text-ink hover:border-primary/40"
          >
            <QrCode size={16} aria-hidden="true" /> Passport
          </Link>
          <Button onClick={() => setContact(true)}>
            <Handshake size={16} aria-hidden="true" /> Contact
          </Button>
        </div>
      )}
    </li>
  );
}

function ForSale() {
  const [filters, setFilters] = useState({ crop: ALL, county: ALL, grade: ALL });
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextPage) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(nextPage) });
      for (const [key, value] of Object.entries(filters)) if (value !== ALL) params.set(key, value);
      try {
        const result = await api.get(`/api/market/harvests?${params.toString()}`);
        setData(result);
        setItems((current) => (nextPage === 1 ? result.harvests : [...current, ...result.harvests]));
        setPage(nextPage);
        setError("");
      } catch (requestError) {
        setError(requestError.isNetworkError ? "No network. Connect to see harvests for sale." : requestError.message);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const set = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  const crops = data?.filters?.crops || [];
  const counties = data?.filters?.counties || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 lg:max-w-2xl">
        <label htmlFor="sale-crop">
          <span className="label">Crop</span>
          <Select id="sale-crop" value={filters.crop} onChange={set("crop")}>
            <option value={ALL}>All</option>
            {crops.map((crop) => (
              <option key={crop} value={crop}>
                {crop}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor="sale-county">
          <span className="label">County</span>
          <Select id="sale-county" value={filters.county} onChange={set("county")}>
            <option value={ALL}>All</option>
            {counties.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor="sale-grade">
          <span className="label">Grade</span>
          <Select id="sale-grade" value={filters.grade} onChange={set("grade")}>
            <option value={ALL}>Any</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </Select>
        </label>
      </div>
      <ErrorBanner message={error} />
      {data && (
        <p className="text-sm text-ink-soft">
          {data.total} {data.total === 1 ? "harvest" : "harvests"} for sale
        </p>
      )}
      {!data && !error && <p className="py-6 text-center text-sm text-ink-soft">Loading harvests…</p>}
      {data && items.length === 0 && (
        <EmptyState
          icon={Store}
          title="Nothing for sale here yet"
          description="Harvests show here when a farmer turns on their Harvest Passport and still has some to sell."
        />
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <HarvestCard key={item.passportCode} item={item} />
        ))}
      </ul>
      {data?.hasMore && (
        <Button variant="secondary" className="w-full lg:mx-auto lg:flex lg:w-auto" loading={loading} onClick={() => load(page + 1)}>
          Show more
        </Button>
      )}
    </div>
  );
}

// Public market: harvests FarmBok farmers have for sale (from Harvest
// Passports they turned on) and typical prices from recorded sales. Buyers
// contact a farmer through the same request as on the passport: the farmer's
// phone number is never shown.
export default function Market() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "prices" ? "prices" : "sale";
  const choose = (next) => setParams(next === "prices" ? { tab: "prices" } : {});

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Brand to="/" />
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-primary">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-ink lg:text-3xl">FarmBok market</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Harvests from Liberian farmers, with where and how they were grown. Contact a farmer in one tap.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-card sm:inline-grid sm:w-auto" role="tablist">
          {[
            { value: "sale", label: "Harvests for sale", Icon: Store },
            { value: "prices", label: "Market prices", Icon: Tags }
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => choose(value)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
                tab === value ? "bg-primary text-white" : "text-ink-soft hover:bg-canvas"
              }`}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        {tab === "sale" ? <ForSale /> : <MarketPrices wide />}
      </main>
    </div>
  );
}
