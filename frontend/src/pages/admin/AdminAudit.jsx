import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorBanner, PageLoading, Select } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { api } from "../../lib/api.js";

const PAGE_SIZE = 25;

const ACTIONS = [
  { value: "", label: "All actions" },
  { value: "farmer.list_viewed", label: "Farmer list opened" },
  { value: "farmer.detail_viewed", label: "Farmer record opened" },
  { value: "farmer.phone_revealed", label: "Phone number shown" },
  { value: "farmer.updated", label: "Farmer profile changed" },
  { value: "farmer.deactivated", label: "Farmer deactivated" },
  { value: "farmer.reactivated", label: "Farmer reactivated" },
  { value: "farmer.pin_reset", label: "Farmer PIN reset" },
  { value: "data_exported", label: "CSV downloaded" },
  { value: "cooperative.viewed", label: "Cooperative opened" },
  { value: "cooperative.list_viewed", label: "Cooperative list opened" },
  { value: "audit.viewed", label: "Audit log opened" }
];

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export default function AdminAudit() {
  const { token } = useAuth();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [action]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (action) params.set("action", action);
    try {
      const result = await api.get(`/api/admin/audit?${params.toString()}`, { token });
      setData(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, action]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Audit log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every admin action and every time a farmer record was opened. This page is read-only;
          entries cannot be changed or deleted.
        </p>
      </div>

      <div className="max-w-xs">
        <Select aria-label="Filter by action" value={action} onChange={(event) => setAction(event.target.value)}>
          {ACTIONS.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>

      {loading && !data ? (
        <PageLoading label="Loading audit log…" />
      ) : total === 0 ? (
        <div className="mt-5">
          <EmptyState icon={ScrollText} title="No entries yet" description="Admin activity will appear here." />
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink-soft">
            {total} {total === 1 ? "entry" : "entries"}
          </p>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">From</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-soft">{when(entry.createdAt)}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-ink">{entry.adminName}</td>
                    <td className="px-3 py-2 text-xs">
                      {ACTIONS.find((item) => item.value === entry.action)?.label || entry.action}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {entry.targetType}
                      {entry.targetId ? ` · ${String(entry.targetId).slice(0, 8)}…` : ""}
                      {entry.action === "data_exported" && entry.metadata?.rowCount !== undefined ? (
                        <span className="block">{entry.metadata.rowCount} rows</span>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-ink">{entry.reason || "—"}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{entry.ipAddress || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <p className="text-xs text-ink-soft">
              Page {page} of {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
