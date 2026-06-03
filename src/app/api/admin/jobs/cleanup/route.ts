import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { cleanupCompletedJobs } from "@/lib/jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({})) as { olderThanDays?: number };
    const olderThanDays = body.olderThanDays && body.olderThanDays > 0 ? body.olderThanDays : 30;
    const deletedCount = await cleanupCompletedJobs({ olderThanDays, requestId });
    await appLog({
      level: "info",
      event: "admin.job.cleanup",
      requestId,
      userId: admin.id,
      metadata: { olderThanDays, deletedCount },
      persist: true,
    });
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.job.cleanup_failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
