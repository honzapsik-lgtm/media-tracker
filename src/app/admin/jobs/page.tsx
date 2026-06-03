import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_JOB_CLEANUP_CONFIRM_TEXT, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { getJobSummary, getPaginatedJobs, parsePositiveInt } from "@/lib/admin-jobs";
import { JOB_STATUS } from "@/lib/jobs";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

function pageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "page") search.set(key, value);
  });
  search.set("page", String(page));
  return `/admin/jobs?${search.toString()}`;
}

export default async function AdminJobsPage({
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
      event: "admin.jobs.page.denied",
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
    getJobSummary(),
    getPaginatedJobs({
      page,
      pageSize,
      status: params.status,
      type: params.type,
      dedupeKey: params.dedupeKey,
      userId: params.userId,
      q: params.q,
    }),
  ]);

  await appLog({
    level: "info",
    event: "admin.jobs.viewed",
    requestId,
    userId: admin.id,
    metadata: data.pagination,
  });

  const pageCount = data.pagination.pageCount;
  const summaryCards = [
    ["Pending", summary.pending],
    ["Processing", summary.processing],
    ["Failed", summary.failed],
    ["Completed Last Hour", summary.completedLastHour],
    ["Oldest Pending", summary.oldestPendingAgeSeconds == null ? "-" : `${summary.oldestPendingAgeSeconds}s`],
    ["Stuck Processing", summary.stuckProcessing],
  ];

  return (
    <main className="min-h-screen bg-gray-950 px-8 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNav />

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-black">Background Jobs</h1>
            <p className="text-gray-400">Inspect, retry, cancel, and manually process background work.</p>
            <p className="mt-2 text-sm text-gray-500">Last refreshed: {lastRefreshed.toLocaleString()}</p>
          </div>
          <form action="/api/admin/jobs/process" method="post">
            <button className="rounded bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-500">
              Process Pending Jobs
            </button>
          </form>
        </div>

        <div className="mb-8 grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 lg:grid-cols-2">
          <form action="/api/admin/jobs/mark-stuck-failed" method="post" className="space-y-3">
            <div>
              <h2 className="font-black text-gray-100">Mark Stuck Jobs Failed</h2>
              <p className="text-sm text-gray-500">Bulk updates processing jobs that have been locked past the stuck-job threshold.</p>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
              Confirmation
              <input
                name="confirm"
                placeholder={ADMIN_JOB_CLEANUP_CONFIRM_TEXT}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
              />
            </label>
            <button className="rounded border border-amber-500/40 px-4 py-2 text-sm font-bold text-amber-300 hover:text-amber-200">
              Mark Stuck Failed
            </button>
          </form>
          <form action="/api/admin/jobs/cleanup" method="post" className="space-y-3">
            <div>
              <h2 className="font-black text-gray-100">Clean Up Completed Jobs</h2>
              <p className="text-sm text-gray-500">Deletes old completed and cancelled jobs only. Failed jobs are retained.</p>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
              Confirmation
              <input
                name="confirm"
                placeholder={ADMIN_JOB_CLEANUP_CONFIRM_TEXT}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-500"
              />
            </label>
            <button className="rounded border border-red-500/40 px-4 py-2 text-sm font-bold text-red-300 hover:text-red-200">
              Clean Up Jobs
            </button>
          </form>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
              <p className="text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <form className="mb-8 grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 md:grid-cols-4">
          {["status", "type", "dedupeKey", "userId", "q"].map((field) => (
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
            <Link href="/admin/jobs" className="rounded border border-gray-700 px-5 py-2 text-sm font-bold text-gray-300 hover:text-white">Reset</Link>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[1300px] border-collapse bg-gray-950 text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                {["Created", "Type", "Status", "Dedupe Key", "Attempts", "Run At", "Locked At", "Completed At", "Last Error", "Actions"].map((header) => (
                  <th key={header} className="border-b border-gray-800 px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-500">No background jobs found. Trigger a rating or watchlist update to enqueue profile-stat work, or adjust the filters.</td></tr>
              ) : (
                data.items.map((job) => (
                  <tr key={job.id} className="border-b border-gray-900 align-top">
                    <td className="px-4 py-3 text-gray-400">{job.created_at.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-gray-200">
                      <div>{job.type}</div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500">Payload</summary>
                        <pre className="mt-2 max-w-xs whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-500">{JSON.stringify(job.payload, null, 2)}</pre>
                      </details>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge value={job.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{job.dedupe_key ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{job.attempts} / {job.max_attempts}</td>
                    <td className="px-4 py-3 text-gray-500">{job.run_at.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{job.locked_at?.toLocaleString() ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{job.processed_at?.toLocaleString() ?? "-"}</td>
                    <td className="max-w-xs px-4 py-3 text-red-300">{job.last_error ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {job.status === JOB_STATUS.FAILED && (
                          <form action={`/api/admin/jobs/${job.id}/retry`} method="post">
                            <button className="rounded border border-blue-500/40 px-3 py-1 text-xs font-bold text-blue-300 hover:text-blue-200">Retry</button>
                          </form>
                        )}
                        {job.status === JOB_STATUS.PENDING && (
                          <form action={`/api/admin/jobs/${job.id}/cancel`} method="post">
                            <button className="rounded border border-red-500/40 px-3 py-1 text-xs font-bold text-red-300 hover:text-red-200">Cancel</button>
                          </form>
                        )}
                      </div>
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
