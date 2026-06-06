import { prisma } from "@/lib/prisma";

export async function recalculateEloForMediaType(mediaType: string) {
  // Reset all existing scores to 1200 for idempotency
  await prisma.globalRanking.updateMany({
    where: { media_type: mediaType },
    data: { elo_score: 1200 },
  });

  const lists = await prisma.userList.findMany({
    where: { media_type: mediaType },
    include: {
      items: {
        orderBy: { rank_position: "asc" },
      },
    },
  });

  const eloScores = new Map<string, number>();
  const getElo = (id: string) => eloScores.get(id) ?? 1200;
  const K = 32;

  // Process matchups with sliding window
  for (const list of lists) {
    const items = list.items;
    for (let i = 0; i < items.length; i++) {
      const winnerId = items[i].media_id;
      // Cap matchups to sliding window of 5
      const windowEnd = Math.min(i + 1 + 5, items.length);
      
      for (let j = i + 1; j < windowEnd; j++) {
        const loserId = items[j].media_id;

        let rA = getElo(winnerId);
        let rB = getElo(loserId);

        const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
        const eB = 1 / (1 + Math.pow(10, (rA - rB) / 400));

        rA = rA + K * (1 - eA);
        rB = rB + K * (0 - eB);

        eloScores.set(winnerId, rA);
        eloScores.set(loserId, rB);
      }
    }
  }

  // Bulk upsert new elos
  const updates = Array.from(eloScores.entries()).map(([mediaId, elo]) => {
    return prisma.globalRanking.upsert({
      where: { media_id: mediaId },
      update: { elo_score: elo, media_type: mediaType },
      create: { media_id: mediaId, media_type: mediaType, elo_score: elo },
    });
  });

  for (let i = 0; i < updates.length; i += 100) {
    await prisma.$transaction(updates.slice(i, i + 100));
  }

  // Assign sequential ranks based on sorted elo scores
  const allRankings = await prisma.globalRanking.findMany({
    where: { media_type: mediaType },
    orderBy: { elo_score: "desc" },
    select: { media_id: true },
  });

  const rankUpdates = allRankings.map((item, index) => {
    return prisma.globalRanking.update({
      where: { media_id: item.media_id },
      data: { rank: index + 1 },
    });
  });

  for (let i = 0; i < rankUpdates.length; i += 100) {
    await prisma.$transaction(rankUpdates.slice(i, i + 100));
  }
}
