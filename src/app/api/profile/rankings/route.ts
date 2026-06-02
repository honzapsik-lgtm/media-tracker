import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatProfileRating } from "@/lib/media-db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ results: [], count: 0 }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const type = searchParams.get("type") || "show";

  const skip = (page - 1) * limit;

  let mediaFilter: any = {};
  if (type === "show") {
    mediaFilter = { startsWith: "tmdb-tv-", not: { contains: "-s" } };
  } else if (type === "season") {
    mediaFilter = { startsWith: "tmdb-tv-", contains: "-s", not: { contains: "-e" } };
  } else if (type === "episode") {
    mediaFilter = { startsWith: "tmdb-tv-", contains: "-e" };
  } else if (type === "movie") {
    mediaFilter = { startsWith: "tmdb-movie-" };
  } else if (type === "game") {
    mediaFilter = { startsWith: "rawg-game-" };
  } else if (type === "manga") {
    mediaFilter = { startsWith: "manga-" };
  }

  const [results, count] = await Promise.all([
    prisma.userRating.findMany({
      where: { user_id: session.user.id, media_id: mediaFilter },
      orderBy: [
        { rank_position: "asc" },
        { score: "desc" }
      ],
      skip,
      take: limit,
    }),
    prisma.userRating.count({
      where: { user_id: session.user.id, media_id: mediaFilter },
    }),
  ]);

  // Sort them so that null rank_positions are at the end, Prisma NULLS FIRST / NULLS LAST varies,
  // but JS sort guarantees it matches Top100Ranker behavior:
  const sorted = [...results].sort((a, b) => {
    if (a.rank_position && b.rank_position) return a.rank_position - b.rank_position;
    if (a.rank_position) return -1;
    if (b.rank_position) return 1;
    return b.score - a.score;
  });

  return NextResponse.json({
    results: sorted.map(formatProfileRating),
    count
  });
}
