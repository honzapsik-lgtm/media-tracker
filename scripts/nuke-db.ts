import "dotenv/config";
import { wipeAppData } from "../src/lib/db-wipe";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Nuking database (preserving auth tables)...");

  await wipeAppData();

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
