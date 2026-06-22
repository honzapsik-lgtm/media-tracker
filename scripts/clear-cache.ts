import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Clearing ApiCache table...");
  const result = await prisma.apiCache.deleteMany({});
  console.log(`Successfully cleared ${result.count} entries from ApiCache!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
