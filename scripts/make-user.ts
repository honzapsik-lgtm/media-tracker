import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: npm run make-user -- user@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "user" },
  });

  console.log(`Demoted ${user.email} to user.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
