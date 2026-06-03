import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { awardBadges, updateUserStatsCache } from "@/lib/media-db";
import { appLog } from "@/lib/logger";
import { claimPendingJobs, completeJob, failJob } from "@/lib/jobs";
import { getOrCreateRequestId } from "@/lib/request-id";

type JobPayload = {
  userId?: string;
  mediaType?: string;
};

function createWorkerId() {
  return `worker_${crypto.randomUUID()}`;
}

async function processJob(job: { id: string; type: string; payload: unknown }, requestId: string, workerId: string) {
  const payload = job.payload as JobPayload;

  await appLog({
    level: "info",
    event: "job.started",
    requestId,
    jobId: job.id,
    userId: payload.userId,
    metadata: { type: job.type, workerId },
    persist: true,
  });

  if (job.type === "award_badges") {
    if (!payload.userId) throw new Error("award_badges job requires userId");
    await awardBadges(payload.userId);
  } else if (job.type === "update_user_stats") {
    if (!payload.userId || !payload.mediaType) {
      throw new Error("update_user_stats job requires userId and mediaType");
    }
    await updateUserStatsCache(payload.userId, payload.mediaType);
  } else {
    throw new Error(`Unknown job type: ${job.type}`);
  }
}

export async function processWorkerBatch({
  requestId,
  batchSize = 50,
}: {
  requestId: string;
  batchSize?: number;
}) {
  const startedAt = performance.now();
  const workerId = createWorkerId();

  await appLog({
    level: "info",
    event: "worker.started",
    requestId,
    metadata: { workerId, batchSize },
    persist: true,
  });

  const jobs = await claimPendingJobs({ workerId, batchSize });
  let completed = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await processJob(job, requestId, workerId);
      await completeJob(job.id, requestId);
      completed += 1;
    } catch (error) {
      const updated = await failJob(job.id, error, requestId);
      if (updated.status === "pending") retried += 1;
      else failed += 1;
    }
  }

  if (jobs.length > 0) {
    revalidatePath("/rankings");
    revalidatePath("/profile");
  }

  const summary = {
    ok: true,
    workerId,
    processed: jobs.length,
    completed,
    retried,
    failed,
  };

  await appLog({
    level: "info",
    event: "worker.completed",
    requestId,
    durationMs: Math.round(performance.now() - startedAt),
    metadata: summary,
    persist: true,
  });

  return summary;
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const summary = await processWorkerBatch({ requestId });
    return NextResponse.json(summary);
  } catch (error) {
    await appLog({
      level: "error",
      event: "worker.failed",
      requestId,
      error,
      persist: true,
    });
    return NextResponse.json({ ok: false, error: "WORKER_FAILED" }, { status: 500 });
  }
}
