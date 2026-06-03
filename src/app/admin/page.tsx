import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { getAdminOverview } from "@/lib/admin-overview";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

function formatAge(seconds: number | null) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export default async function AdminPage() {
  const requestId = createRequestId();
  let admin = null;
  let deniedCode: string | null = null;

  try {
    admin = await requireAdmin();
  } catch (error) {
    deniedCode = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.page.denied",
      requestId,
      error,
      persist: true,
    });
  }

  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-8 text-white">
        <div className="max-w-md rounded-lg border border-gray-800 bg-gray-900 p-8 text-center shadow-xl">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-red-400">
            Access denied
          </p>
          <h1 className="mb-3 text-3xl font-black">Admin only</h1>
          <p className="text-sm text-gray-400">{deniedCode}</p>
        </div>
      </main>
    );
  }

  const overview = await getAdminOverview();
  const lastRefreshed = new Date();

  await appLog({
    level: "info",
    event: "admin.overview.viewed",
    requestId,
    userId: admin.id,
  });

  const latestError = overview.logs.latestErrorLogs[0];

  return (
    <main className="min-h-screen bg-gray-950 text-white px-8 pb-16 pt-24">
      <div className="mx-auto max-w-6xl">
        <AdminNav />
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-400">
          Internal
        </p>
        <h1 className="mb-3 text-4xl font-black">Admin</h1>
        <p className="text-gray-400">Internal diagnostics console</p>
        <p className="mb-10 mt-2 text-sm text-gray-500">Last refreshed: {lastRefreshed.toLocaleString()}</p>

        <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
          Signed in as{" "}
          <span className="font-bold text-white">{admin.name || admin.email || admin.id}</span>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/jobs" className="rounded-lg border border-blue-500/40 bg-blue-900/20 p-5 transition-colors hover:border-blue-400">
            <h2 className="mb-4 font-black text-gray-100">Background Jobs</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Pending</dt><dd className="font-bold">{overview.jobs.pending}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Processing</dt><dd className="font-bold">{overview.jobs.processing}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Failed</dt><dd className="font-bold text-red-300">{overview.jobs.failed}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Stuck</dt><dd className="font-bold text-amber-300">{overview.jobs.stuckProcessing}</dd></div>
            </dl>
          </Link>

          <Link href="/admin/logs" className="rounded-lg border border-blue-500/40 bg-blue-900/20 p-5 transition-colors hover:border-blue-400">
            <h2 className="mb-4 font-black text-gray-100">System Logs</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Errors last hour</dt><dd className="font-bold text-red-300">{overview.logs.errorsLastHour}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Warnings last hour</dt><dd className="font-bold text-amber-300">{overview.logs.warningsLastHour}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Errors 24h</dt><dd className="font-bold">{overview.logs.errorsLast24Hours}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Latest error</dt><dd className="font-bold">{latestError ? latestError.createdAt.toLocaleString() : "-"}</dd></div>
            </dl>
          </Link>

          <Link href="/admin/cache" className="rounded-lg border border-blue-500/40 bg-blue-900/20 p-5 transition-colors hover:border-blue-400">
            <h2 className="mb-4 font-black text-gray-100">Provider Cache</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Total entries</dt><dd className="font-bold">{overview.cache.totalEntries}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Expired</dt><dd className="font-bold text-amber-300">{overview.cache.expiredEntries}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Fresh</dt><dd className="font-bold text-green-300">{overview.cache.freshEntries}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Oldest expired</dt><dd className="font-bold">{formatAge(overview.cache.oldestExpiredAgeSeconds)}</dd></div>
            </dl>
          </Link>

          <Link href="/admin/database" className="rounded-lg border border-blue-500/40 bg-blue-900/20 p-5 transition-colors hover:border-blue-400">
            <h2 className="mb-4 font-black text-gray-100">Database</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Users</dt><dd className="font-bold">{overview.database.users}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Ratings</dt><dd className="font-bold">{overview.database.ratings}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Watchlist</dt><dd className="font-bold">{overview.database.watchlistEntries}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Media stats</dt><dd className="font-bold">{overview.database.mediaStatsRows}</dd></div>
            </dl>
          </Link>
        </div>

        <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-xl font-black">Warnings</h2>
          {overview.warnings.length === 0 ? (
            <p className="rounded border border-green-500/30 bg-green-900/20 px-4 py-3 text-sm font-bold text-green-300">
              No active warnings. Jobs, logs, cache, and database checks are not reporting obvious issues.
            </p>
          ) : (
            <div className="space-y-3">
              {overview.warnings.map((warning) => (
                <Link
                  key={`${warning.label}-${warning.href}`}
                  href={warning.href}
                  className={`block rounded border px-4 py-3 text-sm ${
                    warning.severity === "error"
                      ? "border-red-500/40 bg-red-900/20 text-red-200"
                      : "border-amber-500/40 bg-amber-900/20 text-amber-200"
                  }`}
                >
                  <span className="mb-2 flex items-center gap-2 font-black">
                    <AdminBadge value={warning.severity} />
                    {warning.label}
                  </span>
                  <span className="text-gray-300">{warning.detail}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-xl font-black">Latest Errors</h2>
          {overview.logs.latestErrorLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No recent errors found. Use System Logs if you need to inspect warnings or informational events.</p>
          ) : (
            <div className="space-y-3">
              {overview.logs.latestErrorLogs.map((log) => (
                <Link key={log.id} href={`/admin/logs?level=error&q=${encodeURIComponent(log.event)}`} className="block rounded border border-gray-800 bg-gray-950 px-4 py-3 text-sm hover:border-red-500/40">
                  <span className="block font-bold text-gray-100">{log.event}</span>
                  <span className="text-gray-500">{log.errorMessage || log.message || "No message"} - {log.createdAt.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        </div>
    </main>
  );
}
