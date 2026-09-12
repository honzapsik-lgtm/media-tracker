import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FriendshipStatus, VisibilityLevel } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ friendsRatings: [] });
    }
    const currentUserId = session.user.id;

    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
    }

    // 1. Get accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { sender_id: currentUserId, status: FriendshipStatus.ACCEPTED },
          { receiver_id: currentUserId, status: FriendshipStatus.ACCEPTED },
        ],
      },
      select: { sender_id: true, receiver_id: true },
    });

    const friendIds = friendships.map((f) =>
      f.sender_id === currentUserId ? f.receiver_id : f.sender_id
    );

    if (friendIds.length === 0) {
      return NextResponse.json({ friendsRatings: [] });
    }

    // 2. Filter out friends whose ratings the current user muted (inbound preference)
    const mutedPrefs = await prisma.userFriendPreference.findMany({
      where: {
        user_id: currentUserId,
        friend_id: { in: friendIds },
        hide_ratings: true,
      },
      select: { friend_id: true },
    });
    const mutedFriendIds = new Set(mutedPrefs.map((p) => p.friend_id));
    const activeFriendIds = friendIds.filter((id) => !mutedFriendIds.has(id));

    // 3. Filter out friends who set ratings visibility to PRIVATE (outbound privacy)
    const privateFriendSettings = await prisma.userPrivacySettings.findMany({
      where: {
        user_id: { in: activeFriendIds },
        ratings_visibility: VisibilityLevel.PRIVATE,
      },
      select: { user_id: true },
    });
    const privateFriendIds = new Set(privateFriendSettings.map((p) => p.user_id));
    const allowedFriendIds = activeFriendIds.filter((id) => !privateFriendIds.has(id));

    if (allowedFriendIds.length === 0) {
      return NextResponse.json({ friendsRatings: [] });
    }

    const ratings = await prisma.userRating.findMany({
      where: {
        media_id: mediaId,
        user_id: { in: allowedFriendIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ friendsRatings: ratings });
  } catch (error) {
    console.error("Error fetching friends ratings:", error);
    return NextResponse.json({ error: "Failed to fetch friends ratings" }, { status: 500 });
  }
}
