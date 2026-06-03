import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { getDatabaseSummary, runDatabaseIntegrityChecks } from "@/lib/admin-database";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

export default async function AdminDatabasePage() {
  const requestId = createRequestId();
  let admin = null;
  let deniedCode: string | null = null;

  try {
    admin = await requireAdmin();
  } catch (error) {
    deniedCode = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.database.page.denied",
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

  const [summary, checks] = await Promise.all([
    getDatabaseSummary(),
    runDatabaseIntegrityChecks(),
  ]);
  const lastRefreshed = new Date();
  const warningCount = checks.filter((check) => check.severity !== "ok").length;

  await appLog({
    level: "info",
    event: "admin.database.viewed",
    requestId,
    userId: admin.id,
  });

  const summaryCards = [
    ["Users", summary.users],
    ["Ratings", summary.ratings],
    ["Watchlist entries", summary.watchlistEntries],
    ["Media stats", summary.mediaStats],
    ["User stats cache", summary.userStatsCache],
    ["Api cache", summary.apiCache],
    ["System logs", Object.values(summary.systemLogsByLevel).reduce((sum, count) => sum + count, 0)],
    ["Background jobs", Object.values(summary.backgroundJobsByStatus).reduce((sum, count) => sum + count, 0)],
  ];

  return (
    <main className="min-h-screen bg-gray-950 px-8 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-black">Database Checks</h1>
          <p className="text-gray-400">These checks are read-only and help identify inconsistent derived data.</p>
          <p className="mt-2 text-sm text-gray-500">Last refreshed: {lastRefreshed.toLocaleString()}</p>
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
            <h2 className="mb-3 font-black">Background Jobs By Status</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(summary.backgroundJobsByStatus).length === 0 ? (
                <span className="text-gray-500">No jobs</span>
              ) : (
                Object.entries(summary.backgroundJobsByStatus).map(([status, count]) => (
                  <span key={status} className="rounded border border-gray-700 px-3 py-1 text-gray-300">
                    {status}: <b className="text-white">{count}</b>
                  </span>
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 font-black">System Logs By Level</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(summary.systemLogsByLevel).length === 0 ? (
                <span className="text-gray-500">No logs</span>
              ) : (
                Object.entries(summary.systemLogsByLevel).map(([level, count]) => (
                  <span key={level} className="rounded border border-gray-700 px-3 py-1 text-gray-300">
                    {level}: <b className="text-white">{count}</b>
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        {warningCount === 0 && (
          <div className="mb-8 rounded-lg border border-green-500/30 bg-green-900/20 px-4 py-3 text-sm font-bold text-green-300">
            All integrity checks passed. No warnings or errors were found in derived data checks.
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[1000px] border-collapse bg-gray-950 text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                {["Status", "Check", "Count", "Detail", "Link"].map((header) => (
                  <th key={header} className="border-b border-gray-800 px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.id} className="border-b border-gray-900 align-top">
                  <td className="px-4 py-3">
                    <AdminBadge value={check.severity} />
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-200">{check.label}</td>
                  <td className="px-4 py-3 text-gray-400">{check.count}</td>
                  <td className="px-4 py-3 text-gray-300">{check.detail}</td>
                  <td className="px-4 py-3">
                    {check.href ? (
                      <Link href={check.href} className="font-bold text-blue-400 hover:text-blue-300">Open</Link>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
