import { NextResponse } from "next/server";
import { adminErrorResponse, confirmationRequiredResponse, hasConfirmation, readAdminPostBody } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { ADMIN_JOB_CLEANUP_CONFIRM_TEXT, ADMIN_STUCK_JOB_MINUTES } from "@/lib/admin-constants";
import { markStuckJobsFailed } from "@/lib/jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const body = await readAdminPostBody(request) as { olderThanMinutes?: number | string };
    if (!hasConfirmation(body, ADMIN_JOB_CLEANUP_CONFIRM_TEXT)) {
      await appLog({
        level: "warn",
        event: "admin.job.mark_stuck_failed_confirmation_missing",
        requestId,
        userId: admin.id,
        persist: true,
      });
      return confirmationRequiredResponse(requestId);
    }

    const requestedMinutes = Number(body.olderThanMinutes);
    const olderThanMinutes = Number.isFinite(requestedMinutes) && requestedMinutes > 0
      ? requestedMinutes
      : ADMIN_STUCK_JOB_MINUTES;
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
