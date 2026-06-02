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
  if (parts[0] === "tmdb" && parts[1] === "movie") return "movie";
  if (parts[0] === "tmdb" && parts[1] === "tv") {
    if (parts.some((part) => part.startsWith("e"))) return "episode";
    if (parts.some((part) => part.startsWith("s"))) return "season";
    return "show";
  }
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
  const [
    totalRatingsCount,
    gameRatingsCount,
    mangaRatingsCount,
    hasVoidStare,
    hasMasterpiece
  ] = await Promise.all([
    prisma.userRating.count({ where: { user_id: userId } }),
    prisma.userRating.count({ where: { user_id: userId, media_id: { startsWith: "rawg-" } } }),
    prisma.userRating.count({ where: { user_id: userId, media_id: { startsWith: "manga-" } } }),
    prisma.userRating.findFirst({ where: { user_id: userId, score: { lte: 20 } }, select: { id: true } }),
    prisma.userRating.findFirst({ where: { user_id: userId, score: 100 }, select: { id: true } })
  ]);

  const badgeIds = new Set<string>();

  if (totalRatingsCount >= 10) badgeIds.add("ratings_10");
  if (totalRatingsCount >= 50) badgeIds.add("ratings_50");
  if (totalRatingsCount >= 100) badgeIds.add("ratings_100");
  if (gameRatingsCount >= 10) badgeIds.add("games_10");
  if (mangaRatingsCount >= 10) badgeIds.add("manga_10");
  if (hasVoidStare) badgeIds.add("void_stare");
  if (hasMasterpiece) badgeIds.add("masterpiece");

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
  type RankedMediaRow = {
    media_id: string;
    media_type: string;
    community_average: Prisma.Decimal | number | null;
    total_ratings: number | bigint | null;
    title: string | null;
    image: string | null;
    average_rank: Prisma.Decimal | number | null;
    list_rank: number | bigint | null;
  };

  const skip = (page - 1) * limit;

  // 1. Fetch total count for pagination
  const totalCount = sort === "list_rank"
    ? await prisma.$queryRaw<{count: number | bigint}[]>`
        SELECT COUNT(DISTINCT s.id) as count
        FROM media_stats s
        INNER JOIN user_ratings r ON s.id = r.media_id
        WHERE s.media_type = ${mediaType} AND r.rank_position IS NOT NULL
      `.then(res => Number(res[0].count))
    : await prisma.mediaStats.count({
        where: { media_type: mediaType },
      });

  const orderByClause = sort === "community" 
    ? Prisma.sql`ORDER BY community_average DESC NULLS LAST, total_ratings DESC NULLS LAST` 
    : sort === "popular"
    ? Prisma.sql`ORDER BY total_ratings DESC NULLS LAST, community_average DESC NULLS LAST`
    : Prisma.sql`ORDER BY list_rank ASC`;

  // 2. Perform global sort via raw SQL CTE
  const query = sort === "list_rank" 
    ? Prisma.sql`
        WITH global_rankings AS (
          SELECT 
            s.id AS media_id,
            s.media_type,
            s.community_average,
            s.total_ratings,
            MAX(r.media_title) AS title,
            MAX(r.media_image) AS image,
            AVG(r.rank_position) AS average_rank,
            RANK() OVER (
              ORDER BY 
                AVG(r.rank_position) ASC NULLS LAST, 
                s.community_average DESC NULLS LAST
            ) as list_rank
          FROM media_stats s
          LEFT JOIN user_ratings r ON s.id = r.media_id
          WHERE s.media_type = ${mediaType}
          GROUP BY s.id, s.media_type, s.community_average, s.total_ratings
          HAVING AVG(r.rank_position) IS NOT NULL
        )
        SELECT * FROM global_rankings
        ${orderByClause}
        OFFSET ${skip}
        LIMIT ${limit}
      `
    : Prisma.sql`
        WITH global_rankings AS (
          SELECT 
            s.id AS media_id,
            s.media_type,
            s.community_average,
            s.total_ratings,
            MAX(r.media_title) AS title,
            MAX(r.media_image) AS image,
            AVG(r.rank_position) AS average_rank,
            RANK() OVER (
              ORDER BY 
                AVG(r.rank_position) ASC NULLS LAST, 
                s.community_average DESC NULLS LAST
            ) as list_rank
          FROM media_stats s
          LEFT JOIN user_ratings r ON s.id = r.media_id
          WHERE s.media_type = ${mediaType}
          GROUP BY s.id, s.media_type, s.community_average, s.total_ratings
        )
        SELECT * FROM global_rankings
        ${orderByClause}
        OFFSET ${skip}
        LIMIT ${limit}
      `;

  const results = await prisma.$queryRaw<RankedMediaRow[]>(query);

  const formattedResults = results.map((row) => ({
    media_id: row.media_id,
    media_type: row.media_type,
    title: row.title ?? row.media_id,
    image: row.image ?? null,
    community_average: row.community_average ? Number(row.community_average) : 0,
    total_ratings: row.total_ratings ? Number(row.total_ratings) : 0,
    average_rank: row.average_rank ? Number(row.average_rank) : null,
    list_rank: row.list_rank ? Number(row.list_rank) : null,
  }));

  return {
    results: formattedResults,
    count: totalCount,
  };
}

export async function updateUserStatsCache(userId: string, mediaType: string) {
  // 1. Fetch user ratings to filter by mediaType
  const ratings = await prisma.userRating.findMany({
    where: { user_id: userId },
  });

  const typeRatings = ratings.filter(r => inferMediaType(r.media_id) === mediaType);

  // 2. Fetch user watchlist for this mediaType
  const watchlist = await prisma.userWatchlist.findMany({
    where: { user_id: userId, media_type: mediaType },
  });

  const total_count = typeRatings.length;
  let average_score = 0;
  let highest_score = 0;
  let lowest_score = 0;
  const score_distribution: Record<string, number> = {};
  
  // Initialize all 1-10 to 0
  for (let i = 1; i <= 10; i++) {
    score_distribution[i.toString()] = 0;
  }

  if (total_count > 0) {
    const scores = typeRatings.map(r => r.score);
    average_score = Math.round(scores.reduce((a, b) => a + b, 0) / total_count);
    highest_score = Math.max(...scores);
    lowest_score = Math.min(...scores);
    
    typeRatings.forEach(r => {
      // Grouping 1-100 scores into 1-10 buckets
      const bucket = Math.ceil(r.score / 10) || 1; 
      const key = bucket.toString();
      if (score_distribution[key] !== undefined) {
        score_distribution[key]++;
      }
    });
  }

  const status_counts = {
    completed: 0,
    watching: 0,
    plan_to_watch: 0,
    dropped: 0
  };

  watchlist.forEach(item => {
    const status = item.status || 'plan_to_watch';
    if (status_counts[status as keyof typeof status_counts] !== undefined) {
      status_counts[status as keyof typeof status_counts]++;
    }
  });

  const stats_json = {
    total_count,
    average_score,
    highest_score,
    lowest_score,
    score_distribution,
    status_counts
  };

  await prisma.userStatsCache.upsert({
    where: { user_id_media_type: { user_id: userId, media_type: mediaType } },
    update: { stats_json: stats_json as Prisma.InputJsonValue },
    create: {
      user_id: userId,
      media_type: mediaType,
      stats_json: stats_json as Prisma.InputJsonValue,
    }
  });
}

export async function getUserRatings(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [results, count] = await Promise.all([
    prisma.userRating.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.userRating.count({ where: { user_id: userId } }),
  ]);
  return { results: results.map(formatProfileRating), count };
}

export async function getUserReviews(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [results, count] = await Promise.all([
    prisma.userRating.findMany({
      where: { user_id: userId, review_text: { not: null } },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.userRating.count({ where: { user_id: userId, review_text: { not: null } } }),
  ]);
  return { results: results.map(formatProfileRating), count };
}

export async function getUserWatchlist(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [results, count] = await Promise.all([
    prisma.userWatchlist.findMany({
      where: { user_id: userId },
      orderBy: { added_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.userWatchlist.count({ where: { user_id: userId } }),
  ]);
  return { results, count };
}

export async function getUserRankedList(userId: string, mediaType: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [results, count] = await Promise.all([
    prisma.userRankedList.findMany({
      where: { user_id: userId, media_type: mediaType },
      orderBy: { rank_position: "asc" },
      skip,
      take: limit,
    }),
    prisma.userRankedList.count({ where: { user_id: userId, media_type: mediaType } }),
  ]);
  return { results, count };
}

