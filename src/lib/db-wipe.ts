import { prisma } from "@/lib/prisma";

export async function wipeAppData() {
  await prisma.$transaction([
    prisma.episode.deleteMany(),
    prisma.season.deleteMany(),
    prisma.media.deleteMany(),
    prisma.userRating.deleteMany(),
    prisma.userWatchlist.deleteMany(),
    prisma.mediaStats.deleteMany(),
    prisma.globalRanking.deleteMany(),
    prisma.userListItem.deleteMany(),
    prisma.userList.deleteMany(),
    prisma.backgroundJob.deleteMany(),
    prisma.userStatsCache.deleteMany(),
    prisma.apiCache.deleteMany(),
    prisma.systemLog.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.person.deleteMany(),
    prisma.company.deleteMany(),
    prisma.user.updateMany({
      data: { showcaseBadges: [] },
    }),
  ]);
}
