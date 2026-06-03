import { NextResponse } from "next/server";
import { processWorkerBatch } from "@/app/api/worker/route";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const admin = await requireAdmin();
    await appLog({
      level: "info",
      event: "admin.job.process_requested",
      requestId,
      userId: admin.id,
      persist: true,
    });
    const result = await processWorkerBatch({ requestId });
    return NextResponse.json(result);
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.job.process_failed",
      requestId,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
