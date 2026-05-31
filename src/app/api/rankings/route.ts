import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RankingsBody = {
  rankings?: Array<{ mediaId: string; rankPosition: number }>;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to save ranks." }, { status: 401 });
  }

  const body = (await request.json()) as RankingsBody;
  if (!Array.isArray(body.rankings)) {
    return NextResponse.json({ error: "rankings must be an array" }, { status: 400 });
  }

  await prisma.$transaction(
    body.rankings.map((item) =>
      prisma.userRating.updateMany({
        where: { user_id: session.user.id, media_id: item.mediaId },
        data: { rank_position: item.rankPosition },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

