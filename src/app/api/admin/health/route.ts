import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import {
  AdminAuthError,
  requireAdmin,
} from "@/lib/admin-auth";
import { appLog, timeOperation } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    return await timeOperation({
      event: "admin.health.checked",
      requestId,
      userId: admin.id,
      persist: true,
    }, async () => NextResponse.json({ ok: true, admin: true }));
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.health.denied" : "admin.health.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
