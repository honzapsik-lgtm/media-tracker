import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin-api";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { cancelJob } from "@/lib/jobs";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(request.headers);
  const { id } = await params;

  try {
    const admin = await requireAdmin();
    const job = await cancelJob(id, requestId);
    await appLog({
      level: "info",
      event: "admin.job.cancel",
      requestId,
      userId: admin.id,
      jobId: id,
      metadata: { type: job.type },
      persist: true,
    });
    return NextResponse.json({ ok: true, jobId: id });
  } catch (error) {
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.job.cancel_failed",
      requestId,
      jobId: id,
      error,
      persist: true,
    });
    return adminErrorResponse(error, requestId);
  }
}
