import { getCacheSummary } from "@/lib/admin-cache";
import { ADMIN_STUCK_JOB_MINUTES } from "@/lib/admin-constants";
import { getMediaStatsMismatchCount, getUsersMissingStatsCacheCount } from "@/lib/admin-database";
import { getJobSummary } from "@/lib/admin-jobs";
import { JOB_STATUS } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export type AdminOverviewWarning = {
  severity: "warning" | "error";
  label: string;
  detail: string;
  href: string;
};

export async function getAdminOverview() {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [
    jobs,
    cache,
    errorsLastHour,
    warningsLastHour,
    errorsLast24Hours,
    warningsLast24Hours,
    latestErrorLogs,
    users,
    ratings,
    ratingsWithReviews,
    watchlistEntries,
    mediaStatsRows,
    userStatsCacheRows,
    badges,
    systemLogCount,
    backgroundJobCount,
    cancelledJobs,
    usersMissingStatsCache,
    mediaStatsInconsistencies,
  ] = await Promise.all([
    getJobSummary(),
    getCacheSummary(),
    prisma.systemLog.count({ where: { level: "error", createdAt: { gte: hourAgo } } }),
    prisma.systemLog.count({ where: { level: "warn", createdAt: { gte: hourAgo } } }),
    prisma.systemLog.count({ where: { level: "error", createdAt: { gte: dayAgo } } }),
    prisma.systemLog.count({ where: { level: "warn", createdAt: { gte: dayAgo } } }),
    prisma.systemLog.findMany({
      where: { level: "error" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        event: true,
        message: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.user.count(),
    prisma.userRating.count(),
    prisma.userRating.count({ where: { review_text: { not: null } } }),
    prisma.userWatchlist.count(),
    prisma.mediaStats.count(),
    prisma.userStatsCache.count(),
    prisma.userBadge.count(),
    prisma.systemLog.count(),
    prisma.backgroundJob.count(),
    prisma.backgroundJob.count({ where: { status: JOB_STATUS.CANCELLED } }),
    getUsersMissingStatsCacheCount(),
    getMediaStatsMismatchCount(),
  ]);

  const warnings: AdminOverviewWarning[] = [];

  if (jobs.failed > 0) {
    warnings.push({
      severity: "warning",
      label: "Failed jobs exist",
      detail: `There are ${jobs.failed} failed background jobs.`,
      href: "/admin/jobs?status=failed",
    });
  }

  if (jobs.stuckProcessing > 0) {
    warnings.push({
      severity: "error",
      label: "Stuck processing jobs",
      detail: `${jobs.stuckProcessing} jobs have been processing for more than ${ADMIN_STUCK_JOB_MINUTES} minutes.`,
      href: "/admin/jobs?status=processing",
    });
  }

  if (jobs.oldestPendingAgeSeconds != null && jobs.oldestPendingAgeSeconds > 15 * 60) {
    warnings.push({
      severity: "warning",
      label: "Old pending job",
      detail: `The oldest pending job has waited ${jobs.oldestPendingAgeSeconds} seconds.`,
      href: "/admin/jobs?status=pending",
    });
  }

  if (errorsLastHour > 0) {
    warnings.push({
      severity: "error",
      label: "Recent system errors",
      detail: `${errorsLastHour} errors were logged in the last hour.`,
      href: "/admin/logs?level=error",
    });
  }

  if (cache.expiredEntries > 25) {
    warnings.push({
      severity: "warning",
      label: "Expired cache buildup",
      detail: `${cache.expiredEntries} ApiCache entries are expired.`,
      href: "/admin/cache?expired=true",
    });
  }

  if (usersMissingStatsCache > 0) {
    warnings.push({
      severity: "warning",
      label: "Users missing stats cache",
      detail: `${usersMissingStatsCache} users do not have cached profile statistics.`,
      href: "/admin/database",
    });
  }

  if (mediaStatsInconsistencies > 0) {
    warnings.push({
      severity: "warning",
      label: "Media stats inconsistencies",
      detail: `${mediaStatsInconsistencies} media_stats rows disagree with rating counts.`,
      href: "/admin/database",
    });
  }

  return {
    jobs: {
      ...jobs,
      cancelled: cancelledJobs,
    },
    logs: {
      errorsLastHour,
      warningsLastHour,
      errorsLast24Hours,
      warningsLast24Hours,
      latestErrorLogs,
    },
    cache,
    database: {
      users,
      ratings,
      ratingsWithReviews,
      watchlistEntries,
      mediaStatsRows,
      userStatsCacheRows,
      badges,
      systemLogCount,
      backgroundJobCount,
    },
    warnings,
  };
}
