import { Prisma } from "@prisma/client";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "@/lib/admin-constants";
import { appLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type CacheFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: string;
  provider?: string;
  expired?: boolean;
  sort?: string;
};

type CacheGroupRow = {
  name: string;
  count: bigint | number;
};

const CACHE_TYPE_CASE = Prisma.sql`
  CASE
    WHEN id LIKE 'discover-%' THEN 'discover'
    WHEN id LIKE '%-search-%' THEN 'search'
    WHEN id LIKE '%trending%' THEN 'trending'
    ELSE 'detail'
  END
`;

export function inferCacheType(id: string) {
  if (id.startsWith("discover-")) return "discover";
  if (id.includes("-search-")) return "search";
  if (id.includes("trending")) return "trending";
  return "detail";
}

export function parseBooleanFilter(value: string | null | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function secondsSince(date: Date | null) {
  return date ? Math.max(0, Math.round((Date.now() - date.getTime()) / 1000)) : null;
}

function toCount(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function groupRowsToRecord(rows: CacheGroupRow[]) {
  return Object.fromEntries(rows.map((row) => [row.name, toCount(row.count)]));
}

function cacheTypeWhere(type: string): Prisma.ApiCacheWhereInput {
  if (type === "discover") return { id: { startsWith: "discover-" } };
  if (type === "search") return { id: { contains: "-search-" } };
  if (type === "trending") return { id: { contains: "trending" } };
  if (type === "detail") {
    return {
      NOT: [
        { id: { startsWith: "discover-" } },
        { id: { contains: "-search-" } },
        { id: { contains: "trending" } },
      ],
    };
  }
  return {};
}

function buildCacheWhere(filters: CacheFilters): Prisma.ApiCacheWhereInput {
  const now = new Date();
  const q = filters.q?.trim();
  const provider = filters.provider?.trim();
  const type = filters.type?.trim();

  return {
    ...(q ? { OR: [{ id: { contains: q } }, { provider: { contains: q } }] } : {}),
    ...(provider ? { provider: { contains: provider } } : {}),
    ...(type ? cacheTypeWhere(type) : {}),
    ...(filters.expired === true ? { expires_at: { lt: now } } : {}),
    ...(filters.expired === false ? { expires_at: { gte: now } } : {}),
  };
}

function cacheOrderBy(sort?: string): Prisma.ApiCacheOrderByWithRelationInput {
  if (sort === "created_asc") return { created_at: "asc" };
  if (sort === "expires_asc") return { expires_at: "asc" };
  if (sort === "expires_desc") return { expires_at: "desc" };
  return { created_at: "desc" };
}

export async function getCacheSummary() {
  const now = new Date();

  const [
    totalEntries,
    expiredEntries,
    oldestExpired,
    byProvider,
    byType,
    lastCleanupLog,
  ] = await Promise.all([
    prisma.apiCache.count(),
    prisma.apiCache.count({ where: { expires_at: { lt: now } } }),
    prisma.apiCache.findFirst({
      where: { expires_at: { lt: now } },
      orderBy: { expires_at: "asc" },
      select: { expires_at: true },
    }),
    prisma.apiCache.groupBy({
      by: ["provider"],
      _count: { _all: true },
      orderBy: { provider: "asc" },
    }),
    prisma.$queryRaw<CacheGroupRow[]>`
      SELECT ${CACHE_TYPE_CASE} AS name, COUNT(*) AS count
      FROM "ApiCache"
      GROUP BY name
      ORDER BY name ASC
    `,
    prisma.systemLog.findFirst({
      where: { event: { in: ["api_cache.cleanup.completed", "admin.cache.cleanup"] } },
      orderBy: { createdAt: "desc" },
      select: { event: true, createdAt: true, metadata: true },
    }),
  ]);

  return {
    totalEntries,
    expiredEntries,
    freshEntries: totalEntries - expiredEntries,
    oldestExpiredAgeSeconds: secondsSince(oldestExpired?.expires_at ?? null),
    byProvider: Object.fromEntries(
      byProvider.map((row) => [row.provider, row._count._all])
    ),
    byType: groupRowsToRecord(byType),
    lastCleanupLog,
  };
}

export async function getPaginatedCacheEntries(filters: CacheFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
  const where = buildCacheWhere(filters);
  const now = new Date();

  const [items, total] = await Promise.all([
    prisma.apiCache.findMany({
      where,
      orderBy: cacheOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        provider: true,
        data: true,
        created_at: true,
        expires_at: true,
      },
    }),
    prisma.apiCache.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      key: item.id,
      type: inferCacheType(item.id),
      provider: item.provider,
      createdAt: item.created_at,
      updatedAt: item.created_at,
      expiresAt: item.expires_at,
      expired: item.expires_at < now,
      payloadSizeBytes: JSON.stringify(item.data).length,
    })),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function cleanupExpiredCache({
  requestId,
  userId,
  graceSeconds = 0,
}: {
  requestId?: string;
  userId?: string;
  graceSeconds?: number;
}) {
  const startedAt = performance.now();
  const cutoff = new Date(Date.now() - Math.max(0, graceSeconds) * 1000);

  try {
    const result = await prisma.apiCache.deleteMany({
      where: { expires_at: { lt: cutoff } },
    });

    await appLog({
      level: "info",
      event: "api_cache.cleanup.completed",
      requestId,
      userId,
      durationMs: Math.round(performance.now() - startedAt),
      metadata: { deletedCount: result.count, graceSeconds },
      persist: true,
    });

    return result.count;
  } catch (error) {
    await appLog({
      level: "error",
      event: "api_cache.cleanup.failed",
      requestId,
      userId,
      durationMs: Math.round(performance.now() - startedAt),
      error,
      metadata: { graceSeconds },
      persist: true,
    });
    throw error;
  }
}
