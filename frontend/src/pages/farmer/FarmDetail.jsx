import { ClipboardList, CloudOff, CloudUpload, MapPin, Pencil, Plus, Sprout } from "lucide-react";
import { WORDS, growOption } from "../../lib/words.js";
import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ActivityItem from "../../components/ActivityItem.jsx";
import { MapBox } from "../../components/FarmMap.jsx";
import {
  Button,
  EmptyState,
  PageHeader,
  PageLoading,
  StatusChip,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { farmCrops } from "../../lib/farmCrops.js";
import { ICONS } from "../../lib/icons.js";
import { FARM_TYPES, farmMeta, formatFarmSize } from "../../lib/labels.js";
import { farmCategory, farmSupportsAnimals, farmSupportsCrops } from "../../lib/farmTypes.js";
import { animalCount, productionTitle, productionsForFarm } from "../../lib/production.js";
import { formatDate } from "../../lib/format.js";
import { CropIcon } from "../../components/Choices.jsx";
import { farmMoney, formatMoney, periodFor, sayMoney } from "../../lib/ledger.js";

export default function FarmDetail() {
  const { farmId } = useParams();
  const { farms, activities, records, farmIdMap, loading } = useFarmerData();
  const { online, retryFarm } = useSync();
  const navigate = useNavigate();

  const resolvedFarmId = farmIdMap[farmId] || farmId;
  const farm = farms.find((item) => item.id === resolvedFarmId);
  // This year's money for this farm: income from its harvests minus its costs.
  const money = useMemo(
    () => (farm ? farmMoney(records, periodFor("year")).filter((row) => row.farmClientId === farm.clientId) : []),
    [farm, records]
  );

  useEffect(() => {
    if (farmId !== resolvedFarmId) {
      navigate(`/app/farms/${resolvedFarmId}`, { replace: true });
    }
  }, [farmId, resolvedFarmId, navigate]);

  if (loading && !farm) return <PageLoading label="Loading farm…" />;

  if (!farm) {
    return (
      <div>
        <PageHeader title="Farm not found" backTo="/app/farms" />
        <EmptyState
          icon={Sprout}
          title="This farm is not available"
          description="It may have been added on another device. Reconnect and try again."
          action={
            <Link to="/app/farms" className={buttonClass("secondary", "md")}>
              Back to my farms
            </Link>
          }
        />
      </div>
    );
  }

  const meta = farmMeta(farm.farmType);
  const farmActivities = activities.filter((activity) => activity.farmId === farm.id);
  const farmProductions = productionsForFarm(farm, records.productions);
  const category = farmCategory(farm.farmType);
  const typeLabel = (type) => FARM_TYPES.find((item) => item.value === type)?.label || type;
  const syncStatus = farm.syncStatus || "synced";

  return (
    <div className="desk-flow lg:grid lg:grid-cols-12 lg:items-start lg:gap-4">
      <PageHeader
        className="lg:col-span-12 desk-span"
        title={farm.farmName}
        subtitle={`${meta.label} · ${farmActivities.length} ${
          farmActivities.length === 1 ? "record" : "records"
        }`}
        backTo="/app/farms"
        action={
          <Link to={`/app/farms/${farm.id}/edit`} className={buttonClass("secondary", "sm", "shrink-0")}>
            <Pencil size={14} /> Edit
          </Link>
        }
      />

      {syncStatus !== "synced" && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 lg:col-span-12 desk-span ${
            syncStatus === "failed"
              ? "border-danger/25 bg-danger/5"
              : "border-warning/30 bg-warning/10"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {syncStatus === "failed" ? (
              <CloudOff size={18} className="text-danger" />
            ) : (
              <CloudUpload size={18} className="text-amber-700" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={syncStatus} />
            </div>
            <p
              className={`mt-1 text-xs leading-snug ${
                syncStatus === "failed" ? "text-danger" : "text-amber-800/90"
              }`}
            >
              {syncStatus === "failed"
                ? farm.syncError || "This farm could not be saved to your account."
                : online
                  ? "This farm is being sent to your account."
                  : "This farm is saved on this phone. It will sync when you have internet."}
            </p>
            {syncStatus === "failed" && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => retryFarm(farm)}
              >
                Try again
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-card lg:col-span-5">
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
            <meta.Icon size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{meta.label}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
              <MapPin size={14} className="shrink-0" />
              {farm.community}, {farm.district}, {farm.county}
            </p>
            {formatFarmSize(farm) && (
              <p className="mt-1 text-sm font-semibold text-ink" data-say={`The farm is ${formatFarmSize(farm)}.`}>
                <ICONS.size size={14} className="mr-1 inline" aria-hidden="true" />
                {formatFarmSize(farm)}
              </p>
            )}
          </div>
        </div>
        {farm.location ? (
          <div className="mt-4 space-y-2">
            <MapBox location={farm.location} className="h-36" />
            <p className="text-xs text-ink-soft">
              {farm.showOnMap ? "Buyers see the farm area (about 1 km) on your Harvest Passport." : "Only you see this. Buyers do not see it."}
            </p>
          </div>
        ) : (
          <Link to={`/app/farms/${farm.id}/edit`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary" data-say="Save where your farm is.">
            <MapPin size={16} aria-hidden="true" /> Save the farm location
          </Link>
        )}

        {farmCrops(farm).length > 0 ? (
          <div className="mt-4" data-say={`This farm has ${farmCrops(farm).join(", ")}.`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">What this farm grows or raises</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {farmCrops(farm).map((name) => {
                const option = growOption(name);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-dark"
                  >
                    <option.Icon size={14} aria-hidden="true" /> {name}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <Link
            to={`/app/farms/${farm.id}/edit`}
            className="mt-4 block rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800"
            data-say="Add what this farm grows, so you can put its harvest."
          >
            Add what this farm grows, so you can put its harvest.
          </Link>
        )}

        {farm.description && (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{farm.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to={`/app/harvests/new?farm=${encodeURIComponent(farm.clientId || farm.id)}`}
            data-say={WORDS.addHarvest.say}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 text-sm font-bold text-amber-900"
          >
            <ICONS.harvest size={18} aria-hidden="true" /> {WORDS.addHarvest.text}
          </Link>
          <Link
            to={`/app/money/spend?farm=${encodeURIComponent(farm.clientId || farm.id)}`}
            data-say={WORDS.spend.say}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 text-sm font-bold text-rose-900"
          >
            <ICONS.expense size={18} aria-hidden="true" /> {WORDS.spend.text}
          </Link>
        </div>
      </div>

      {farmSupportsCrops(farm.farmType) && (
        <ProductionList
          title={WORDS.cropsHere}
          items={farmProductions.filter((item) => item.productionKind === "crop")}
          events={records.animalEvents}
          addTo={`/app/farms/${farm.id}/productions/new?kind=crop`}
          addWords={WORDS.startCrop}
          AddIcon={ICONS.planting}
          empty="Put each crop you plant, so its work, harvest and money stay together."
          className="lg:col-span-7 lg:mt-0"
        />
      )}
      {farmSupportsAnimals(farm.farmType) && (
        <ProductionList
          title={WORDS.animalsHere}
          items={farmProductions.filter((item) => item.productionKind === "animal")}
          events={records.animalEvents}
          addTo={`/app/farms/${farm.id}/productions/new?kind=animal`}
          addWords={WORDS.addAnimals}
          AddIcon={ICONS.animals}
          empty="Put each group of animals, so you can count them and see their money."
          className="lg:col-span-7 lg:mt-0"
        />
      )}
      {category !== "mixed" && (
        <Link
          to={`/app/farms/${farm.id}/productions/new?kind=${category === "crop" ? "animal" : "crop"}`}
          className="mt-3 block rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm font-semibold text-ink-soft lg:col-span-5 lg:mt-0"
          data-say={category === "crop" ? "You keep animals here too? Make it a mixed farm." : "You plant crops here too? Make it a mixed farm."}
        >
          {category === "crop" ? "Keep animals here too?" : "Plant crops here too?"} Make it a mixed farm
        </Link>
      )}
      {Array.isArray(farm.typeChanges) && farm.typeChanges.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-ink-soft lg:col-span-5 lg:mt-0 lg:text-left">
          {farm.typeChanges
            .map((change) => `Changed from ${typeLabel(change.fromType)} to ${typeLabel(change.toType)} on ${formatDate(String(change.changedAt).slice(0, 10))}`)
            .join(" · ")}
          . Old records are kept.
        </p>
      )}

      {money.length > 0 && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-card lg:col-span-7 lg:mt-0">
          <h2 className="text-sm font-bold text-ink" data-say="This farm's money this year.">
            This farm's money this year
          </h2>
          {money.map((row) => (
            <div key={row.currency} className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-canvas p-2.5" data-say={`Income ${sayMoney(row.income, row.currency)}.`}>
                <ICONS.income size={16} className="mx-auto text-ink-soft" aria-hidden="true" />
                <p className="text-[11px] text-ink-soft">{WORDS.totalIncome.text}</p>
                <p className="text-sm font-bold text-success">{formatMoney(row.income, row.currency)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-2.5" data-say={`Costs ${sayMoney(row.spent, row.currency)}.`}>
                <ICONS.expense size={16} className="mx-auto text-ink-soft" aria-hidden="true" />
                <p className="text-[11px] text-ink-soft">{WORDS.totalExpenses.text}</p>
                <p className="text-sm font-bold text-rose-700">{formatMoney(row.spent, row.currency)}</p>
              </div>
              <div
                className={`rounded-xl p-2.5 ${row.profit >= 0 ? "bg-success/10" : "bg-danger/10"}`}
                data-say={`${row.profit >= 0 ? "Profit" : "Loss"} ${sayMoney(Math.abs(row.profit), row.currency)}.`}
              >
                {row.profit >= 0 ? (
                  <ICONS.profit size={16} className="mx-auto text-success" aria-hidden="true" />
                ) : (
                  <ICONS.loss size={16} className="mx-auto text-danger" aria-hidden="true" />
                )}
                <p className="text-[11px] text-ink-soft">{row.profit >= 0 ? WORDS.profit.text : WORDS.loss.text}</p>
                <p className={`text-sm font-bold ${row.profit >= 0 ? "text-success" : "text-danger"}`}>
                  {formatMoney(Math.abs(row.profit), row.currency)}
                </p>
              </div>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-ink-soft">
            {money.map((row) => `Sales ${formatMoney(row.sold, row.currency)}`).join(" · ")} from this farm's harvests.
            Profit is income − costs for this farm.
          </p>
        </section>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-12 lg:mt-0">
        <Link to={`/app/record?farmId=${farm.id}`} className={buttonClass("primary", "md", "w-full")}>
          <Plus size={16} /> Record activity
        </Link>
        <Link to="/app/history" className={buttonClass("secondary", "md", "w-full")}>
          <ClipboardList size={16} /> All records
        </Link>
      </div>

      <section className="mt-6 lg:col-span-12 desk-span lg:mt-0">
        <h2 className="mb-3 text-base font-bold text-ink">Recent work on this farm</h2>
        {farmActivities.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No activity yet"
            description="Record the first activity for this farm."
            action={
              <Link to={`/app/record?farmId=${farm.id}`} className={buttonClass("primary", "md")}>
                <Plus size={16} /> Record activity
              </Link>
            }
          />
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {farmActivities.slice(0, 10).map((activity) => (
              <ActivityItem key={activity.clientId} activity={activity} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Crops on this farm / Animals on this farm. Finished ones fold away.
function ProductionList({ title, items, events, addTo, addWords, AddIcon, empty, className = "" }) {
  const active = items.filter((item) => item.status !== "finished");
  const finished = items.filter((item) => item.status === "finished");
  const row = (item) => (
    <li key={item.clientId}>
      <Link
        to={`/app/productions/${encodeURIComponent(item.clientId)}`}
        className="flex items-center gap-3 py-2.5"
        data-say={productionTitle(item)}
      >
        <CropIcon name={item.name} size={20} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink">{productionTitle(item)}</span>
          <span className="block text-xs text-ink-soft">
            {item.productionKind === "crop" ? "Planted" : "Since"} {formatDate(item.startDate)}
            {item.plot ? ` · ${item.plot}` : ""}
          </span>
        </span>
        {item.productionKind === "animal" && (
          <span className="text-right">
            <span className="block text-lg font-bold text-ink">{animalCount(item, events)}</span>
            <span className="block text-[10px] text-ink-soft">{WORDS.countNow.text}</span>
          </span>
        )}
      </Link>
    </li>
  );
  return (
    <section className={`mt-4 rounded-2xl bg-white p-4 shadow-card ${className}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink" data-say={title.say}>
          {title.text}
        </h2>
        <Link to={addTo} className={buttonClass("primary", "sm", "shrink-0")} data-say={addWords.say}>
          <AddIcon size={14} aria-hidden="true" /> {addWords.text}
        </Link>
      </div>
      {active.length === 0 && finished.length === 0 && <p className="py-2 text-sm text-ink-soft">{empty}</p>}
      <ul className="divide-y divide-line">{active.map(row)}</ul>
      {finished.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer py-2 text-xs font-semibold text-ink-soft" data-say={WORDS.finished.say}>
            {WORDS.finished.text} ({finished.length})
          </summary>
          <ul className="divide-y divide-line opacity-75">{finished.map(row)}</ul>
        </details>
      )}
    </section>
  );
}
