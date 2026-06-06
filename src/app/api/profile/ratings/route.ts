import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserRatings } from "@/lib/media-db";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ results: [], count: 0 }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const data = await getUserRatings(session.user.id, Math.max(1, page), Math.max(1, limit));

  const listItems = await prisma.userListItem.findMany({
    where: { list: { user_id: session.user.id } },
    select: { media_id: true }
  });
  const userListMediaIds = new Set(listItems.map(i => i.media_id));

  data.results = data.results.map(r => ({
    ...r,
    inUserList: userListMediaIds.has(r.mediaId)
  }));

  return NextResponse.json(data);
}
