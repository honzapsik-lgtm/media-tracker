import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AdminNav } from "@/app/admin/admin-nav";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { appLog, sanitizeLogMetadata } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function buildWhere(params: Record<string, string | undefined>): Prisma.SystemLogWhereInput {
  const level = params.level?.trim();
  const event = params.event?.trim();
  const requestId = params.requestId?.trim();
  const userId = params.userId?.trim();
  const mediaId = params.mediaId?.trim();
  const jobId = params.jobId?.trim();
  const q = params.q?.trim();

  return {
    ...(level ? { level } : {}),
    ...(event ? { event: { contains: event } } : {}),
    ...(requestId ? { requestId } : {}),
    ...(userId ? { userId } : {}),
    ...(mediaId ? { mediaId } : {}),
    ...(jobId ? { jobId } : {}),
    ...(q
      ? {
          OR: [
            { event: { contains: q } },
            { message: { contains: q } },
            { errorName: { contains: q } },
            { errorMessage: { contains: q } },
          ],
        }
      : {}),
  };
}

function pageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "page") search.set(key, value);
  });
  search.set("page", String(page));
  return `/admin/logs?${search.toString()}`;
}

export default async function AdminLogsPage({
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
      event: "admin.logs.page.denied",
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

  const page = parsePositiveInt(params.page, 1);
  const pageSize = Math.min(parsePositiveInt(params.pageSize, ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
  const lastRefreshed = new Date();
  const where = buildWhere(params);

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.systemLog.count({ where }),
  ]);

  await appLog({
    level: "info",
    event: "admin.logs.viewed",
    requestId,
    userId: admin.id,
    metadata: { page, pageSize },
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-gray-950 px-8 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-black">System Logs</h1>
          <p className="text-gray-400">
            Operational events for admin access, health checks, future worker jobs, cache activity, and slow operations.
          </p>
          <p className="mt-2 text-sm text-gray-500">Last refreshed: {lastRefreshed.toLocaleString()}</p>
        </div>

        <form className="mb-8 grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 md:grid-cols-4">
          {["level", "event", "requestId", "userId", "mediaId", "jobId", "q"].map((field) => (
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
            <button className="rounded bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-500">
              Filter
            </button>
            <Link href="/admin/logs" className="rounded border border-gray-700 px-5 py-2 text-sm font-bold text-gray-300 hover:text-white">
              Reset
            </Link>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[1200px] border-collapse bg-gray-950 text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                {["Created", "Level", "Event", "Message", "Request ID", "User ID", "Media ID", "Job ID", "Duration"].map((header) => (
                  <th key={header} className="border-b border-gray-800 px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No logs match these filters. Broaden the filters or trigger an admin action to create a diagnostic event.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const metadata =
                    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
                      ? sanitizeLogMetadata(log.metadata as Record<string, unknown>)
                      : log.metadata;

                  return (
                  <tr key={log.id} className="border-b border-gray-900 align-top">
                    <td className="px-4 py-3 text-gray-400">{log.createdAt.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <AdminBadge value={log.level} />
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-200">{log.event}</td>
                    <td className="max-w-sm px-4 py-3 text-gray-300">
                      <div>{log.message ?? "-"}</div>
                      {(log.errorName || log.errorMessage || metadata) && (
                        <div className="mt-2 rounded bg-gray-900 p-2 text-xs text-gray-500">
                          {log.errorName && <div>{log.errorName}: {log.errorMessage}</div>}
                          {metadata != null && <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(metadata, null, 2)}</pre>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{log.requestId ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {log.userId ? (
                        <Link href={`/admin/users/${log.userId}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                          {log.userId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {log.mediaId ? (
                        <Link href={`/admin/media/${log.mediaId}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                          {log.mediaId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{log.jobId ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{log.durationMs != null ? `${log.durationMs}ms` : "-"}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
          <span>Page {page} of {pageCount} - {total} total</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(params, page - 1)} className="rounded border border-gray-700 px-4 py-2 font-bold hover:text-white">
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link href={pageHref(params, page + 1)} className="rounded border border-gray-700 px-4 py-2 font-bold hover:text-white">
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
