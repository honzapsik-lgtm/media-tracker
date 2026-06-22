import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const result = await prisma.activityLog.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate,
        },
      },
    });

    await appLog({
      level: "info",
      event: "cron.cleanup_activity_log.success",
      requestId,
      metadata: { deletedCount: result.count, cutoffDate: cutoffDate.toISOString() },
      persist: true,
    });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    await appLog({
      level: "error",
      event: "cron.cleanup_activity_log.error",
      requestId,
      error,
      persist: true,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
