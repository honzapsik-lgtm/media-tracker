import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const person = await prisma.person.findFirst({
    where: { name: "Takahiro Sakurai" }
  });
  if (!person) return;
  const cast = (person.mergedCredits as any)?.cast || [];
  const matches = cast.filter((c: any) => c.title.toLowerCase().includes("battle spirits"));
  console.log("Battle Spirits items in DB:", JSON.stringify(matches, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
