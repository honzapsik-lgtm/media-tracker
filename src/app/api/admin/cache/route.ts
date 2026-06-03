import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_DEFAULT_PAGE_SIZE } from "@/lib/admin-constants";
import { getPaginatedCacheEntries, parseBooleanFilter } from "@/lib/admin-cache";
import { parsePositiveInt } from "@/lib/admin-jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const data = await getPaginatedCacheEntries({
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), ADMIN_DEFAULT_PAGE_SIZE),
      q: searchParams.get("q") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      provider: searchParams.get("provider") ?? undefined,
      expired: parseBooleanFilter(searchParams.get("expired")),
      sort: searchParams.get("sort") ?? undefined,
    });

    await appLog({
      level: "info",
      event: "admin.cache.api.viewed",
      requestId,
      userId: admin.id,
      metadata: data.pagination,
    });

    return NextResponse.json(data);
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.cache.denied" : "admin.cache.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
