import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FriendshipStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    // Fetch accepted friendships where current user is either sender or receiver
    const acceptedFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { sender_id: currentUserId, status: FriendshipStatus.ACCEPTED },
          { receiver_id: currentUserId, status: FriendshipStatus.ACCEPTED },
        ],
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, image: true },
        },
        receiver: {
          select: { id: true, name: true, username: true, image: true },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    // Fetch friend preferences for current user
    const preferences = await prisma.userFriendPreference.findMany({
      where: { user_id: currentUserId },
    });
    const prefMap = new Map<string, { hide_activity: boolean; hide_ratings: boolean }>();
    for (const p of preferences) {
      prefMap.set(p.friend_id, {
        hide_activity: p.hide_activity,
        hide_ratings: p.hide_ratings,
      });
    }

    const friends = acceptedFriendships.map((f) => {
      const isSender = f.sender_id === currentUserId;
      const friendData = isSender ? f.receiver : f.sender;
      const pref = prefMap.get(friendData.id) || { hide_activity: false, hide_ratings: false };
      return {
        ...friendData,
        friendshipId: f.id,
        since: f.updated_at,
        hide_activity: pref.hide_activity,
        hide_ratings: pref.hide_ratings,
      };
    });

    // Fetch pending requests received
    const pendingReceived = await prisma.friendship.findMany({
      where: {
        receiver_id: currentUserId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, image: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Fetch pending requests sent
    const pendingSent = await prisma.friendship.findMany({
      where: {
        sender_id: currentUserId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        receiver: {
          select: { id: true, name: true, username: true, image: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({
      friends,
      pendingReceived: pendingReceived.map((r) => ({
        friendshipId: r.id,
        sender: r.sender,
        created_at: r.created_at,
      })),
      pendingSent: pendingSent.map((s) => ({
        friendshipId: s.id,
        receiver: s.receiver,
        created_at: s.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    const body = await req.json();
    const { targetUserId, targetUsername } = body;

    let targetUser = null;
    if (targetUserId) {
      targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, username: true },
      });
    } else if (targetUsername) {
      targetUser = await prisma.user.findFirst({
        where: {
          username: {
            equals: targetUsername.trim(),
            mode: "insensitive",
          },
        },
        select: { id: true, name: true, username: true },
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === currentUserId) {
      return NextResponse.json({ error: "You cannot add yourself as a friend" }, { status: 400 });
    }

    // Check existing friendship in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { sender_id: currentUserId, receiver_id: targetUser.id },
          { sender_id: targetUser.id, receiver_id: currentUserId },
        ],
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        return NextResponse.json({ error: "You are already friends with this user" }, { status: 400 });
      }
      if (existing.status === FriendshipStatus.BLOCKED) {
        return NextResponse.json({ error: "Cannot send friend request" }, { status: 403 });
      }
      if (existing.status === FriendshipStatus.PENDING) {
        if (existing.sender_id === currentUserId) {
          return NextResponse.json({ error: "Friend request already sent" }, { status: 400 });
        } else {
          // The other user already sent us a request! Auto-accept it.
          const accepted = await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: FriendshipStatus.ACCEPTED },
          });
          return NextResponse.json({ success: true, message: "Friend request accepted!", friendship: accepted });
        }
      }
      // If DECLINED, reset to PENDING
      const renewed = await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          sender_id: currentUserId,
          receiver_id: targetUser.id,
          status: FriendshipStatus.PENDING,
        },
      });
      return NextResponse.json({ success: true, message: "Friend request sent!", friendship: renewed });
    }

    const newFriendship = await prisma.friendship.create({
      data: {
        sender_id: currentUserId,
        receiver_id: targetUser.id,
        status: FriendshipStatus.PENDING,
      },
    });

    return NextResponse.json({ success: true, message: "Friend request sent!", friendship: newFriendship });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return NextResponse.json({ error: "Failed to send friend request" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    const body = await req.json();
    const { friendshipId, action } = body;

    if (!friendshipId || !action) {
      return NextResponse.json({ error: "Friendship ID and action are required" }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    if (action === "ACCEPT") {
      // Must be the receiver to accept
      if (friendship.receiver_id !== currentUserId) {
        return NextResponse.json({ error: "Only the recipient can accept a friend request" }, { status: 403 });
      }
      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: FriendshipStatus.ACCEPTED },
      });
      return NextResponse.json({ success: true, friendship: updated });
    }

    if (action === "DECLINE") {
      if (friendship.receiver_id !== currentUserId && friendship.sender_id !== currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: FriendshipStatus.DECLINED },
      });
      return NextResponse.json({ success: true, friendship: updated });
    }

    if (action === "BLOCK") {
      if (friendship.receiver_id !== currentUserId && friendship.sender_id !== currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: FriendshipStatus.BLOCKED },
      });
      return NextResponse.json({ success: true, friendship: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating friendship:", error);
    return NextResponse.json({ error: "Failed to update friendship" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    const { searchParams } = new URL(req.url);
    const friendshipId = searchParams.get("friendshipId");
    const friendUserId = searchParams.get("friendUserId");

    let friendship = null;

    if (friendshipId) {
      friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
    } else if (friendUserId) {
      friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { sender_id: currentUserId, receiver_id: friendUserId },
            { sender_id: friendUserId, receiver_id: currentUserId },
          ],
        },
      });
    }

    if (!friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    if (friendship.sender_id !== currentUserId && friendship.receiver_id !== currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.friendship.delete({
      where: { id: friendship.id },
    });

    return NextResponse.json({ success: true, message: "Friendship removed" });
  } catch (error) {
    console.error("Error deleting friendship:", error);
    return NextResponse.json({ error: "Failed to delete friendship" }, { status: 500 });
  }
}
