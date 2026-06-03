import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs";
import { inferMediaType } from "@/lib/media-db";
import { prisma } from "@/lib/prisma";
import { getOrCreateRequestId } from "@/lib/request-id";

type WatchlistBody = {
  mediaId?: string;
  title?: string;
  image?: string | null;
  type?: string;
  status?: string;
};

async function queueUserStatsUpdate(
  userId: string,
  mediaId: string,
  requestId: string,
  mediaType?: string | null
) {
  await enqueueJob({
    type: "update_user_stats",
    payload: {
      userId,
      mediaType: mediaType || inferMediaType(mediaId),
      reason: "watchlist_changed",
    },
    dedupeKey: `update_user_stats:${userId}`,
    requestId,
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ results: [], count: 0 });

  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId");

  if (mediaId) {
    const item = await prisma.userWatchlist.findUnique({
      where: { user_id_media_id: { user_id: session.user.id, media_id: mediaId } },
      select: { status: true },
    });
    return NextResponse.json({ status: item?.status ?? null });
  }

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const { getUserWatchlist } = await import("@/lib/media-db");
  const data = await getUserWatchlist(session.user.id, Math.max(1, page), Math.max(1, limit));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to track media." }, { status: 401 });
  }

  const body = (await request.json()) as WatchlistBody;
  if (!body.mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const mediaType = body.type || inferMediaType(body.mediaId);
  const item = await prisma.userWatchlist.upsert({
    where: { user_id_media_id: { user_id: session.user.id, media_id: body.mediaId } },
    update: {
      media_title: body.title,
      media_image: body.image ?? null,
      media_type: mediaType,
      status: body.status ?? "plan_to_watch",
    },
    create: {
      user_id: session.user.id,
      media_id: body.mediaId,
      media_title: body.title,
      media_image: body.image ?? null,
      media_type: mediaType,
      status: body.status ?? "plan_to_watch",
    },
  });

  await queueUserStatsUpdate(session.user.id, body.mediaId, requestId, mediaType);

  return NextResponse.json(item);
}

export async function PATCH(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json()) as WatchlistBody;
  if (!body.mediaId || !body.status) {
    return NextResponse.json({ error: "mediaId and status are required" }, { status: 400 });
  }

  const item = await prisma.userWatchlist.update({
    where: { user_id_media_id: { user_id: session.user.id, media_id: body.mediaId } },
    data: { status: body.status },
  });

  await queueUserStatsUpdate(session.user.id, item.media_id, requestId, item.media_type);

  return NextResponse.json(item);
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

  const existingItem = await prisma.userWatchlist.findUnique({
    where: { user_id_media_id: { user_id: session.user.id, media_id: mediaId } },
    select: { media_type: true },
  });

  const result = await prisma.userWatchlist.deleteMany({
    where: { user_id: session.user.id, media_id: mediaId },
  });

  if (result.count > 0) {
    await queueUserStatsUpdate(session.user.id, mediaId, requestId, existingItem?.media_type);
  }

  return NextResponse.json({ ok: true });
}

