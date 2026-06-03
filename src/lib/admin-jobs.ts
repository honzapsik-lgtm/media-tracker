import { Prisma } from "@prisma/client";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE, ADMIN_STUCK_JOB_MINUTES } from "@/lib/admin-constants";
import { JOB_STATUS } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export type JobFilters = {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  dedupeKey?: string;
  userId?: string;
  q?: string;
};

export const parsePositiveInt = (value: string | null | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function buildJobWhere(filters: JobFilters): Prisma.BackgroundJobWhereInput {
  const status = filters.status?.trim();
  const type = filters.type?.trim();
  const dedupeKey = filters.dedupeKey?.trim();
  const userId = filters.userId?.trim();
  const q = filters.q?.trim();

  return {
    ...(status ? { status } : {}),
    ...(type ? { type: { contains: type } } : {}),
    ...(dedupeKey ? { dedupe_key: { contains: dedupeKey } } : {}),
    ...(userId ? { payload: { path: ["userId"], equals: userId } } : {}),
    ...(q
      ? {
          OR: [
            { type: { contains: q } },
            { status: { contains: q } },
            { dedupe_key: { contains: q } },
            { last_error: { contains: q } },
          ],
        }
      : {}),
  };
}

export async function getPaginatedJobs(filters: JobFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
  const where = buildJobWhere(filters);

  const [items, total] = await Promise.all([
    prisma.backgroundJob.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.backgroundJob.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getJobSummary() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const stuckCutoff = new Date(Date.now() - ADMIN_STUCK_JOB_MINUTES * 60 * 1000);

  const [
    pending,
    processing,
    failed,
    completedLastHour,
    oldestPending,
    stuckProcessing,
  ] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: JOB_STATUS.PENDING } }),
    prisma.backgroundJob.count({ where: { status: JOB_STATUS.PROCESSING } }),
    prisma.backgroundJob.count({ where: { status: JOB_STATUS.FAILED } }),
    prisma.backgroundJob.count({
      where: { status: JOB_STATUS.COMPLETED, processed_at: { gte: oneHourAgo } },
    }),
    prisma.backgroundJob.findFirst({
      where: { status: JOB_STATUS.PENDING },
      orderBy: { created_at: "asc" },
      select: { created_at: true },
    }),
    prisma.backgroundJob.count({
      where: { status: JOB_STATUS.PROCESSING, locked_at: { lt: stuckCutoff } },
    }),
  ]);

  return {
    pending,
    processing,
    failed,
    completedLastHour,
    oldestPendingAgeSeconds: oldestPending
      ? Math.max(0, Math.round((Date.now() - oldestPending.created_at.getTime()) / 1000))
      : null,
    stuckProcessing,
  };
}

export function serializeJob(job: Awaited<ReturnType<typeof prisma.backgroundJob.findMany>>[number]) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    dedupeKey: job.dedupe_key,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    runAt: job.run_at,
    lockedAt: job.locked_at,
    lockedBy: job.locked_by,
    lastError: job.last_error,
    completedAt: job.processed_at,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    payload: job.payload,
  };
}
