import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { getRecentSlowOperations } from "@/lib/admin-performance";
import { parsePositiveInt } from "@/lib/admin-jobs";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

function pageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "page") search.set(key, value);
  });
  search.set("page", String(page));
  return `/admin/performance?${search.toString()}`;
}

function metadataPreview(metadata: unknown) {
  if (!metadata) return "-";
  return JSON.stringify(metadata, null, 2);
}

export default async function AdminPerformancePage({
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
      event: "admin.performance.page.denied",
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
  const sinceHours = params.sinceHours ? parsePositiveInt(params.sinceHours, 24) : undefined;
  const lastRefreshed = new Date();
  const data = await getRecentSlowOperations({
    page,
    pageSize,
    operation: params.operation,
    userId: params.userId,
    mediaId: params.mediaId,
    sinceHours,
  });

  await appLog({
    level: "info",
    event: "admin.performance.viewed",
    requestId,
    userId: admin.id,
    metadata: data.pagination,
  });

  const mostFrequent = data.summary.topOperationsLast24Hours[0];
  const pageCount = data.pagination.pageCount;
  const summaryCards = [
    ["Slow operations last hour", data.summary.lastHour],
    ["Slow operations last 24h", data.summary.last24Hours],
    ["Slowest operation last 24h", data.summary.slowestLast24Hours?.durationMs ? `${data.summary.slowestLast24Hours.durationMs}ms` : "-"],
    ["Most frequent slow operation", mostFrequent ? `${mostFrequent.operation} (${mostFrequent.count})` : "-"],
  ];

  return (
    <main className="min-h-screen bg-gray-950 px-8 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-black">Performance</h1>
          <p className="text-gray-400">Recent slow operations captured by SystemLog.</p>
          <p className="mt-2 text-sm text-gray-500">Last refreshed: {lastRefreshed.toLocaleString()}</p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
              <p className="break-words text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <form className="mb-8 grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 md:grid-cols-4">
          {["operation", "userId", "mediaId", "sinceHours"].map((field) => (
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
            pageSize
            <input
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
            />
          </label>
          <div className="flex items-end gap-2 md:col-span-4">
            <button className="rounded bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-500">Filter</button>
            <Link href="/admin/performance" className="rounded border border-gray-700 px-5 py-2 text-sm font-bold text-gray-300 hover:text-white">Reset</Link>
            <Link href="/admin/logs?event=performance.slow_operation" className="rounded border border-gray-700 px-5 py-2 text-sm font-bold text-gray-300 hover:text-white">Open Logs</Link>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[1300px] border-collapse bg-gray-950 text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                {["Created", "Operation", "Duration", "Level", "Message", "User ID", "Media ID", "Metadata"].map((header) => (
                  <th key={header} className="border-b border-gray-800 px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No slow operations match these filters. Slow operations appear here only after they cross the configured timing threshold.</td></tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-900 align-top">
                    <td className="px-4 py-3 text-gray-400">{item.createdAt.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-gray-200">{item.operation ?? "unknown"}</td>
                    <td className="px-4 py-3 text-amber-300">{item.durationMs != null ? `${item.durationMs}ms` : "-"}</td>
                    <td className="px-4 py-3"><AdminBadge value={item.level} /></td>
                    <td className="max-w-sm px-4 py-3 text-gray-300">
                      <div>{item.message ?? "-"}</div>
                      {item.requestId && (
                        <Link href={`/admin/logs?requestId=${encodeURIComponent(item.requestId)}`} className="mt-2 inline-block text-xs font-bold text-blue-400 hover:text-blue-300">
                          Open request logs
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.userId ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{item.mediaId ?? "-"}</td>
                    <td className="max-w-sm px-4 py-3 text-gray-500">
                      <pre className="whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs">{metadataPreview(item.metadata)}</pre>
                    </td>
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
