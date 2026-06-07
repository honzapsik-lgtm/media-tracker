import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { RankingConfig } from "../src/config/ranking";

const MEDIA_TYPES = ['movie', 'show', 'season', 'episode', 'game', 'manga'];

// Helper to calculate edge weight based on emotional gap and time decay
function calculateEdgeWeight(gapMultiplier: number, updatedAt: Date): number {
  const now = new Date();
  const daysOld = Math.max(0, (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Time decay
  const decay = Math.pow(0.5, daysOld / RankingConfig.TIME_DECAY_HALF_LIFE_DAYS);
  const timeDecay = Math.max(RankingConfig.TIME_DECAY_FLOOR, decay);
  
  // Weight = Emotional Gap Multiplier * Time Decay
  return gapMultiplier * timeDecay;
}

async function processMediaType(mediaType: string) {
  console.log(`\n--- Processing media_type: ${mediaType} ---`);
  
  // Global Adjacency Map for this media type
  // Directed graph: loser_id -> winner_id -> total_weight
  const graph = new Map<string, Map<string, number>>();
  const allMediaIds = new Set<string>();
  const appearanceCount = new Map<string, number>();

  // Temporary storage to collect lists per user
  // user_id -> Array of lists
  const userLists = new Map<string, Array<{ id: string, updatedAt: Date, items: any[] }>>();

  // Extract data via Prisma using cursor-based pagination
  let cursor: string | undefined = undefined;
  let listCount = 0;

  while (true) {
    const batch = await prisma.userList.findMany({
      where: { media_type: mediaType },
      take: 1000,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: {
        items: {
          select: { media_id: true, rank_position: true }
        }
      }
    });

    if (batch.length === 0) break;

    for (const list of batch) {
      if (!userLists.has(list.user_id)) {
        userLists.set(list.user_id, []);
      }
      userLists.get(list.user_id)!.push({
        id: list.id,
        updatedAt: list.updated_at,
        items: list.items,
      });
      listCount++;
      
      // Keep track of all media nodes and appearances
      for (const item of list.items) {
        allMediaIds.add(item.media_id);
        // We track total list appearances across all lists (even before per-user deduplication)
        // Alternatively, we could count only unique users. The requirement says "unique user lists",
        // so counting every list appearance makes sense here.
        appearanceCount.set(item.media_id, (appearanceCount.get(item.media_id) || 0) + 1);
      }
    }

    cursor = batch[batch.length - 1].id;
  }

  console.log(`Fetched ${listCount} lists for ${userLists.size} users.`);

  // Fetch explicit UserRatings for the users
  const userRatings = new Map<string, Map<string, number>>();
  const userIds = Array.from(userLists.keys());
  
  // Batch fetch user ratings (batching by 500 users at a time)
  for (let i = 0; i < userIds.length; i += 500) {
    const batchUserIds = userIds.slice(i, i + 500);
    const ratings = await prisma.userRating.findMany({
      where: { user_id: { in: batchUserIds } },
      select: { user_id: true, media_id: true, score: true }
    });
    for (const r of ratings) {
      if (!userRatings.has(r.user_id)) {
        userRatings.set(r.user_id, new Map<string, number>());
      }
      userRatings.get(r.user_id)!.set(r.media_id, r.score);
    }
  }

  // Pre-calculate total_losses per media item (sum of outgoing edge weights)
  const totalLosses = new Map<string, number>();
  for (const mediaId of allMediaIds) {
    totalLosses.set(mediaId, 0);
  }

  // Process per-user deduplication
  for (const [userId, lists] of userLists.entries()) {
    // Sort lists from oldest to newest so newest overwrites older conflicts
    lists.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    // Map: pairKey -> { winner, loser, gap, updatedAt }
    const userEdges = new Map<string, { winner: string, loser: string, gap: number, updatedAt: Date }>();
    const ratingsMap = userRatings.get(userId) || new Map<string, number>();

    for (const list of lists) {
      const items = list.items;
      // Sort items by rank_position
      items.sort((a, b) => a.rank_position - b.rank_position);

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const winner = items[i]; // lower rank_position means better
          const loser = items[j];
          
          // Consistent pair key
          const pairKey = [winner.media_id, loser.media_id].sort().join('|');
          
          // Calculate explicit Emotional Gap
          const winnerScore = ratingsMap.get(winner.media_id);
          const loserScore = ratingsMap.get(loser.media_id);
          let gapMultiplier = RankingConfig.EMOTIONAL_GAP_BASE_MULTIPLIER; // standard default weight

          if (winnerScore !== undefined && loserScore !== undefined) {
            const rawGap = Math.max(0, winnerScore - loserScore);
            gapMultiplier = RankingConfig.EMOTIONAL_GAP_BASE_MULTIPLIER + 
              (rawGap / RankingConfig.EMOTIONAL_GAP_MAX_SCORE) * RankingConfig.EMOTIONAL_GAP_SCALING_FACTOR;
          }

          userEdges.set(pairKey, {
            winner: winner.media_id,
            loser: loser.media_id,
            gap: gapMultiplier,
            updatedAt: list.updatedAt
          });
        }
      }
    }

    // Add this user's "absolute truth" edges to the global graph
    for (const edge of userEdges.values()) {
      const weight = calculateEdgeWeight(edge.gap, edge.updatedAt);

      if (!graph.has(edge.loser)) {
        graph.set(edge.loser, new Map<string, number>());
      }
      const outgoing = graph.get(edge.loser)!;
      outgoing.set(edge.winner, (outgoing.get(edge.winner) || 0) + weight);
      
      totalLosses.set(edge.loser, totalLosses.get(edge.loser)! + weight);
    }
  }

  // Clear memory
  userLists.clear();
  userRatings.clear();

  const N = allMediaIds.size;
  console.log(`Graph built. Nodes: ${N}.`);

  if (N === 0) {
    console.log(`No data for ${mediaType}. Skipping...`);
    return;
  }

  // Initialize PageRank scores uniformly at 1.0
  let scores = new Map<string, number>();
  for (const mediaId of allMediaIds) {
    scores.set(mediaId, 1.0);
  }

  // Power Iteration
  console.log(`Starting Power Iteration for ${mediaType}...`);
  for (let iter = 0; iter < RankingConfig.MAX_ITERATIONS; iter++) {
    let nextScores = new Map<string, number>();
    for (const mediaId of allMediaIds) {
      nextScores.set(mediaId, 0);
    }
    
    let currentTotalPoints = 0;
    for (const score of scores.values()) {
      currentTotalPoints += score;
    }

    let danglingSum = 0;

    // Sum the incoming points from every item it defeated
    for (const [node, score] of scores.entries()) {
      const outgoing = graph.get(node);
      const nodeLosses = totalLosses.get(node) || 0;
      
      if (!outgoing || outgoing.size === 0 || nodeLosses === 0) {
        // Dangling node (no outgoing edges) -> its points need redistribution
        danglingSum += score;
      } else {
        // Points transferred from a loser equal: (Loser's Current Score / Loser's Total Network Losses) * Edge Weight
        for (const [winner, weight] of outgoing.entries()) {
          const transfer = (score / nodeLosses) * weight;
          nextScores.set(winner, nextScores.get(winner)! + transfer);
        }
      }
    }

    // Apply Damping Factor and Universal Basic Income (UBI)
    const ubi = (RankingConfig.UNIVERSAL_BASIC_INCOME_SHARE * currentTotalPoints) / N;
    // Dangling nodes are redistributed to prevent the total points from leaking out
    const danglingShare = (RankingConfig.DAMPING_FACTOR * danglingSum) / N;

    for (const mediaId of allMediaIds) {
      let accumulated = nextScores.get(mediaId)!;
      nextScores.set(mediaId, (accumulated * RankingConfig.DAMPING_FACTOR) + ubi + danglingShare);
    }

    // Check convergence (Max Delta drops below 0.00001)
    let maxDiff = 0;
    for (const mediaId of allMediaIds) {
      const diff = Math.abs((nextScores.get(mediaId) || 0) - (scores.get(mediaId) || 0));
      if (diff > maxDiff) maxDiff = diff;
    }

    scores = nextScores;

    if (maxDiff < RankingConfig.CONVERGENCE_THRESHOLD) {
      console.log(`Converged at iteration ${iter + 1}`);
      break;
    }
    if (iter === RankingConfig.MAX_ITERATIONS - 1) {
      console.log(`Max iterations reached without full convergence (maxDiff: ${maxDiff})`);
    }
  }

  // Calculate Win-Rate Efficiency Score
  const finalScores: Array<{ mediaId: string, score: number, appearanceCount: number }> = [];
  
  for (const [mediaId, rawScore] of scores.entries()) {
    const appearances = appearanceCount.get(mediaId) || 0;
    // Efficiency: Raw Prestige / Number of Unique Lists
    const efficiencyScore = appearances > 0 ? (rawScore / appearances) : 0;
    finalScores.push({ mediaId, score: efficiencyScore, appearanceCount: appearances });
  }

  // Hard Threshold and Sorting
  const qualified = finalScores.filter(item => item.appearanceCount >= RankingConfig.MIN_LIST_APPEARANCES);
  const unqualified = finalScores.filter(item => item.appearanceCount < RankingConfig.MIN_LIST_APPEARANCES);

  qualified.sort((a, b) => b.score - a.score);

  // Build DB updates
  console.log(`Writing back to DB for ${mediaType}...`);
  
  const transactions: any[] = [];

  // Upsert Qualified Items
  for (let i = 0; i < qualified.length; i++) {
    const item = qualified[i];
    const rank = i + 1; // 1-indexed global rank
    const scaledScore = 1200 + Math.log10(item.score * N) * 400; // rough scaling
    const finalElo = isNaN(scaledScore) ? 1200 : scaledScore;

    transactions.push(
      prisma.globalRanking.upsert({
        where: { media_id: item.mediaId },
        update: { media_type: mediaType, elo_score: finalElo, rank: rank },
        create: { media_id: item.mediaId, media_type: mediaType, elo_score: finalElo, rank: rank }
      })
    );
  }

  // Upsert Unqualified Items (Rank = null)
  for (const item of unqualified) {
    const scaledScore = 1200 + Math.log10(item.score * N) * 400;
    const finalElo = isNaN(scaledScore) ? 1200 : scaledScore;

    transactions.push(
      prisma.globalRanking.upsert({
        where: { media_id: item.mediaId },
        update: { media_type: mediaType, elo_score: finalElo, rank: null },
        create: { media_id: item.mediaId, media_type: mediaType, elo_score: finalElo, rank: null }
      })
    );
  }

  // Execute in batches of 500 to prevent Prisma limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(batch);
  }

  console.log(`Finished writing back DB for ${mediaType}.`);

  // Explicitly clear references for garbage collection
  graph.clear();
  scores.clear();
  allMediaIds.clear();
  appearanceCount.clear();
}

async function main() {
  console.log("Starting Rank Aggregation Engine...");
  for (const mediaType of MEDIA_TYPES) {
    await processMediaType(mediaType);
  }
  console.log("Rank Aggregation completed globally.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
