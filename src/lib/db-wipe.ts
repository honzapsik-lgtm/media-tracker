import { prisma } from "@/lib/prisma";

export async function wipeAppData() {
  await prisma.$transaction([
    prisma.userRating.deleteMany(),
    prisma.userWatchlist.deleteMany(),
    prisma.mediaStats.deleteMany(),
    prisma.userRankedList.deleteMany(),
    prisma.backgroundJob.deleteMany(),
    prisma.userStatsCache.deleteMany(),
    prisma.apiCache.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.user.updateMany({
      data: { showcaseBadges: [] },
    }),
  ]);
}
