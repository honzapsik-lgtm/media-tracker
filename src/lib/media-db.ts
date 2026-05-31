import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ProfileMediaItem {
  mediaId: string;
  score: number;
  reviewText: string | null;
  title: string;
  image: string | null;
  type: string;
  rankPosition: number | null;
}

export function inferMediaType(mediaId: string) {
  const parts = mediaId.split("-");
  if (parts[0] === "tmdb") return parts[1] === "movie" ? "movie" : "show";
  if (parts[0] === "rawg") return "game";
  if (parts[0] === "manga") return "manga";
  return "unknown";
}

export function formatProfileRating(row: {
  media_id: string;
  media_title: string | null;
  media_image: string | null;
  score: number;
  review_text: string | null;
  rank_position: number | null;
}): ProfileMediaItem {
  const type = inferMediaType(row.media_id).toUpperCase();

  return {
    mediaId: row.media_id,
    score: row.score,
    reviewText: row.review_text,
    title: row.media_title || `Unknown Title (${row.media_id})`,
    image: row.media_image,
    type,
    rankPosition: row.rank_position,
  };
}

export async function refreshMediaStats(mediaId: string, mediaType = inferMediaType(mediaId)) {
  const aggregate = await prisma.userRating.aggregate({
    where: { media_id: mediaId },
    _avg: { score: true },
    _count: { score: true },
  });

  const average = aggregate._avg.score == null ? 0 : Math.round(aggregate._avg.score);
  const count = aggregate._count.score;

  await prisma.mediaStats.upsert({
    where: { id: mediaId },
    update: {
      media_type: mediaType,
      community_average: new Prisma.Decimal(average),
      total_ratings: count,
    },
    create: {
      id: mediaId,
      media_type: mediaType,
      community_average: new Prisma.Decimal(average),
      total_ratings: count,
    },
  });
}

export async function getMediaStats(mediaId: string) {
  const stats = await prisma.mediaStats.findUnique({ where: { id: mediaId } });

  return stats
    ? {
        community_average: stats.community_average ? Number(stats.community_average) : 0,
        total_ratings: stats.total_ratings ?? 0,
      }
    : null;
}

export async function getMediaStatsMap(mediaIds: string[]) {
  if (mediaIds.length === 0) return {};

  const stats = await prisma.mediaStats.findMany({
    where: { id: { in: mediaIds } },
    select: { id: true, community_average: true },
  });

  return Object.fromEntries(
    stats.map((item) => [
      item.id,
      item.community_average ? Number(item.community_average) : 0,
    ])
  );
}

export async function getListRank(mediaId: string) {
  const mediaType = inferMediaType(mediaId);
  const ranked = await getRankedMedia(mediaType, "list_rank", 1, 500);
  const item = ranked.results.find((entry) => entry.media_id === mediaId);
  return item?.list_rank ?? null;
}

export async function getListRankMap(mediaIds: string[]) {
  const rankMap: Record<string, number> = {};
  const byType = new Map<string, string[]>();

  mediaIds.forEach((id) => {
    const type = inferMediaType(id);
    byType.set(type, [...(byType.get(type) ?? []), id]);
  });

  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const ranked = await getRankedMedia(type, "list_rank", 1, 500);
      ranked.results.forEach((item) => {
        if (ids.includes(item.media_id) && item.list_rank) {
          rankMap[item.media_id] = item.list_rank;
        }
      });
    })
  );

  return rankMap;
}

export async function getDeepCriteriaRows(mediaId: string) {
  return prisma.userRating.findMany({
    where: { media_id: mediaId, is_deep_review: true },
    select: { criteria_scores: true },
  });
}

export function calculateCriteriaAverages(rows: { criteria_scores: Prisma.JsonValue | null }[]) {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  rows.forEach((row) => {
    const scores = row.criteria_scores;
    if (!scores || typeof scores !== "object" || Array.isArray(scores)) return;

    Object.entries(scores).forEach(([key, value]) => {
      if (typeof value === "number") {
        sums[key] = (sums[key] || 0) + value;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
  });

  return Object.fromEntries(
    Object.entries(sums).map(([key, sum]) => [key, Math.round(sum / counts[key])])
  );
}

export async function awardBadges(userId: string) {
  const ratings = await prisma.userRating.findMany({
    where: { user_id: userId },
    select: { score: true, media_id: true },
  });

  const badgeIds = new Set<string>();
  const gameCount = ratings.filter((rating) => inferMediaType(rating.media_id) === "game").length;
  const mangaCount = ratings.filter((rating) => inferMediaType(rating.media_id) === "manga").length;

  if (ratings.length >= 10) badgeIds.add("ratings_10");
  if (ratings.length >= 50) badgeIds.add("ratings_50");
  if (ratings.length >= 100) badgeIds.add("ratings_100");
  if (gameCount >= 10) badgeIds.add("games_10");
  if (mangaCount >= 10) badgeIds.add("manga_10");
  if (ratings.some((rating) => rating.score <= 20)) badgeIds.add("void_stare");
  if (ratings.some((rating) => rating.score === 100)) badgeIds.add("masterpiece");

  await Promise.all(
    [...badgeIds].map((badgeId) =>
      prisma.userBadge.upsert({
        where: { user_id_badge_id: { user_id: userId, badge_id: badgeId } },
        update: {},
        create: { user_id: userId, badge_id: badgeId },
      })
    )
  );
}

export async function getRankedMedia(
  mediaType: string,
  sort: string,
  page: number,
  limit: number
) {
  const skip = (page - 1) * limit;
  const where = { media_type: mediaType };

  const [stats, totalCount] = await Promise.all([
    prisma.mediaStats.findMany({
      where,
      orderBy:
        sort === "popular"
          ? [{ total_ratings: "desc" }, { community_average: "desc" }]
          : [{ community_average: "desc" }, { total_ratings: "desc" }],
      skip,
      take: limit,
    }),
    prisma.mediaStats.count({ where }),
  ]);

  const ratings = await prisma.userRating.findMany({
    where: { media_id: { in: stats.map((item) => item.id) } },
    orderBy: [{ rank_position: "asc" }, { score: "desc" }],
    select: {
      media_id: true,
      media_title: true,
      media_image: true,
      rank_position: true,
      score: true,
    },
  });

  const byMedia = new Map<string, typeof ratings>();
  ratings.forEach((rating) => {
    byMedia.set(rating.media_id, [...(byMedia.get(rating.media_id) ?? []), rating]);
  });

  const listScores = stats.map((stat) => {
    const mediaRatings = byMedia.get(stat.id) ?? [];
    const rankedRatings = mediaRatings.filter((rating) => rating.rank_position != null);
    const averageRank =
      rankedRatings.length > 0
        ? rankedRatings.reduce((sum, rating) => sum + (rating.rank_position ?? 0), 0) /
          rankedRatings.length
        : null;
    const representative = mediaRatings[0];

    return {
      media_id: stat.id,
      media_type: stat.media_type,
      title: representative?.media_title ?? stat.id,
      image: representative?.media_image ?? null,
      community_average: stat.community_average ? Number(stat.community_average) : 0,
      total_ratings: stat.total_ratings ?? 0,
      average_rank: averageRank,
      list_rank: null as number | null,
    };
  });

  const sorted =
    sort === "list_rank"
      ? listScores
          .filter((item) => item.average_rank != null)
          .sort((a, b) => (a.average_rank ?? Number.MAX_SAFE_INTEGER) - (b.average_rank ?? Number.MAX_SAFE_INTEGER))
      : listScores;

  sorted.forEach((item, index) => {
    item.list_rank = item.average_rank == null ? null : index + 1;
  });

  return {
    results: sorted,
    count: totalCount,
  };
}

