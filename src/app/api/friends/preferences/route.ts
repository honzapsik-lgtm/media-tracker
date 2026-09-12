import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const friendId = searchParams.get("friendId");

    if (friendId) {
      const pref = await prisma.userFriendPreference.findUnique({
        where: {
          user_id_friend_id: {
            user_id: session.user.id,
            friend_id: friendId,
          },
        },
      });
      return NextResponse.json({
        preference: pref || { hide_activity: false, hide_ratings: false },
      });
    }

    const allPrefs = await prisma.userFriendPreference.findMany({
      where: { user_id: session.user.id },
    });
    return NextResponse.json({ preferences: allPrefs });
  } catch (error) {
    console.error("Error fetching friend preferences:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { friendId, hide_activity, hide_ratings } = body;

    if (!friendId) {
      return NextResponse.json({ error: "friendId is required" }, { status: 400 });
    }

    const updated = await prisma.userFriendPreference.upsert({
      where: {
        user_id_friend_id: {
          user_id: session.user.id,
          friend_id: friendId,
        },
      },
      update: {
        ...(typeof hide_activity === "boolean" ? { hide_activity } : {}),
        ...(typeof hide_ratings === "boolean" ? { hide_ratings } : {}),
      },
      create: {
        user_id: session.user.id,
        friend_id: friendId,
        hide_activity: typeof hide_activity === "boolean" ? hide_activity : false,
        hide_ratings: typeof hide_ratings === "boolean" ? hide_ratings : false,
      },
    });

    return NextResponse.json({ success: true, preference: updated });
  } catch (error) {
    console.error("Error updating friend preferences:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
