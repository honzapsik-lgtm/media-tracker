import { NextResponse } from "next/server";
import { MediaType, WatchlistStatus, ActivityType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { PERF_WARN_THRESHOLD_MS } from "@/lib/admin-constants";
import { authOptions } from "@/lib/auth";
import { logUserActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs";
import { inferMediaType } from "@/lib/media-db";
import { timeOperation } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getOrCreateRequestId } from "@/lib/request-id";
import { getTMDbDetails } from "@/lib/tmdb";
import { getAnilistDetails } from "@/lib/anilist";

type WatchlistBody = {
  mediaId?: string;
  title?: string;
  image?: string | null;
  type?: string;
  status?: string;

  // New metric fields
  episodesWatched?: number;
  chaptersRead?: number;
  volumesRead?: number;
  hoursPlayed?: number;
  platform?: string | null;
  watchCount?: number;
};

function mapStatus(statusStr?: string): WatchlistStatus | undefined {
  if (!statusStr) return undefined;
  const s = statusStr.toUpperCase();
  if (s === "PLAN_TO_WATCH" || s === "PLANNING") return "PLANNING";
  if (s === "WATCHING" || s === "IN_PROGRESS") return "IN_PROGRESS";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "ON_HOLD") return "ON_HOLD";
  if (s === "DROPPED") return "DROPPED";
  return undefined;
}

async function getMediaSourceOfTruth(mediaId: string): Promise<{
  episodes?: number;
  chapters?: number;
  volumes?: number;
  type: MediaType;
}> {
  const parts = mediaId.split("-");
  if (parts[0] === "tmdb") {
    const type = parts[1] === "tv" ? "SHOW" : "MOVIE";
    if (type === "SHOW") {
      const details = await getTMDbDetails(parts[2], "tv");
      const episodes = details?.seasons
        ? (details.seasons as any[])
            .filter((s: any) => s.season_number > 0)
            .reduce((sum: number, s: any) => sum + (s.episode_count || 0), 0)
        : 0;
      return { episodes, type: "SHOW" };
    } else {
      return { type: "MOVIE" };
    }
  } else if (parts[0] === "rawg" || parts[0] === "igdb") {
    return { type: "GAME" };
  } else if (parts[0] === "manga") {
    return { type: "MANGA" };
  }

  // CUID resolver
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: { seasons: true }
  });
  if (!media) {
    return { type: "OTHER" };
  }

  if (media.type === "SHOW") {
    if (media.anilistId) {
      const rawData = await getAnilistDetails(media.anilistId);
      if (rawData?.episodes) {
        return { episodes: rawData.episodes, type: "SHOW" };
      }
    }
    if (media.tmdbId) {
      const details = await getTMDbDetails(String(media.tmdbId), "tv");
      const episodes = details?.seasons
        ? (details.seasons as any[])
            .filter((s: any) => s.season_number > 0)
            .reduce((sum: number, s: any) => sum + (s.episode_count || 0), 0)
        : 0;
      return { episodes, type: "SHOW" };
    }
    if (media.seasons && media.seasons.length > 0) {
      let episodes = 0;
      for (const s of media.seasons) {
        if (Array.isArray(s.episodeData)) {
          episodes += s.episodeData.length;
        }
      }
      if (episodes > 0) return { episodes, type: "SHOW" };
    }
    return { episodes: 0, type: "SHOW" };
  } else if (media.type === "MANGA") {
    if (media.anilistId) {
      const rawData = await getAnilistDetails(media.anilistId);
      return {
        chapters: rawData?.chapters || undefined,
        volumes: rawData?.volumes || undefined,
        type: "MANGA"
      };
    }
  }

  return { type: media.type };
}

async function handleWatchlistMutation(
  userId: string,
  body: WatchlistBody,
  action: "add_or_update" | "update"
) {
  const mediaId = body.mediaId as string;
  const existing = await prisma.userWatchlist.findUnique({
    where: { user_id_media_id: { user_id: userId, media_id: mediaId } }
  });

  if (action === "update" && !existing) {
    throw new Error("Watchlist item not found");
  }

  const rawType = body.type;
  const inferredType = (typeof rawType === "string" ? rawType.toUpperCase() as MediaType : null) || inferMediaType(mediaId);

  // Status mapping
  const mappedStatus = mapStatus(body.status);

  let status = mappedStatus ?? existing?.status ?? "PLANNING";
  let episodesWatched = body.episodesWatched !== undefined ? body.episodesWatched : (existing?.episodesWatched ?? 0);
  let chaptersRead = body.chaptersRead !== undefined ? body.chaptersRead : (existing?.chaptersRead ?? 0);
  let volumesRead = body.volumesRead !== undefined ? body.volumesRead : (existing?.volumesRead ?? 0);
  let hoursPlayed = body.hoursPlayed !== undefined ? body.hoursPlayed : (existing?.hoursPlayed ?? 0.0);
  let platform = body.platform !== undefined ? body.platform : (existing?.platform ?? null);
  let watchCount = body.watchCount !== undefined ? body.watchCount : (existing?.watchCount ?? 0);
  let is_rewatching = existing?.is_rewatching ?? false;
  let is_rereading = existing?.is_rereading ?? false;
  let started_at = existing?.started_at ?? null;
  let finished_at = existing?.finished_at ?? null;

  // 1. Mutation Interception & Activity Logging
  let incrementText: string | null = null;
  if (episodesWatched > (existing?.episodesWatched ?? 0)) {
    incrementText = `Episode ${episodesWatched}`;
  } else if (chaptersRead > (existing?.chaptersRead ?? 0)) {
    incrementText = `Chapter ${chaptersRead}`;
  } else if (volumesRead > (existing?.volumesRead ?? 0)) {
    incrementText = `Volume ${volumesRead}`;
  } else if (hoursPlayed > (existing?.hoursPlayed ?? 0.0)) {
    incrementText = `${hoursPlayed} hours`;
  } else if (watchCount > (existing?.watchCount ?? 0)) {
    incrementText = `Watch ${watchCount}`;
  }

  if (incrementText) {
    await prisma.activityLog.create({
      data: {
        user_id: userId,
        media_id: mediaId,
        increment: incrementText,
      }
    });
  }

  // 2. Threshold Evaluation & Auto-Completion
  const meta = await getMediaSourceOfTruth(mediaId);
  const mediaType = meta.type || inferredType;

  if (mediaType === "SHOW" && meta.episodes && meta.episodes > 0) {
    if (episodesWatched >= meta.episodes) {
      status = "COMPLETED";
    }
  } else if (mediaType === "MANGA") {
    if (meta.chapters && meta.chapters > 0 && chaptersRead >= meta.chapters) {
      status = "COMPLETED";
    } else if (meta.volumes && meta.volumes > 0 && volumesRead >= meta.volumes) {
      status = "COMPLETED";
    }
  } else if (mediaType === "MOVIE") {
    if (watchCount >= 1) {
      status = "COMPLETED";
    }
  }

  // Auto-start when progress shifts from 0
  if (status === "PLANNING" && (episodesWatched > 0 || chaptersRead > 0 || volumesRead > 0 || hoursPlayed > 0 || watchCount > 0)) {
    status = "IN_PROGRESS";
  }

  // 3. Status Shift Side Effects
  if (status === "IN_PROGRESS" && existing?.status !== "IN_PROGRESS") {
    started_at = new Date();
  }
  if (status === "COMPLETED" && existing?.status !== "COMPLETED") {
    finished_at = new Date();
  }

  // 4. Looping Logic
  if (existing?.status === "COMPLETED") {
    const progressIncremented = 
      (episodesWatched > existing.episodesWatched) ||
      (chaptersRead > existing.chaptersRead) ||
      (volumesRead > existing.volumesRead) ||
      (hoursPlayed > existing.hoursPlayed) ||
      (watchCount > existing.watchCount);
    
    const statusBackToInProgress = (status === "IN_PROGRESS");

    if (progressIncremented || statusBackToInProgress) {
      if (mediaType === "SHOW" || mediaType === "MOVIE") {
        is_rewatching = true;
      } else if (mediaType === "MANGA") {
        is_rereading = true;
      }

      if (progressIncremented) {
        status = "IN_PROGRESS";
        started_at = new Date();
        finished_at = null;
      }
    }
  }

  // Upsert or Update
  let result;
  if (action === "add_or_update") {
    result = await prisma.userWatchlist.upsert({
      where: { user_id_media_id: { user_id: userId, media_id: mediaId } },
      update: {
        media_title: body.title,
        media_image: body.image ?? null,
        media_type: mediaType,
        status,
        episodesWatched,
        chaptersRead,
        volumesRead,
        hoursPlayed,
        platform,
        watchCount,
        is_rewatching,
        is_rereading,
        started_at,
        finished_at,
      },
      create: {
        user_id: userId,
        media_id: mediaId,
        media_title: body.title,
        media_image: body.image ?? null,
        media_type: mediaType,
        status,
        episodesWatched,
        chaptersRead,
        volumesRead,
        hoursPlayed,
        platform,
        watchCount,
        is_rewatching,
        is_rereading,
        started_at,
        finished_at,
      }
    });
  } else {
    result = await prisma.userWatchlist.update({
      where: { user_id_media_id: { user_id: userId, media_id: mediaId } },
      data: {
        status,
        episodesWatched,
        chaptersRead,
        volumesRead,
        hoursPlayed,
        platform,
        watchCount,
        is_rewatching,
        is_rereading,
        started_at,
        finished_at,
      }
    });
  }

  // Log social activity
  const finalTitle = body.title || existing?.media_title || result.media_title;
  const finalImage = body.image ?? existing?.media_image ?? result.media_image;

  if (episodesWatched > (existing?.episodesWatched ?? 0)) {
    await logUserActivity({
      userId,
      type: ActivityType.EPISODES_WATCHED,
      mediaId,
      mediaTitle: finalTitle,
      mediaImage: finalImage,
      mediaType,
      data: { episode: episodesWatched, count: episodesWatched - (existing?.episodesWatched ?? 0) },
    });
  } else if (chaptersRead > (existing?.chaptersRead ?? 0)) {
    await logUserActivity({
      userId,
      type: ActivityType.CHAPTERS_READ,
      mediaId,
      mediaTitle: finalTitle,
      mediaImage: finalImage,
      mediaType,
      data: { chapter: chaptersRead, count: chaptersRead - (existing?.chaptersRead ?? 0) },
    });
  } else if (volumesRead > (existing?.volumesRead ?? 0)) {
    await logUserActivity({
      userId,
      type: ActivityType.VOLUMES_READ,
      mediaId,
      mediaTitle: finalTitle,
      mediaImage: finalImage,
      mediaType,
      data: { volume: volumesRead, count: volumesRead - (existing?.volumesRead ?? 0) },
    });
  } else if (hoursPlayed > (existing?.hoursPlayed ?? 0.0)) {
    await logUserActivity({
      userId,
      type: ActivityType.HOURS_PLAYED,
      mediaId,
      mediaTitle: finalTitle,
      mediaImage: finalImage,
      mediaType,
      data: { hours: hoursPlayed, platform },
    });
  }

  if (status !== existing?.status) {
    await logUserActivity({
      userId,
      type: ActivityType.WATCHLIST_STATUS,
      mediaId,
      mediaTitle: finalTitle,
      mediaImage: finalImage,
      mediaType,
      data: { status, oldStatus: existing?.status || null },
    });
  }

  return result;
}

async function queueUserStatsUpdate(
  userId: string,
  mediaId: string,
  requestId: string,
  mediaType?: MediaType | null
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
    });
    return NextResponse.json(item ?? { status: null });
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

  const rawType = body.type;
  const mediaType: MediaType = (typeof rawType === "string" ? rawType.toUpperCase() as MediaType : null) || inferMediaType(body.mediaId);
  const item = await timeOperation({
    event: "watchlist.mutation",
    requestId,
    userId: session.user.id,
    mediaId: body.mediaId,
    mediaType,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: "watchlist.POST",
      action: "add_or_update",
      status: body.status ?? "PLANNING",
    },
  }, async () => {
    const item = await handleWatchlistMutation(session.user.id, body, "add_or_update");
    await queueUserStatsUpdate(session.user.id, body.mediaId as string, requestId, mediaType);
    return item;
  });

  return NextResponse.json(item);
}

export async function PATCH(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json()) as WatchlistBody;
  if (!body.mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const rawType = body.type;
  const mediaType: MediaType = (typeof rawType === "string" ? rawType.toUpperCase() as MediaType : null) || inferMediaType(body.mediaId);
  const item = await timeOperation({
    event: "watchlist.mutation",
    requestId,
    userId: session.user.id,
    mediaId: body.mediaId,
    mediaType,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: "watchlist.PATCH",
      action: "update",
    },
  }, async () => {
    const item = await handleWatchlistMutation(session.user.id, body, "update");
    return item;
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

  await timeOperation({
    event: "watchlist.mutation",
    requestId,
    userId: session.user.id,
    mediaId,
    mediaType: inferMediaType(mediaId),
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: "watchlist.DELETE",
      action: "remove",
    },
  }, async () => {
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
  });

  return NextResponse.json({ ok: true });
}
