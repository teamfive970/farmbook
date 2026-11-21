import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusChip } from "./ui.jsx";
import { farmMeta, formatFarmSize } from "../lib/labels.js";
import { farmCrops } from "../lib/farmCrops.js";

export default function FarmCard({ farm }) {
  const meta = farmMeta(farm.farmType);
  return (
    <Link
      to={`/app/farms/${farm.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line/80 bg-white p-4 shadow-card transition hover:border-primary/30"
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
        <meta.Icon size={22} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{farm.farmName}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-soft">
          <MapPin size={12} className="shrink-0" />
          {farm.community}, {farm.county}
        </p>
        <p className="mt-1 text-[11px] font-medium text-primary">
          {meta.label} · {farm.activityCount ?? 0}{" "}
          {farm.activityCount === 1 ? "work" : "work"}
          {formatFarmSize(farm) ? ` · ${formatFarmSize(farm)}` : ""}
        </p>
        {farmCrops(farm).length > 0 && (
          <p className="mt-0.5 truncate text-[11px] text-ink-soft">{farmCrops(farm).join(", ")}</p>
        )}
        {farm.syncStatus && farm.syncStatus !== "synced" && (
          <div className="mt-1.5">
            <StatusChip status={farm.syncStatus} />
          </div>
        )}
      </div>
      <ChevronRight size={18} className="text-ink-soft" aria-hidden="true" />
    </Link>
  );
}
