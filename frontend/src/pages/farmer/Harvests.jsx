import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader, PageLoading, StatusChip, buttonClass } from "../../components/ui.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate } from "../../lib/format.js";
import { batchStatus } from "../../lib/ledger.js";
import { GRADES, WORDS, growEmoji, unitText } from "../../lib/words.js";

export const BATCH_STATE_WORDS = {
  in_store: { ...WORDS.inStore, tone: "bg-sky-100 text-sky-800" },
  part_sold: { ...WORDS.partSold, tone: "bg-amber-100 text-amber-800" },
  sold_out: { ...WORDS.soldOut, tone: "bg-slate-200 text-slate-700" }
};

export default function Harvests() {
  const { farms, records, loading } = useFarmerData();
  if (loading && records.harvests.length === 0) return <PageLoading label="Opening your harvest…" />;

  const farmName = (clientId) => farms.find((farm) => farm.clientId === clientId)?.farmName || "Farm";

  return (
    <div>
      <PageHeader
        title={WORDS.harvestTitle.text}
        subtitle="Each harvest is one batch. Touch it to check, sell or show buyers."
        say={WORDS.harvestTitle}
        action={
          <Link to="/app/harvests/new" data-say={WORDS.addHarvest.say} className={buttonClass("primary", "sm", "shrink-0")}>
            <Plus size={16} /> {WORDS.addHarvest.text}
          </Link>
        }
      />

      {records.harvests.length === 0 ? (
        <EmptyState
          title={WORDS.noHarvest.text}
          description="When you bring crops from the farm, put them here."
          action={
            <Link to="/app/harvests/new" className={buttonClass("primary", "md")}>
              🧺 {WORDS.addHarvest.text}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {records.harvests.map((harvest) => {
            const status = batchStatus(harvest, records.sales, records.inspections);
            const state = BATCH_STATE_WORDS[status.state];
            const grade = status.grade ? GRADES[status.grade] : null;
            return (
              <Link
                key={harvest.clientId}
                to={`/app/harvests/${harvest.clientId}`}
                data-say={`${harvest.crop}. ${harvest.quantity} ${unitText(harvest.unit)}. ${state.say} ${grade ? grade.say : ""}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
              >
                <span className="text-4xl" aria-hidden="true">
                  {growEmoji(harvest.crop)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-base font-bold text-ink">
                      {harvest.crop} · {harvest.quantity} {unitText(harvest.unit)}
                    </p>
                    {grade && (
                      <span className="shrink-0 text-xl" title={grade.text} aria-label={grade.text}>
                        {grade.emoji}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft">
                    {farmName(harvest.farmClientId)} · {formatDate(harvest.harvestDate)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.tone}`}>
                      {state.text}
                      {status.state === "part_sold" ? ` · ${status.remaining} ${WORDS.left.text.toLowerCase()}` : ""}
                    </span>
                    {harvest.syncStatus && harvest.syncStatus !== "synced" && <StatusChip status={harvest.syncStatus} />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
