import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardBadges, updateUserStatsCache } from "@/lib/media-db";

export async function POST(request: Request) {
  // 1. Fetch pending jobs
  const jobs = await prisma.backgroundJob.findMany({
    where: { status: "pending" },
    take: 50,
    orderBy: { created_at: "asc" }
  });

  if (jobs.length === 0) {
    return NextResponse.json({ message: "No pending jobs." });
  }

  const processedIds: string[] = [];
  const failedIds: string[] = [];

  // 2. Process jobs
  for (const job of jobs) {
    try {
      const payload = job.payload as any;
      if (job.type === "award_badges") {
        await awardBadges(payload.userId);
      } else if (job.type === "update_user_stats") {
        await updateUserStatsCache(payload.userId, payload.mediaType);
      }

      processedIds.push(job.id);
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      failedIds.push(job.id);
    }
  }

  // 3. Mark processed jobs as completed
  if (processedIds.length > 0) {
    await prisma.backgroundJob.updateMany({
      where: { id: { in: processedIds } },
      data: {
        status: "completed",
        processed_at: new Date()
      }
    });
  }

  // Mark failed jobs as failed
  if (failedIds.length > 0) {
    await prisma.backgroundJob.updateMany({
      where: { id: { in: failedIds } },
      data: {
        status: "failed",
        processed_at: new Date()
      }
    });
  }

  // Revalidate the global rankings cache so leaderboards update automatically
  revalidatePath('/rankings');
  // Revalidate profile so user stats are updated
  revalidatePath('/profile');

  return NextResponse.json({
    message: "Processed background jobs.",
    processedCount: processedIds.length,
    failedCount: failedIds.length,
    processedIds,
    failedIds
  });
}
