import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Completely wiping ALL data from database...");

  await prisma.$transaction([
    // User social & preferences
    prisma.userActivity.deleteMany(),
    prisma.userFriendPreference.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.userPrivacySettings.deleteMany(),
    prisma.activityLog.deleteMany(),

    // User ratings & lists
    prisma.userRating.deleteMany(),
    prisma.userWatchlist.deleteMany(),
    prisma.userListItem.deleteMany(),
    prisma.userList.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.userStatsCache.deleteMany(),

    // Auth tables
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),

    // Media & caches
    prisma.episode.deleteMany(),
    prisma.season.deleteMany(),
    prisma.media.deleteMany(),
    prisma.mediaStats.deleteMany(),
    prisma.globalRanking.deleteMany(),
    prisma.backgroundJob.deleteMany(),
    prisma.systemLog.deleteMany(),
    prisma.apiCache.deleteMany(),
    prisma.person.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  console.log("Database completely wiped clean! All tables are empty.");
}

main()
  .catch((e) => {
    console.error("Error wiping database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
