import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_DEFAULT_PAGE_SIZE } from "@/lib/admin-constants";
import { getRecentSlowOperations } from "@/lib/admin-performance";
import { parsePositiveInt } from "@/lib/admin-jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const sinceHours = searchParams.get("sinceHours");
    const data = await getRecentSlowOperations({
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), ADMIN_DEFAULT_PAGE_SIZE),
      operation: searchParams.get("operation") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      mediaId: searchParams.get("mediaId") ?? undefined,
      sinceHours: sinceHours ? parsePositiveInt(sinceHours, 24) : undefined,
    });

    await appLog({
      level: "info",
      event: "admin.performance.api.viewed",
      requestId,
      userId: admin.id,
      metadata: data.pagination,
    });

    return NextResponse.json(data);
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.performance.denied" : "admin.performance.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
