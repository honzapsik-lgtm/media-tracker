import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { getCacheSummary, getPaginatedCacheEntries, parseBooleanFilter } from "@/lib/admin-cache";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_CACHE_CLEANUP_CONFIRM_TEXT, ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { parsePositiveInt } from "@/lib/admin-jobs";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

function formatAge(seconds: number | null) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "page") search.set(key, value);
  });
  search.set("page", String(page));
  return `/admin/cache?${search.toString()}`;
}

export default async function AdminCachePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const requestId = createRequestId();
  let admin = null;
  let deniedCode: string | null = null;

  try {
    admin = await requireAdmin();
  } catch (error) {
    deniedCode = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.cache.page.denied",
      requestId,
      error,
      persist: true,
    });
  }

  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-8 text-white">
        <div className="max-w-md rounded-lg border border-gray-800 bg-gray-900 p-8 text-center shadow-xl">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-red-400">Access denied</p>
          <h1 className="mb-3 text-3xl font-black">Admin only</h1>
          <p className="text-sm text-gray-400">{deniedCode}</p>
        </div>
      </main>
    );
  }

  const page = parsePositiveInt(params.page, 1);
  const pageSize = Math.min(parsePositiveInt(params.pageSize, ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
  const lastRefreshed = new Date();
  const [summary, data] = await Promise.all([
    getCacheSummary(),
    getPaginatedCacheEntries({
      page,
      pageSize,
      q: params.q,
      type: params.type,
      provider: params.provider,
      expired: parseBooleanFilter(params.expired),
      sort: params.sort,
    }),
  ]);

  await appLog({
    level: "info",
    event: "admin.cache.viewed",
    requestId,
    userId: admin.id,
    metadata: data.pagination,
  });

  const pageCount = data.pagination.pageCount;
  const summaryCards = [
    ["Total entries", summary.totalEntries],
    ["Fresh entries", summary.freshEntries],
    ["Expired entries", summary.expiredEntries],
    ["Oldest expired age", formatAge(summary.oldestExpiredAgeSeconds)],
  ];

  return (
    <main className="min-h-screen bg-gray-950 px-8 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-black">Provider Cache</h1>
            <p className="text-gray-400">Inspect ApiCache entries and remove expired provider cache rows.</p>
            <p className="mt-2 text-sm text-gray-500">Last refreshed: {lastRefreshed.toLocaleString()}</p>
          </div>
          <form action="/api/admin/cache/cleanup" method="post" className="min-w-full space-y-2 lg:min-w-80">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
              Confirmation
              <input
                name="confirm"
                placeholder={ADMIN_CACHE_CLEANUP_CONFIRM_TEXT}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
              />
            </label>
            <button className="rounded bg-red-600 px-5 py-2 text-sm font-black text-white hover:bg-red-500">
              Delete expired cache
            </button>
          </form>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
              <p className="text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 font-black">By Provider</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(summary.byProvider).length === 0 ? (
                <span className="text-gray-500">No entries</span>
              ) : (
                Object.entries(summary.byProvider).map(([provider, count]) => (
                  <span key={provider} className="rounded border border-gray-700 px-3 py-1 text-gray-300">
                    {provider}: <b className="text-white">{count}</b>
                  </span>
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 font-black">By Type</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(summary.byType).length === 0 ? (
                <span className="text-gray-500">No entries</span>
              ) : (
                Object.entries(summary.byType).map(([type, count]) => (
                  <span key={type} className="rounded border border-gray-700 px-3 py-1 text-gray-300">
                    {type}: <b className="text-white">{count}</b>
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        <form className="mb-8 grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 md:grid-cols-4">
          {["q", "type", "provider"].map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
              {field}
              <input
                name={field}
                defaultValue={params[field] ?? ""}
                className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
            expired
            <select
              name="expired"
              defaultValue={params.expired ?? ""}
              className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
            >
              <option value="">Any</option>
              <option value="true">Expired</option>
              <option value="false">Fresh</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
            sort
            <select
              name="sort"
              defaultValue={params.sort ?? "created_desc"}
              className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
            >
              <option value="created_desc">Created desc</option>
              <option value="created_asc">Created asc</option>
              <option value="expires_desc">Expires desc</option>
              <option value="expires_asc">Expires asc</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
            pageSize
            <input
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
            />
          </label>
          <div className="flex items-end gap-2 md:col-span-4">
            <button className="rounded bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-500">Filter</button>
            <Link href="/admin/cache" className="rounded border border-gray-700 px-5 py-2 text-sm font-bold text-gray-300 hover:text-white">Reset</Link>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[1100px] border-collapse bg-gray-950 text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                {["Key", "Type", "Provider", "Expired", "Expires At", "Created", "Updated", "Payload Size"].map((header) => (
                  <th key={header} className="border-b border-gray-800 px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No cache entries match these filters. Search and discover pages will repopulate ApiCache as provider data is requested.</td></tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-900 align-top">
                    <td className="max-w-md px-4 py-3 font-bold text-gray-200 break-all">{item.key}</td>
                    <td className="px-4 py-3 text-gray-400">{item.type}</td>
                    <td className="px-4 py-3 text-gray-400">{item.provider}</td>
                    <td className="px-4 py-3">
                      <AdminBadge value={item.expired ? "expired" : "fresh"} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.expiresAt.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{item.createdAt.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{item.updatedAt.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{formatBytes(item.payloadSizeBytes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
          <span>Page {page} of {pageCount} - {data.pagination.total} total</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(params, page - 1)} className="rounded border border-gray-700 px-4 py-2 font-bold hover:text-white">Previous</Link>}
            {page < pageCount && <Link href={pageHref(params, page + 1)} className="rounded border border-gray-700 px-4 py-2 font-bold hover:text-white">Next</Link>}
          </div>
        </div>
      </div>
    </main>
  );
}
