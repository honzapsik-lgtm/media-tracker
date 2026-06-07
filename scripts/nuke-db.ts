import "dotenv/config";
import { wipeAppData } from "../src/lib/db-wipe";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Nuking database (preserving auth tables and admin rights)...");

  // Backup admin users before wiping
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true }
  });

  await wipeAppData();

  // Explicitly restore admin rights
  if (admins.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: admins.map(a => a.id) } },
      data: { role: 'admin' }
    });
  }

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
