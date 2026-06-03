import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getOrCreateRequestId } from "@/lib/request-id";
import { inferMediaType } from "@/lib/media-db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    await requireAdmin();
    const { mediaId } = await params;
    const mediaType = inferMediaType(mediaId);

    const [
      apiCaches,
      mediaStats,
      totalRatings,
      writtenReviews,
      deepReviews,
      watchlistInclusions,
      logs
    ] = await Promise.all([
      prisma.apiCache.findMany({
        where: { id: { startsWith: mediaId } },
        orderBy: { id: "asc" }
      }),
      prisma.mediaStats.findUnique({
        where: { id: mediaId }
      }),
      prisma.userRating.count({ where: { media_id: mediaId } }),
      prisma.userRating.count({ where: { media_id: mediaId, review_text: { not: null } } }),
      prisma.userRating.count({ where: { media_id: mediaId, is_deep_review: true } }),
      prisma.userWatchlist.count({ where: { media_id: mediaId } }),
      prisma.systemLog.findMany({
        where: { mediaId: mediaId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    ]);

    return NextResponse.json({
      tracking: {
        id: mediaId,
        type: mediaType,
      },
      caches: apiCaches,
      stats: mediaStats,
      aggregations: {
        totalRatings,
        writtenReviews,
        deepReviews,
        watchlistInclusions,
      },
      logs,
    });
  } catch (error: any) {
    await appLog({
      level: "error",
      event: "admin.api.media.get.failed",
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
