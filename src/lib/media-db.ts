import { Prisma, MediaType } from "@prisma/client";
import { PERF_WARN_THRESHOLD_MS } from "@/lib/admin-constants";
import { timeOperation } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs";
import { resolveAniListType } from "@/lib/anilist";

export interface ProfileMediaItem {
  mediaId: string;
  score: number;
  reviewText: string | null;
  title: string;
  image: string | null;
  type: string;
  rankPosition: number | null;
  criteriaScores?: any;
  inUserList?: boolean;
  hasRated?: boolean;
  releaseDate?: string | null;
}

export function inferMediaType(mediaId: string): MediaType {
  const parts = mediaId.split("-");
  if (parts[0] === "tmdb" && parts[1] === "movie") return "MOVIE" as MediaType;
  if (parts[0] === "tmdb" && parts[1] === "tv") return "SHOW" as MediaType;
  if (parts[0] === "rawg" || parts[0] === "igdb") return "GAME" as MediaType;
  if (parts[0] === "manga") return "MANGA" as MediaType;
  return "OTHER" as MediaType;
}

export function formatProfileRating(row: {
  media_id: string;
  media_title: string | null;
  media_image: string | null;
  score: number;
  review_text: string | null;
  rank_position: number | null;
  criteria_scores?: any;
  media_release_date?: string | null;
}): ProfileMediaItem {
  const type = inferMediaType(row.media_id);

  return {
    mediaId: row.media_id,
    score: row.score,
    reviewText: row.review_text,
    title: row.media_title || `Unknown Title (${row.media_id})`,
    image: row.media_image,
    type,
    rankPosition: row.rank_position,
    criteriaScores: row.criteria_scores,
    releaseDate: row.media_release_date,
  };
}

export async function refreshMediaStats(mediaId: string, mediaTypeParam: MediaType = inferMediaType(mediaId)) {
  let mediaType = (typeof mediaTypeParam === "string" ? mediaTypeParam.toUpperCase() : mediaTypeParam) as MediaType;
  if (mediaType === ("SEASON" as any)) mediaType = "SHOW";
  await timeOperation({
    event: "media_stats.refresh",
    mediaId,
    mediaType,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: { source: "refreshMediaStats" },
  }, async () => {
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
  const item = ranked.results.find((entry: any) => entry.media_id === mediaId);
  return item?.list_rank ?? null;
}

export async function getListRankMap(mediaIds: string[]) {
  const rankMap: Record<string, number> = {};
  const byType = new Map<any, string[]>();

  mediaIds.forEach((id) => {
    const type = inferMediaType(id);
    byType.set(type, [...(byType.get(type) ?? []), id]);
  });

  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const ranked = await getRankedMedia(type, "list_rank", 1, 500);
      ranked.results.forEach((item: any) => {
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
    prisma.userRating.count({ where: { user_id: userId, OR: [{ media_id: { startsWith: "rawg-" } }, { media_id: { startsWith: "igdb-" } }] } }),
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
  mediaTypeParam: MediaType,
  sort: string,
  page: number,
  limit: number
) {
  const mediaTypeUpper = typeof mediaTypeParam === "string" ? mediaTypeParam.toUpperCase() : mediaTypeParam;

  let dbMediaType: MediaType = "SHOW";
  if (mediaTypeUpper === "MOVIE") dbMediaType = "MOVIE";
  else if (mediaTypeUpper === "GAME") dbMediaType = "GAME";
  else if (mediaTypeUpper === "MANGA") dbMediaType = "MANGA";
  else if (mediaTypeUpper === "OTHER") dbMediaType = "OTHER";

  let typeCondition = Prisma.sql`s.media_type = ${dbMediaType}::"MediaType"`;
  if (mediaTypeUpper === "SEASON") {
    typeCondition = Prisma.sql`s.media_type = ${dbMediaType}::"MediaType" AND s.id LIKE '%-s%' AND s.id NOT LIKE '%-e%'`;
  } else if (mediaTypeUpper === "EPISODE") {
    typeCondition = Prisma.sql`s.media_type = ${dbMediaType}::"MediaType" AND s.id LIKE '%-e%'`;
  } else if (mediaTypeUpper === "SHOW") {
    typeCondition = Prisma.sql`s.media_type = ${dbMediaType}::"MediaType" AND s.id NOT LIKE '%-s%' AND s.id NOT LIKE '%-e%'`;
  }
  
  type RankedMediaRow = {
    media_id: string;
    media_type: string;
    community_average: Prisma.Decimal | number | null;
    total_ratings: number | bigint | null;
    title: string | null;
    image: string | null;
    release_date: string | null;
    average_rank: Prisma.Decimal | number | null;
    list_rank: number | bigint | null;
  };

  const skip = (page - 1) * limit;

  const { totalCount, results } = await timeOperation({
    event: "ranking.get_ranked_media",
    mediaType: mediaTypeUpper,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: "getRankedMedia",
      sortMode: sort,
      page,
      pageSize: limit,
    },
  }, async () => {
    // 1. Fetch total count for pagination
    const totalCount = sort === "list_rank"
      ? await prisma.$queryRaw<{count: number | bigint}[]>`
          SELECT COUNT(DISTINCT s.id) as count
          FROM media_stats s
          INNER JOIN global_rankings g ON s.id = g.media_id
          WHERE ${typeCondition} AND g.rank IS NOT NULL
        `.then(res => Number(res[0].count))
      : await prisma.$queryRaw<{count: number | bigint}[]>`
          SELECT COUNT(DISTINCT s.id) as count
          FROM media_stats s
          WHERE ${typeCondition}
        `.then(res => Number(res[0].count));

    const orderByClause = sort === "community" 
      ? Prisma.sql`ORDER BY community_average DESC NULLS LAST, total_ratings DESC NULLS LAST` 
      : sort === "popular"
      ? Prisma.sql`ORDER BY total_ratings DESC NULLS LAST, community_average DESC NULLS LAST`
      : Prisma.sql`ORDER BY list_rank ASC`;

    // 2. Perform global sort via raw SQL CTE
    const query = sort === "list_rank" 
      ? Prisma.sql`
          WITH global_rankings_cte AS (
            SELECT 
              s.id AS media_id,
              s.media_type,
              s.community_average,
              s.total_ratings,
              MAX(r.media_title) AS title,
              MAX(r.media_image) AS image,
              MAX(r.media_release_date) AS release_date,
              g.elo_score AS average_rank,
              g.rank as list_rank
            FROM media_stats s
            LEFT JOIN global_rankings g ON s.id = g.media_id
            LEFT JOIN user_ratings r ON s.id = r.media_id
            WHERE ${typeCondition}
            GROUP BY s.id, s.media_type, s.community_average, s.total_ratings, g.rank, g.elo_score
            HAVING g.rank IS NOT NULL
          )
          SELECT * FROM global_rankings_cte
          ${orderByClause}
          OFFSET ${skip}
          LIMIT ${limit}
        `
      : Prisma.sql`
          WITH global_rankings_cte AS (
            SELECT 
              s.id AS media_id,
              s.media_type,
              s.community_average,
              s.total_ratings,
              MAX(r.media_title) AS title,
              MAX(r.media_image) AS image,
              MAX(r.media_release_date) AS release_date,
              g.elo_score AS average_rank,
              g.rank as list_rank
            FROM media_stats s
            LEFT JOIN global_rankings g ON s.id = g.media_id
            LEFT JOIN user_ratings r ON s.id = r.media_id
            WHERE ${typeCondition}
            GROUP BY s.id, s.media_type, s.community_average, s.total_ratings, g.rank, g.elo_score
          )
          SELECT * FROM global_rankings_cte
          ${orderByClause}
          OFFSET ${skip}
          LIMIT ${limit}
        `;

    const results = await prisma.$queryRaw<RankedMediaRow[]>(query);
    return { totalCount, results };
  });

  const formattedResults = results.map((row: any) => ({
    media_id: row.media_id,
    media_type: row.media_type,
    title: row.title ?? row.media_id,
    image: row.image ?? null,
    releaseDate: row.release_date ?? null,
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

export async function updateUserStatsCache(userId: string, mediaType: MediaType, reason?: string) {
  await timeOperation({
    event: "user_stats_cache.update",
    userId,
    mediaType,
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: { source: "updateUserStatsCache", reason },
  }, async () => {
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
    const status = item.status;
    if (status === 'COMPLETED') {
      status_counts.completed++;
    } else if (status === 'IN_PROGRESS') {
      status_counts.watching++;
    } else if (status === 'PLANNING') {
      status_counts.plan_to_watch++;
    } else if (status === 'DROPPED') {
      status_counts.dropped++;
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

export async function getUserRankedList(userId: string, mediaType: MediaType, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [results, count] = await Promise.all([
    prisma.userList.findMany({
      where: { user_id: userId, media_type: mediaType },
      skip,
      take: limit,
    }),
    prisma.userList.count({ where: { user_id: userId, media_type: mediaType } }),
  ]);
  return { results, count };
}

export async function upsertBaseMedia(rawData: any) {
  let anilistId = rawData.id;
  let rootData = rawData;
  
  const initialStructuralType = resolveAniListType(rawData.format || '', rawData.episodes, rawData.duration);
  const isManga = initialStructuralType === 'MANGA';

  if (!isManga) {
    // 1. Traverse backward synchronously to find absolute root to prevent 404s
    const visitedBackward = new Set<number>();
    let currentId = anilistId;
    let currentData = rootData;
    
    const { fetchAnilistNodeEdges } = await import('@/lib/anilist');
    
    while (true) {
      if (visitedBackward.has(currentId)) break;
      visitedBackward.add(currentId);
      
      // If we hit an existing root in DB, use it
      const existingMedia = await prisma.media.findUnique({ where: { anilistId: currentId } });
      if (existingMedia && existingMedia.isMainStoryline) {
          break;
      }
      
      let edges = currentData.relations?.edges || [];
      if (!edges.length) {
         const fullData = await fetchAnilistNodeEdges(currentId);
         if (fullData) {
           currentData = fullData;
           edges = currentData.relations?.edges || [];
         }
      }
      
      const parentEdge = edges.find((e: any) => {
        if (e.relationType === 'PREQUEL' || e.relationType === 'PARENT') {
          if (e.relationType === 'PARENT' && ['TV', 'TV_SHORT'].includes(currentData.format || '')) return false;
          if (['TV', 'TV_SHORT'].includes(currentData.format || '')) {
            if (!['TV', 'TV_SHORT'].includes(e.node?.format || '')) return false;
          }
          return true;
        }
        return false;
      });
      
      if (parentEdge && parentEdge.node) {
        currentId = parentEdge.node.id;
        const nextData = await fetchAnilistNodeEdges(currentId);
        if (nextData) currentData = nextData;
        else break;
      } else {
        break;
      }
    }
    
    anilistId = currentId;
    rootData = currentData;
  }

  const title = rootData.title?.english || rootData.title?.romaji || `AniList ${anilistId}`;
  
  const structuralType = resolveAniListType(rootData.format || '', rootData.episodes, rootData.duration);
  let mediaType: MediaType = "OTHER" as MediaType;
  if (structuralType === 'SERIALIZED') mediaType = "SHOW" as MediaType;
  else if (structuralType === 'FEATURE') mediaType = "MOVIE" as MediaType;
  else if (structuralType === 'MANGA') mediaType = "MANGA" as MediaType;

  const releaseDate = rootData.startDate?.year ? `${rootData.startDate.year}-${String(rootData.startDate.month || 1).padStart(2, '0')}-${String(rootData.startDate.day || 1).padStart(2, '0')}` : null;

  let mangadexId = rootData.mangadexId || null;
  if (mangadexId) {
    const existingWithMangaDex = await prisma.media.findFirst({
      where: {
        mangadexId,
        NOT: { anilistId }
      }
    });
    if (existingWithMangaDex) {
      mangadexId = null;
    }
  }

  const dbMedia = await prisma.media.upsert({
    where: { anilistId },
    update: { title, isMainStoryline: true, releaseDate, mangadexId },
    create: {
      anilistId,
      title,
      type: mediaType,
      isMainStoryline: true,
      releaseDate,
      mangadexId
    }
  });

  let shouldEnqueue = true;
  if (isManga) {
    let rootMedia = dbMedia;
    if (dbMedia.relatedMediaId) {
      const foundRoot = await prisma.media.findUnique({ where: { id: dbMedia.relatedMediaId } });
      if (foundRoot) rootMedia = foundRoot;
    }
    if (rootMedia.franchiseSyncedAt) {
      shouldEnqueue = false;
    }
  }

  if (shouldEnqueue) {
    await enqueueJob({
      type: "syncAniListFranchiseTree",
      payload: { anilistId, internalMediaId: dbMedia.id },
      dedupeKey: `sync_anilist_${anilistId}`,
    });
  }

  return dbMedia;
}
