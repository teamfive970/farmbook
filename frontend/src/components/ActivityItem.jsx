import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "../lib/format.js";
import { activityMeta } from "../lib/labels.js";
import { StatusChip } from "./ui.jsx";

export default function ActivityItem({ activity, compact = false }) {
  const meta = activityMeta(activity.activityType);
  return (
    <Link
      to={`/app/activities/${activity.clientId}`}
      className="block rounded-2xl border border-line/80 bg-white p-4 shadow-card transition hover:border-primary/30"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
          <meta.Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{meta.label}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-soft">
                <MapPin size={12} className="shrink-0" />
                {activity.farmName || "Farm"}
              </p>
            </div>
            <StatusChip status={activity.syncStatus} />
          </div>
          {!compact && activity.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-ink-soft">
              {activity.description}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-soft">
            <span>{formatDate(activity.activityDate)}</span>
            <span className="inline-flex items-center gap-0.5 font-medium text-primary">
              View <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
