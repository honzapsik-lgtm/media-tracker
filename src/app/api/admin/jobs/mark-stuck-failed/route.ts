import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { markStuckJobsFailed } from "@/lib/jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({})) as { olderThanMinutes?: number };
    const olderThanMinutes = body.olderThanMinutes && body.olderThanMinutes > 0 ? body.olderThanMinutes : 15;
    const count = await markStuckJobsFailed({ olderThanMinutes, requestId });
    await appLog({
      level: "info",
      event: "admin.job.mark_stuck_failed",
      requestId,
      userId: admin.id,
      metadata: { olderThanMinutes, count },
      persist: true,
    });
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.job.mark_stuck_failed_failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
