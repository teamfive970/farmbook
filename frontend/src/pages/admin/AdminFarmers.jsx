import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBanner, PageLoading, Select, TextInput } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { api } from "../../lib/api.js";
import { formatPhone, initials } from "../../lib/format.js";
import { COUNTIES } from "../../lib/labels.js";

const PAGE_SIZE = 12;

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        status === "active" ? "bg-success/10 text-success" : "bg-slate-100 text-slate-600"
      }`}
    >
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminFarmers() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [county, setCounty] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, county, status]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (county) params.set("county", county);
    if (status) params.set("status", status);
    try {
      const result = await api.get(`/api/admin/farmers?${params.toString()}`, { token });
      if (id === requestId.current) {
        setData(result);
        setError("");
      }
    } catch (requestError) {
      if (id === requestId.current) setError(requestError.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token, page, debouncedSearch, county, status]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Farmers</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Search and review every farmer registered in Minders.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_160px]">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or phone number"
            aria-label="Search farmers"
            className="pl-10"
          />
        </div>
        <Select aria-label="Filter by county" value={county} onChange={(event) => setCounty(event.target.value)}>
          <option value="">All counties</option>
          {COUNTIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>

      {loading && !data ? (
        <PageLoading label="Loading farmers…" />
      ) : total === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={Users}
            title="No farmers found"
            description={
              debouncedSearch || county || status
                ? "Try a different search or filter."
                : "Farmers who register will appear here."
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink-soft">
            {total} {total === 1 ? "farmer" : "farmers"}
            {debouncedSearch ? ` matching “${debouncedSearch}”` : ""}
          </p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {data.items.map((farmer, index) => (
              <Link
                key={farmer.id}
                to={`/admin/farmers/${farmer.id}`}
                className={`flex items-center gap-3 px-4 py-4 transition hover:bg-canvas ${
                  index > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-dark">
                  {initials(farmer.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{farmer.fullName}</p>
                  <p className="truncate text-xs text-ink-soft">{formatPhone(farmer.phoneNumber)}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    {farmer.county} · {farmer.farmCount} {farmer.farmCount === 1 ? "farm" : "farms"} ·{" "}
                    {farmer.activityCount} {farmer.activityCount === 1 ? "record" : "records"}
                  </p>
                </div>
                <StatusBadge status={farmer.status} />
              </Link>
            ))}
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
