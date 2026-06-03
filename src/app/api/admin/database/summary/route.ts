import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { getDatabaseSummary } from "@/lib/admin-database";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const summary = await getDatabaseSummary();

    await appLog({
      level: "info",
      event: "admin.database.summary.viewed",
      requestId,
      userId: admin.id,
    });

    return NextResponse.json(summary);
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.database.summary.denied" : "admin.database.summary.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
