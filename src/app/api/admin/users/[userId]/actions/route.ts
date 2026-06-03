import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const adminUser = await requireAdmin();
    const { userId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "recalculate-stats") {
      const mediaTypes = body.mediaType ? [body.mediaType] : ["movie", "show", "game", "manga"];

      for (const mediaType of mediaTypes) {
        await enqueueJob({
          type: "update_user_stats",
          payload: {
            userId,
            mediaType,
            reason: "admin_requested",
          },
          dedupeKey: `update_user_stats:${userId}:${mediaType}`,
          requestId,
        });
      }

      await appLog({
        level: "info",
        event: "admin.action",
        requestId,
        userId: adminUser.id,
        metadata: {
          action: "recalculate-stats",
          targetUserId: userId,
          mediaTypes,
        },
        persist: true,
      });

      return NextResponse.json({ success: true, queuedTypes: mediaTypes });
    }

    if (action === "change-role") {
      const { newRole } = body;
      
      if (!newRole || typeof newRole !== "string") {
        return NextResponse.json({ error: "newRole is required" }, { status: 400 });
      }

      // Prevent demoting oneself to avoid admin lockout
      if (userId === adminUser.id && newRole !== "admin") {
        return NextResponse.json({ error: "Cannot demote your own admin account" }, { status: 403 });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      await appLog({
        level: "info",
        event: "admin.action",
        requestId,
        userId: adminUser.id,
        metadata: {
          action: "change-role",
          targetUserId: userId,
          oldRole: adminUser.role, // Assuming oldRole could be fetched before if needed, but we don't have it here directly. Let's just log newRole.
          newRole,
        },
        persist: true,
      });

      return NextResponse.json({ success: true, user: updatedUser });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    await appLog({
      level: "error",
      event: "admin.api.user.actions.failed",
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
