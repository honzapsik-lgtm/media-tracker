import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type WatchlistBody = {
  mediaId?: string;
  title?: string;
  image?: string | null;
  type?: string;
  status?: string;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId");

  if (mediaId) {
    const item = await prisma.userWatchlist.findUnique({
      where: { user_id_media_id: { user_id: session.user.id, media_id: mediaId } },
      select: { status: true },
    });
    return NextResponse.json({ status: item?.status ?? null });
  }

  const items = await prisma.userWatchlist.findMany({
    where: { user_id: session.user.id },
    orderBy: { added_at: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to track media." }, { status: 401 });
  }

  const body = (await request.json()) as WatchlistBody;
  if (!body.mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const item = await prisma.userWatchlist.upsert({
    where: { user_id_media_id: { user_id: session.user.id, media_id: body.mediaId } },
    update: {
      media_title: body.title,
      media_image: body.image ?? null,
      media_type: body.type,
      status: body.status ?? "plan_to_watch",
    },
    create: {
      user_id: session.user.id,
      media_id: body.mediaId,
      media_title: body.title,
      media_image: body.image ?? null,
      media_type: body.type,
      status: body.status ?? "plan_to_watch",
    },
  });

  return NextResponse.json(item);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json()) as WatchlistBody;
  if (!body.mediaId || !body.status) {
    return NextResponse.json({ error: "mediaId and status are required" }, { status: 400 });
  }

  const item = await prisma.userWatchlist.update({
    where: { user_id_media_id: { user_id: session.user.id, media_id: body.mediaId } },
    data: { status: body.status },
  });

  return NextResponse.json(item);
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId");
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  await prisma.userWatchlist.deleteMany({
    where: { user_id: session.user.id, media_id: mediaId },
  });

  return NextResponse.json({ ok: true });
}

