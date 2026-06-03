import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { getPaginatedJobs, parsePositiveInt, serializeJob } from "@/lib/admin-jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const data = await getPaginatedJobs({
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), 50),
      status: searchParams.get("status") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      dedupeKey: searchParams.get("dedupeKey") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });

    await appLog({
      level: "info",
      event: "admin.jobs.api.viewed",
      requestId,
      userId: admin.id,
      metadata: data.pagination,
    });

    return NextResponse.json({
      items: data.items.map(serializeJob),
      pagination: data.pagination,
    });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.jobs.denied" : "admin.jobs.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
