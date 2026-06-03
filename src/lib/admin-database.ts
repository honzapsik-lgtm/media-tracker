import { ADMIN_STUCK_JOB_MINUTES, PERF_WARN_THRESHOLD_MS } from "@/lib/admin-constants";
import { JOB_STATUS } from "@/lib/jobs";
import { timeOperation } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type IntegrityCheckResult = {
  id: string;
  label: string;
  severity: "ok" | "warning" | "error";
  count: number;
  detail: string;
  href?: string;
};

type CountRow = {
  count: bigint | number;
};

type CountByNameRow = {
  name: string;
  count: bigint | number;
};

function toNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function checkResult(
  id: string,
  label: string,
  count: number,
  problemSeverity: "warning" | "error",
  okDetail: string,
  problemDetail: string,
  href?: string
): IntegrityCheckResult {
  return {
    id,
    label,
    severity: count > 0 ? problemSeverity : "ok",
    count,
    detail: count > 0 ? problemDetail : okDetail,
    href: count > 0 ? href : undefined,
  };
}

async function rawCount(query: TemplateStringsArray, ...values: unknown[]) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    query.reduce((sql, chunk, index) => `${sql}${chunk}${index < values.length ? `$${index + 1}` : ""}`, ""),
    ...values
  );
  return toNumber(rows[0]?.count);
}

export async function getDatabaseSummary() {
  const [
    users,
    accounts,
    sessions,
    ratings,
    ratingsWithReviewText,
    deepReviews,
    watchlistEntries,
    mediaStats,
    userBadges,
    userStatsCache,
    apiCache,
    backgroundJobCounts,
    systemLogCounts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.account.count(),
    prisma.session.count(),
    prisma.userRating.count(),
    prisma.userRating.count({ where: { review_text: { not: null } } }),
    prisma.userRating.count({ where: { is_deep_review: true } }),
    prisma.userWatchlist.count(),
    prisma.mediaStats.count(),
    prisma.userBadge.count(),
    prisma.userStatsCache.count(),
    prisma.apiCache.count(),
    prisma.backgroundJob.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.systemLog.groupBy({
      by: ["level"],
      _count: { _all: true },
      orderBy: { level: "asc" },
    }),
  ]);

  return {
    users,
    accounts,
    sessions,
    ratings,
    ratingsWithReviewText,
    deepReviews,
    watchlistEntries,
    mediaStats,
    userBadges,
    userStatsCache,
    apiCache,
    backgroundJobsByStatus: Object.fromEntries(
      backgroundJobCounts.map((row) => [row.status, row._count._all])
    ),
    systemLogsByLevel: Object.fromEntries(
      systemLogCounts.map((row) => [row.level, row._count._all])
    ),
  };
}

export async function getUsersMissingStatsCacheCount() {
  return rawCount`
    SELECT COUNT(*) AS count
    FROM "users" u
    WHERE NOT EXISTS (
      SELECT 1 FROM "UserStatsCache" usc WHERE usc.user_id = u.id
    )
  `;
}

export async function getMediaStatsMismatchCount() {
  return rawCount`
    SELECT COUNT(*) AS count
    FROM "media_stats" ms
    LEFT JOIN (
      SELECT media_id, COUNT(*) AS rating_count
      FROM "user_ratings"
      GROUP BY media_id
    ) ur ON ur.media_id = ms.id
    WHERE COALESCE(ms.total_ratings, 0) <> COALESCE(ur.rating_count, 0)
  `;
}

export async function runDatabaseIntegrityChecks(): Promise<IntegrityCheckResult[]> {
  return timeOperation({
    event: "admin.database.integrity_checks",
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: { source: "runDatabaseIntegrityChecks" },
  }, async () => runDatabaseIntegrityChecksData());
}

async function runDatabaseIntegrityChecksData(): Promise<IntegrityCheckResult[]> {
  const now = new Date();
  const stuckCutoff = new Date(Date.now() - ADMIN_STUCK_JOB_MINUTES * 60 * 1000);
  const oldFailedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oldExpiredCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oldLogCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    invalidScore,
    missingMediaTitle,
    missingMediaImage,
    missingMediaStats,
    mediaStatsMismatch,
    usersMissingStatsCache,
    stuckProcessingJobs,
    failedJobs,
    oldFailedJobs,
    expiredCacheEntries,
    oldExpiredCacheEntries,
    recentSystemErrors,
    oldSystemLogs,
    recentSlowOperations,
  ] = await Promise.all([
    prisma.userRating.count({ where: { OR: [{ score: { lt: 0 } }, { score: { gt: 100 } }] } }),
    prisma.userRating.count({ where: { OR: [{ media_title: null }, { media_title: "" }] } }),
    prisma.userRating.count({ where: { OR: [{ media_image: null }, { media_image: "" }] } }),
    rawCount`
      SELECT COUNT(*) AS count
      FROM (
        SELECT DISTINCT ur.media_id
        FROM "user_ratings" ur
        LEFT JOIN "media_stats" ms ON ms.id = ur.media_id
        WHERE ms.id IS NULL
      ) missing
    `,
    getMediaStatsMismatchCount(),
    getUsersMissingStatsCacheCount(),
    prisma.backgroundJob.count({
      where: { status: JOB_STATUS.PROCESSING, locked_at: { lt: stuckCutoff } },
    }),
    prisma.backgroundJob.count({ where: { status: JOB_STATUS.FAILED } }),
    prisma.backgroundJob.count({
      where: { status: JOB_STATUS.FAILED, processed_at: { lt: oldFailedCutoff } },
    }),
    prisma.apiCache.count({ where: { expires_at: { lt: now } } }),
    prisma.apiCache.count({ where: { expires_at: { lt: oldExpiredCutoff } } }),
    prisma.systemLog.count({ where: { level: "error", createdAt: { gte: dayAgo } } }),
    prisma.systemLog.count({ where: { createdAt: { lt: oldLogCutoff } } }),
    prisma.systemLog.count({ where: { event: "performance.slow_operation", createdAt: { gte: dayAgo } } }),
  ]);

  return [
    checkResult(
      "ratings_invalid_score",
      "Ratings have valid score",
      invalidScore,
      "error",
      "All ratings are within the supported 0-100 score range.",
      `${invalidScore} ratings have a score outside the supported 0-100 range.`
    ),
    checkResult(
      "ratings_missing_media_title",
      "Ratings include media title",
      missingMediaTitle,
      "warning",
      "All ratings include a stored media title.",
      `${missingMediaTitle} ratings are missing media titles.`
    ),
    checkResult(
      "ratings_missing_media_image",
      "Ratings include media image",
      missingMediaImage,
      "warning",
      "All ratings include a stored media image.",
      `${missingMediaImage} ratings are missing media images.`
    ),
    checkResult(
      "ratings_missing_media_stats",
      "Rated media has media_stats row",
      missingMediaStats,
      "error",
      "Every rated media item has a media_stats row.",
      `${missingMediaStats} rated media ids do not have a media_stats row.`
    ),
    checkResult(
      "media_stats_count_mismatch",
      "Media stats rating counts match",
      mediaStatsMismatch,
      "warning",
      "media_stats total_ratings matches user_ratings counts.",
      `${mediaStatsMismatch} media_stats rows disagree with user_ratings counts.`
    ),
    checkResult(
      "users_missing_stats_cache",
      "Users have profile stats cache",
      usersMissingStatsCache,
      "warning",
      "Every user has at least one UserStatsCache row.",
      `${usersMissingStatsCache} users do not have cached profile statistics.`
    ),
    checkResult(
      "stuck_processing_jobs",
      "No stuck processing jobs",
      stuckProcessingJobs,
      "error",
      `No processing jobs are locked longer than ${ADMIN_STUCK_JOB_MINUTES} minutes.`,
      `${stuckProcessingJobs} processing jobs are locked longer than ${ADMIN_STUCK_JOB_MINUTES} minutes.`,
      "/admin/jobs?status=processing"
    ),
    checkResult(
      "failed_jobs",
      "No failed jobs",
      failedJobs,
      "warning",
      "No failed background jobs exist.",
      `${failedJobs} failed background jobs exist.`,
      "/admin/jobs?status=failed"
    ),
    checkResult(
      "old_failed_jobs",
      "No old failed jobs",
      oldFailedJobs,
      "warning",
      "No failed background jobs are older than 24 hours.",
      `${oldFailedJobs} failed background jobs are older than 24 hours.`,
      "/admin/jobs?status=failed"
    ),
    checkResult(
      "expired_cache_entries",
      "Provider cache is fresh",
      expiredCacheEntries,
      "warning",
      "No expired ApiCache entries exist.",
      `${expiredCacheEntries} expired ApiCache entries exist.`,
      "/admin/cache?expired=true"
    ),
    checkResult(
      "old_expired_cache_entries",
      "No old expired cache entries",
      oldExpiredCacheEntries,
      "warning",
      "No expired ApiCache entries are older than 7 days.",
      `${oldExpiredCacheEntries} expired ApiCache entries are older than 7 days.`,
      "/admin/cache?expired=true"
    ),
    checkResult(
      "recent_system_errors",
      "No recent system errors",
      recentSystemErrors,
      "error",
      "No SystemLog errors were recorded in the last 24 hours.",
      `${recentSystemErrors} SystemLog errors were recorded in the last 24 hours.`,
      "/admin/logs?level=error"
    ),
    checkResult(
      "system_logs_older_than_30_days",
      "SystemLog retention",
      oldSystemLogs,
      "warning",
      "No SystemLog rows are older than 30 days.",
      `${oldSystemLogs} SystemLog rows are older than 30 days. Consider a future retention policy.`,
      "/admin/logs"
    ),
    checkResult(
      "recent_slow_operations",
      "Recent slow operations",
      recentSlowOperations,
      "warning",
      "No slow operations were recorded in the last 24 hours.",
      `${recentSlowOperations} slow operations were recorded in the last 24 hours.`,
      "/admin/performance"
    ),
  ];
}

export function countRowsByName(rows: CountByNameRow[]) {
  return Object.fromEntries(rows.map((row) => [row.name, toNumber(row.count)]));
}
