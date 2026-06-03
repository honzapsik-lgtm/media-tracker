import { Prisma } from "@prisma/client";
import { appLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const JOB_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

type EnqueueJobInput = {
  type: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  runAt?: Date;
  requestId?: string;
  maxAttempts?: number;
};

function stringifyError(error: unknown) {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function payloadUserId(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const value = payload.userId;
  return typeof value === "string" ? value : undefined;
}

export async function enqueueJob(input: EnqueueJobInput) {
  if (input.dedupeKey) {
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        dedupe_key: input.dedupeKey,
        status: { in: [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING] },
      },
      orderBy: { created_at: "desc" },
    });

    if (existing) {
      await appLog({
        level: "info",
        event: "job.deduped",
        requestId: input.requestId,
        jobId: existing.id,
        userId: payloadUserId(existing.payload),
        metadata: {
          type: existing.type,
          status: existing.status,
          dedupeKey: input.dedupeKey,
        },
        persist: true,
      });
      return existing;
    }
  }

  const job = await prisma.backgroundJob.create({
    data: {
      type: input.type,
      payload: input.payload as Prisma.InputJsonObject,
      dedupe_key: input.dedupeKey,
      run_at: input.runAt ?? new Date(),
      max_attempts: input.maxAttempts ?? 3,
    },
  });

  await appLog({
    level: "info",
    event: "job.enqueued",
    requestId: input.requestId,
    jobId: job.id,
    userId: payloadUserId(job.payload),
    metadata: {
      type: job.type,
      status: job.status,
      dedupeKey: job.dedupe_key,
      runAt: job.run_at.toISOString(),
    },
    persist: true,
  });

  return job;
}

export async function claimPendingJobs({
  workerId,
  batchSize = 50,
}: {
  workerId: string;
  batchSize?: number;
}) {
  const candidates = await prisma.backgroundJob.findMany({
    where: {
      status: JOB_STATUS.PENDING,
      run_at: { lte: new Date() },
    },
    orderBy: [{ run_at: "asc" }, { created_at: "asc" }],
    take: batchSize,
  });

  const claimed = [];
  const now = new Date();

  for (const job of candidates) {
    const result = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: JOB_STATUS.PENDING },
      data: {
        status: JOB_STATUS.PROCESSING,
        locked_at: now,
        locked_by: workerId,
        attempts: { increment: 1 },
      },
    });

    if (result.count === 0) continue;

    const updated = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
    if (updated) claimed.push(updated);
  }

  return claimed;
}

export async function completeJob(jobId: string, requestId?: string) {
  const job = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: JOB_STATUS.COMPLETED,
      locked_at: null,
      locked_by: null,
      processed_at: new Date(),
      last_error: null,
    },
  });

  await appLog({
    level: "info",
    event: "job.completed",
    requestId,
    jobId: job.id,
    userId: payloadUserId(job.payload),
    metadata: { type: job.type, attempts: job.attempts, dedupeKey: job.dedupe_key },
    persist: true,
  });

  return job;
}

export async function failJob(jobId: string, error: unknown, requestId?: string) {
  const current = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!current) throw new Error(`Job not found: ${jobId}`);

  const lastError = stringifyError(error);
  const shouldRetry = current.attempts < current.max_attempts;
  const delaySeconds = Math.min(60 * Math.max(current.attempts, 1), 300);
  const runAt = new Date(Date.now() + delaySeconds * 1000);

  const job = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: shouldRetry
      ? {
          status: JOB_STATUS.PENDING,
          locked_at: null,
          locked_by: null,
          last_error: lastError,
          run_at: runAt,
        }
      : {
          status: JOB_STATUS.FAILED,
          locked_at: null,
          locked_by: null,
          last_error: lastError,
          processed_at: new Date(),
        },
  });

  await appLog({
    level: shouldRetry ? "warn" : "error",
    event: shouldRetry ? "job.retried" : "job.failed",
    requestId,
    jobId: job.id,
    userId: payloadUserId(job.payload),
    error,
    metadata: {
      type: job.type,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      status: job.status,
      dedupeKey: job.dedupe_key,
      runAt: shouldRetry ? runAt.toISOString() : undefined,
    },
    persist: true,
  });

  return job;
}

export async function retryJob(jobId: string, requestId?: string) {
  const result = await prisma.backgroundJob.updateMany({
    where: { id: jobId, status: JOB_STATUS.FAILED },
    data: {
      status: JOB_STATUS.PENDING,
      locked_at: null,
      locked_by: null,
      processed_at: null,
      run_at: new Date(),
    },
  });

  if (result.count === 0) {
    throw new Error("Only failed jobs can be retried.");
  }

  const job = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: jobId } });

  await appLog({
    level: "info",
    event: "job.retry_requested",
    requestId,
    jobId: job.id,
    userId: payloadUserId(job.payload),
    metadata: { type: job.type, attempts: job.attempts, dedupeKey: job.dedupe_key },
    persist: true,
  });

  return job;
}

export async function cancelJob(jobId: string, requestId?: string) {
  const result = await prisma.backgroundJob.updateMany({
    where: { id: jobId, status: JOB_STATUS.PENDING },
    data: {
      status: JOB_STATUS.CANCELLED,
      locked_at: null,
      locked_by: null,
      processed_at: new Date(),
    },
  });

  if (result.count === 0) {
    throw new Error("Only pending jobs can be cancelled.");
  }

  const job = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: jobId } });

  await appLog({
    level: "warn",
    event: "job.cancelled",
    requestId,
    jobId: job.id,
    userId: payloadUserId(job.payload),
    metadata: { type: job.type, dedupeKey: job.dedupe_key },
    persist: true,
  });

  return job;
}

export async function markStuckJobsFailed({
  olderThanMinutes,
  requestId,
}: {
  olderThanMinutes: number;
  requestId?: string;
}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const message = `Job marked failed because it was stuck in processing state for more than ${olderThanMinutes} minutes.`;
  const result = await prisma.backgroundJob.updateMany({
    where: {
      status: JOB_STATUS.PROCESSING,
      locked_at: { lt: cutoff },
    },
    data: {
      status: JOB_STATUS.FAILED,
      locked_at: null,
      locked_by: null,
      last_error: message,
      processed_at: new Date(),
    },
  });

  await appLog({
    level: result.count > 0 ? "warn" : "info",
    event: "job.stuck_failed",
    requestId,
    metadata: { count: result.count, olderThanMinutes },
    persist: true,
  });

  return result.count;
}

export async function cleanupCompletedJobs({
  olderThanDays,
  requestId,
}: {
  olderThanDays: number;
  requestId?: string;
}) {
  const startedAt = performance.now();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.backgroundJob.deleteMany({
    where: {
      status: { in: [JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED] },
      processed_at: { lt: cutoff },
    },
  });

  await appLog({
    level: "info",
    event: "job.cleanup.completed",
    requestId,
    durationMs: Math.round(performance.now() - startedAt),
    metadata: { deletedCount: result.count, olderThanDays },
    persist: true,
  });

  return result.count;
}

export function isJobStatus(value: string): value is JobStatus {
  return Object.values(JOB_STATUS).includes(value as JobStatus);
}
