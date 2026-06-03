import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { refreshMediaStats } from "@/lib/media-db";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const adminUser = await requireAdmin();
    const { mediaId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "clear-cache") {
      const result = await prisma.apiCache.deleteMany({
        where: { id: { startsWith: mediaId } }
      });

      await appLog({
        level: "info",
        event: "admin.action",
        requestId,
        userId: adminUser.id,
        metadata: {
          action: "clear-cache",
          targetMediaId: mediaId,
          deletedCount: result.count,
        },
        persist: true,
      });

      return NextResponse.json({ success: true, deletedCount: result.count });
    }

    if (action === "refresh-stats") {
      await refreshMediaStats(mediaId);

      await appLog({
        level: "info",
        event: "admin.action",
        requestId,
        userId: adminUser.id,
        metadata: {
          action: "refresh-stats",
          targetMediaId: mediaId,
        },
        persist: true,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    await appLog({
      level: "error",
      event: "admin.api.media.actions.failed",
      requestId,
      error,
      persist: true,
    });

    if (error.code === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
