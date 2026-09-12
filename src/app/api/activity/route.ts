import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FriendshipStatus, VisibilityLevel } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ activities: [] });
    }
    const currentUserId = session.user.id;

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "friends"; // 'friends' | 'all' | 'self'

    // 1. Get accepted friendships
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

    // 2. Filter out friends muted by current user (inbound preference: hide_activity)
    const mutedPrefs = await prisma.userFriendPreference.findMany({
      where: {
        user_id: currentUserId,
        friend_id: { in: friendIds },
        hide_activity: true,
      },
      select: { friend_id: true },
    });
    const mutedFriendIds = new Set(mutedPrefs.map((p) => p.friend_id));
    const activeFriendIds = friendIds.filter((id) => !mutedFriendIds.has(id));

    // 3. Filter out friends whose privacy settings hide activity (outbound: PRIVATE)
    const privateFriendSettings = await prisma.userPrivacySettings.findMany({
      where: {
        user_id: { in: activeFriendIds },
        activity_visibility: VisibilityLevel.PRIVATE,
      },
      select: { user_id: true },
    });
    const privateFriendIds = new Set(privateFriendSettings.map((p) => p.user_id));
    const allowedFriendIds = activeFriendIds.filter((id) => !privateFriendIds.has(id));

    let targetUserIds: string[] = [];
    if (scope === "self") {
      targetUserIds = [currentUserId];
    } else if (scope === "friends") {
      targetUserIds = allowedFriendIds;
    } else {
      // "all" - friends and self
      targetUserIds = [currentUserId, ...allowedFriendIds];
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    const activities = await prisma.userActivity.findMany({
      where: {
        user_id: { in: targetUserIds },
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
      take: 50,
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
