const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany();
  console.log(users.map(u => u.email).join('\n'));
}

main().finally(() => prisma.$disconnect());
