import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/logger";
import { getOrCreateRequestId } from "@/lib/request-id";
import { enqueueJob } from "@/lib/jobs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listId = (await params).id;
    const body = await request.json();
    const { mediaIds } = body;

    if (!Array.isArray(mediaIds)) {
      return NextResponse.json({ error: "mediaIds must be an array" }, { status: 400 });
    }

    const list = await prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userListItem.deleteMany({
        where: { list_id: listId },
      });

      if (mediaIds.length > 0) {
        // mediaIds can be strings or objects { id, title, image }
        const itemsToCreate = mediaIds.map((mediaItem: any, index: number) => {
          const mediaId = typeof mediaItem === 'string' ? mediaItem : mediaItem.id || mediaItem.mediaId;
          const mediaTitle = typeof mediaItem === 'object' ? mediaItem.title : null;
          const mediaImage = typeof mediaItem === 'object' ? mediaItem.image : null;

          return {
            list_id: listId,
            media_id: mediaId,
            media_title: mediaTitle,
            media_image: mediaImage,
            rank_position: index + 1,
          };
        });
        await tx.userListItem.createMany({
          data: itemsToCreate,
        });
      }
    });

    await enqueueJob({
      type: "recalculate_elo",
      payload: { mediaType: list.media_type },
      dedupeKey: `recalculate_elo_${list.media_type}`,
      requestId,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    await appLog({
      level: "error",
      event: "api.lists.items.post.error",
      requestId,
      error,
      persist: true,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
