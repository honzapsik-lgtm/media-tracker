import { Prisma } from "@prisma/client";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { sanitizeLogMetadata } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type PerformanceFilters = {
  page?: number;
  pageSize?: number;
  operation?: string;
  userId?: string;
  mediaId?: string;
  sinceHours?: number;
};

type OperationCountRow = {
  operation: string | null;
  count: bigint | number;
};

function toNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function metadataOperation(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata.operation;
  return typeof value === "string" ? value : null;
}

function buildWhere(filters: PerformanceFilters): Prisma.SystemLogWhereInput {
  const sinceHours = filters.sinceHours && filters.sinceHours > 0 ? filters.sinceHours : undefined;
  const operation = filters.operation?.trim();
  const userId = filters.userId?.trim();
  const mediaId = filters.mediaId?.trim();

  return {
    event: "performance.slow_operation",
    ...(sinceHours ? { createdAt: { gte: new Date(Date.now() - sinceHours * 60 * 60 * 1000) } } : {}),
    ...(userId ? { userId } : {}),
    ...(mediaId ? { mediaId } : {}),
    ...(operation ? { metadata: { path: ["operation"], equals: operation } } : {}),
  };
}

export function serializeSlowOperation(log: Awaited<ReturnType<typeof prisma.systemLog.findMany>>[number]) {
  const metadata =
    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
      ? sanitizeLogMetadata(log.metadata as Record<string, unknown>)
      : log.metadata;

  return {
    id: log.id,
    createdAt: log.createdAt,
    operation: metadataOperation(log.metadata),
    durationMs: log.durationMs,
    level: log.level,
    message: log.message,
    requestId: log.requestId,
    userId: log.userId,
    mediaId: log.mediaId,
    mediaType: log.mediaType,
    metadata,
  };
}

export async function getPerformanceSummary() {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [lastHour, last24Hours, slowestLast24Hours, topOperationRows] = await Promise.all([
    prisma.systemLog.count({
      where: { event: "performance.slow_operation", createdAt: { gte: hourAgo } },
    }),
    prisma.systemLog.count({
      where: { event: "performance.slow_operation", createdAt: { gte: dayAgo } },
    }),
    prisma.systemLog.findFirst({
      where: { event: "performance.slow_operation", createdAt: { gte: dayAgo } },
      orderBy: { durationMs: "desc" },
    }),
    prisma.$queryRaw<OperationCountRow[]>`
      SELECT metadata->>'operation' AS operation, COUNT(*) AS count
      FROM "SystemLog"
      WHERE event = 'performance.slow_operation'
        AND "createdAt" >= ${dayAgo}
      GROUP BY operation
      ORDER BY count DESC
      LIMIT 5
    `,
  ]);

  return {
    lastHour,
    last24Hours,
    slowestLast24Hours: slowestLast24Hours ? serializeSlowOperation(slowestLast24Hours) : null,
    topOperationsLast24Hours: topOperationRows.map((row) => ({
      operation: row.operation ?? "unknown",
      count: toNumber(row.count),
    })),
  };
}

export async function getRecentSlowOperations(filters: PerformanceFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
  const where = buildWhere(filters);

  const [items, total, summary] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.systemLog.count({ where }),
    getPerformanceSummary(),
  ]);

  return {
    items: items.map(serializeSlowOperation),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary,
  };
}
