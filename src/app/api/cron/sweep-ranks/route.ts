import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.$executeRaw`
      WITH Ranked AS (
        SELECT media_id, RANK() OVER (PARTITION BY media_type ORDER BY elo_score DESC) as new_rank
        FROM global_rankings
      )
      UPDATE global_rankings
      SET rank = Ranked.new_rank
      FROM Ranked
      WHERE global_rankings.media_id = Ranked.media_id;
    `;

    await appLog({
      level: "info",
      event: "cron.sweep_ranks.success",
      requestId,
      persist: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await appLog({
      level: "error",
      event: "cron.sweep_ranks.error",
      requestId,
      error,
      persist: true,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
