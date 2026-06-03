import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { runDatabaseIntegrityChecks } from "@/lib/admin-database";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    const checks = await runDatabaseIntegrityChecks();

    await appLog({
      level: "info",
      event: "admin.database.checks_run",
      requestId,
      userId: admin.id,
      metadata: { count: checks.length },
      persist: true,
    });

    return NextResponse.json({ items: checks });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: error instanceof AdminAuthError ? "admin.database.checks.denied" : "admin.database.checks.failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
