import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Nuking database (preserving auth tables)...");

  await prisma.$transaction([
    prisma.userRating.deleteMany(),
    prisma.userWatchlist.deleteMany(),
    prisma.mediaStats.deleteMany(),
    prisma.userRankedList.deleteMany(),
    prisma.backgroundJob.deleteMany(),
    prisma.userStatsCache.deleteMany(),
    prisma.apiCache.deleteMany(), // Also wipe api cache just in case
    prisma.userBadge.deleteMany(), // And badges
  ]);

  console.log("Database successfully nuked!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
