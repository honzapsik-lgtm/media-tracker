import { Prisma } from "@prisma/client";
import { PERF_WARN_THRESHOLD_MS } from "@/lib/admin-constants";
import { inferCacheType } from "@/lib/admin-cache";
import { timeOperation } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

function safeCacheKey(id: string) {
  return id.length > 120 ? `${id.slice(0, 120)}...[TRUNCATED]` : id;
}

export async function readApiCache<T>(id: string): Promise<T | null> {
  const cached = await timeOperation({
    event: "api_cache.read",
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: "readApiCache",
      cacheKey: safeCacheKey(id),
      cacheType: inferCacheType(id),
    },
  }, () => prisma.apiCache.findUnique({ where: { id } }));

  if (!cached || cached.expires_at <= new Date()) return null;

  return cached.data as T;
}

export async function writeApiCache(
  id: string,
  provider: string,
  data: unknown,
  ttlSeconds: number
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await timeOperation({
    event: "api_cache.write",
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: "writeApiCache",
      provider,
      cacheKey: safeCacheKey(id),
      cacheType: inferCacheType(id),
      ttlSeconds,
    },
  }, () => prisma.apiCache.upsert({
    where: { id },
    update: {
      provider,
      data: data as Prisma.InputJsonValue,
      created_at: now,
      expires_at: expiresAt,
    },
    create: {
      id,
      provider,
      data: data as Prisma.InputJsonValue,
      expires_at: expiresAt,
    },
  }));
}

export async function timeProviderFetch<T>({
  provider,
  cacheId,
  operation,
  fetcher,
}: {
  provider: string;
  cacheId: string;
  operation: string;
  fetcher: () => Promise<T>;
}) {
  return timeOperation({
    event: "provider.fetch",
    slowThresholdMs: PERF_WARN_THRESHOLD_MS,
    metadata: {
      source: operation,
      provider,
      cacheKey: safeCacheKey(cacheId),
      cacheType: inferCacheType(cacheId),
      cacheHit: false,
    },
  }, fetcher);
}
