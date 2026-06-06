import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listId = (await params).id;

    const list = await prisma.userList.findUnique({
      where: { id: listId },
      include: {
        items: {
          orderBy: { rank_position: "asc" },
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (list.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userRatings = await prisma.userRating.findMany({
      where: {
        user_id: session.user.id,
        media_id: { in: list.items.map(i => i.media_id) }
      },
      select: { media_id: true, score: true, media_release_date: true, criteria_scores: true }
    });
    
    const ratingsMap = new Map(userRatings.map(r => [r.media_id, r]));

    // Format the items to match ProfileMediaItem
    const formattedItems = list.items.map((item) => {
      const rating = ratingsMap.get(item.media_id);
      return {
        mediaId: item.media_id,
        score: rating?.score ?? 0,
        hasRated: rating !== undefined,
        reviewText: null,
        title: item.media_title || `Unknown Title (${item.media_id})`,
        image: item.media_image || null,
        type: list.media_type,
        rankPosition: item.rank_position,
        releaseDate: rating?.media_release_date || null,
        criteriaScores: rating?.criteria_scores || undefined,
      };
    });

    return NextResponse.json({ list, items: formattedItems });
  } catch (error) {
    console.error("Failed to fetch custom list", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listId = (await params).id;
    const body = await request.json();
    const { title } = body;

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const list = await prisma.userList.findUnique({ where: { id: listId } });
    if (!list || list.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden or not found" }, { status: 403 });
    }

    const updatedList = await prisma.userList.update({
      where: { id: listId },
      data: { title },
    });

    return NextResponse.json({ list: updatedList });
  } catch (error) {
    console.error("Failed to update list", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listId = (await params).id;

    const list = await prisma.userList.findUnique({ where: { id: listId } });
    if (!list || list.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden or not found" }, { status: 403 });
    }

    await prisma.userList.delete({
      where: { id: listId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete list", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
