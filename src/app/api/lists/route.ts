import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get("media_type");

    const lists = await prisma.userList.findMany({
      where: {
        user_id: session.user.id,
        ...(mediaType ? { media_type: mediaType } : {}),
      },
      include: {
        _count: { select: { items: true } }
      },
      orderBy: { updated_at: "desc" },
    });

    return NextResponse.json({ lists });
  } catch (error) {
    await appLog({
      level: "error",
      event: "api.lists.get.error",
      requestId,
      error,
      persist: true,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, media_type } = body;

    if (!title || !media_type) {
      return NextResponse.json({ error: "Title and media_type are required" }, { status: 400 });
    }

    const validMediaTypes = ["movie", "show", "manga", "season", "episode", "game"];
    if (!validMediaTypes.includes(media_type)) {
      return NextResponse.json({ error: "Invalid media_type" }, { status: 400 });
    }

    const newList = await prisma.userList.create({
      data: {
        user_id: session.user.id,
        title,
        media_type,
      },
    });

    return NextResponse.json({ list: newList }, { status: 201 });
  } catch (error) {
    await appLog({
      level: "error",
      event: "api.lists.post.error",
      requestId,
      error,
      persist: true,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
