import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inferMediaType, refreshMediaStats } from "@/lib/media-db";

type ReviewBody = {
  mediaId?: string;
  reviewText?: string;
  mediaTitle?: string;
  mediaImage?: string | null;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ reviewText: null });

  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId");
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const rating = await prisma.userRating.findUnique({
    where: { user_id_media_id: { user_id: session.user.id, media_id: mediaId } },
    select: { review_text: true },
  });

  return NextResponse.json({ reviewText: rating?.review_text ?? null });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to review." }, { status: 401 });
  }

  const body = (await request.json()) as ReviewBody;
  if (!body.mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  await prisma.userRating.upsert({
    where: { user_id_media_id: { user_id: session.user.id, media_id: body.mediaId } },
    update: {
      review_text: body.reviewText?.trim() || null,
      media_title: body.mediaTitle,
      media_image: body.mediaImage ?? null,
      username: user?.name ?? user?.email?.split("@")[0] ?? "Anonymous",
      avatar_url: user?.image ?? null,
    },
    create: {
      user_id: session.user.id,
      media_id: body.mediaId,
      score: 50,
      review_text: body.reviewText?.trim() || null,
      media_title: body.mediaTitle,
      media_image: body.mediaImage ?? null,
      username: user?.name ?? user?.email?.split("@")[0] ?? "Anonymous",
      avatar_url: user?.image ?? null,
    },
  });

  await refreshMediaStats(body.mediaId, inferMediaType(body.mediaId));

  return NextResponse.json({ ok: true });
}

