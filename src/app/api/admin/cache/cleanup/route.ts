import { NextResponse } from "next/server";
import { adminErrorResponse, confirmationRequiredResponse, hasConfirmation, readAdminPostBody } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { cleanupExpiredCache } from "@/lib/admin-cache";
import { ADMIN_CACHE_CLEANUP_CONFIRM_TEXT } from "@/lib/admin-constants";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const body = await readAdminPostBody(request);
    if (!hasConfirmation(body, ADMIN_CACHE_CLEANUP_CONFIRM_TEXT)) {
      await appLog({
        level: "warn",
        event: "admin.cache.cleanup_confirmation_missing",
        requestId,
        userId: admin.id,
        persist: true,
      });
      return confirmationRequiredResponse(requestId);
    }

    const deletedCount = await cleanupExpiredCache({ requestId, userId: admin.id });

    await appLog({
      level: "info",
      event: "admin.cache.cleanup",
      requestId,
      userId: admin.id,
      metadata: { deletedCount },
      persist: true,
    });

    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.cache.cleanup_denied" : "admin.cache.cleanup_failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
