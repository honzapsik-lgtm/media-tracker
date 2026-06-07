import "dotenv/config";
import { prisma } from "./src/lib/prisma";
prisma.user.findMany().then(u => console.log(u)).finally(() => prisma.$disconnect());
