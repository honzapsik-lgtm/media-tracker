import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { PERF_WARN_THRESHOLD_MS } from "@/lib/admin-constants";
import { enqueueJob } from "@/lib/jobs";
import { timeOperation } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getOrCreateRequestId } from "@/lib/request-id";
import {
  calculateCriteriaAverages,
  inferMediaType,
  refreshMediaStats,
} from "@/lib/media-db";

type RatingBody = {
  mediaId?: string;
  mediaType?: string;
  score?: number;
  isDeepReview?: boolean;
  criteriaScores?: Record<string, number>;
  mediaTitle?: string;
  mediaImage?: string | null;
  mediaReleaseDate?: string | null;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId");

  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const [personal, globalRows] = await Promise.all([
    session?.user?.id
      ? prisma.userRating.findUnique({
          where: { user_id_media_id: { user_id: session.user.id, media_id: mediaId } },
          select: { score: true, is_deep_review: true, criteria_scores: true },
        })
      : null,
    prisma.userRating.findMany({
      where: { media_id: mediaId, is_deep_review: true },
      select: { criteria_scores: true },
    }),
  ]);

  return NextResponse.json({
    personal,
    globalCriteriaAverages: calculateCriteriaAverages(globalRows),
  });
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to rate media." }, { status: 401 });
  }

  const body = (await request.json()) as RatingBody;
  if (!body.mediaId || typeof body.score !== "number") {
    return NextResponse.json({ error: "mediaId and score are required" }, { status: 400 });
  }

  const mediaId = body.mediaId;
  const score = body.score;
  const mediaType = body.mediaType || inferMediaType(mediaId);
  const criteriaScores = body.isDeepReview ? body.criteriaScores ?? {} : {};

  const totalMetadata = {
    mediaId,
    mediaType,
    isDeepReview: body.isDeepReview ?? false,
    hasReviewText: false,
    source: "ratings.POST",
  };

  await timeOperation({
    event: "rating.mutation.total",
    requestId,
    userId: session.user.id,
    mediaId,
    mediaType,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: totalMetadata,
  }, async () => {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });

    await timeOperation({
      event: "rating.upsert",
      requestId,
      userId: session.user.id,
      mediaId,
      mediaType,
      slowThresholdMs: PERF_WARN_THRESHOLD_MS,
      metadata: totalMetadata,
    }, () => prisma.userRating.upsert({
      where: { user_id_media_id: { user_id: session.user.id, media_id: mediaId } },
      update: {
        score,
        is_deep_review: body.isDeepReview ?? false,
        criteria_scores: criteriaScores as Prisma.InputJsonValue,
        media_title: body.mediaTitle,
        media_image: body.mediaImage ?? null,
        media_release_date: body.mediaReleaseDate ?? null,
        username: user?.name ?? user?.email?.split("@")[0] ?? "Anonymous",
        avatar_url: user?.image ?? null,
      },
      create: {
        user_id: session.user.id,
        media_id: mediaId,
        score,
        is_deep_review: body.isDeepReview ?? false,
        criteria_scores: criteriaScores as Prisma.InputJsonValue,
        media_title: body.mediaTitle,
        media_image: body.mediaImage ?? null,
        media_release_date: body.mediaReleaseDate ?? null,
        username: user?.name ?? user?.email?.split("@")[0] ?? "Anonymous",
        avatar_url: user?.image ?? null,
      },
    }));

    await timeOperation({
      event: "rating.refresh_media_stats",
      requestId,
      userId: session.user.id,
      mediaId,
      mediaType,
      slowThresholdMs: PERF_WARN_THRESHOLD_MS,
      metadata: totalMetadata,
    }, () => refreshMediaStats(mediaId, mediaType));
    revalidatePath(`/media/${mediaId}`);

    await Promise.all([
      enqueueJob({
        type: "award_badges",
        payload: { userId: session.user.id, reason: "rating_saved" },
        requestId,
      }),
      enqueueJob({
        type: "update_user_stats",
        payload: { userId: session.user.id, mediaType, reason: "rating_saved" },
        dedupeKey: `update_user_stats:${session.user.id}`,
        requestId,
      }),
    ]);
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId");
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const mediaType = inferMediaType(mediaId);

  await timeOperation({
    event: "rating.delete.total",
    requestId,
    userId: session.user.id,
    mediaId,
    mediaType,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: { source: "ratings.DELETE", mediaId, mediaType },
  }, async () => {
    await prisma.userRating.deleteMany({
      where: { user_id: session.user.id, media_id: mediaId },
    });

    await refreshMediaStats(mediaId, mediaType);
    revalidatePath(`/media/${mediaId}`);

    await enqueueJob({
      type: "update_user_stats",
      payload: { userId: session.user.id, mediaType, reason: "rating_deleted" },
      dedupeKey: `update_user_stats:${session.user.id}`,
      requestId,
    });
  });

  return NextResponse.json({ ok: true });
}

