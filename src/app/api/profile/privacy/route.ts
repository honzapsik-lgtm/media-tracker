import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VisibilityLevel } from "@prisma/client";

const VALID_LEVELS: VisibilityLevel[] = [
  VisibilityLevel.PUBLIC,
  VisibilityLevel.FRIENDS_ONLY,
  VisibilityLevel.PRIVATE,
];

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.userPrivacySettings.upsert({
      where: { user_id: session.user.id },
      update: {},
      create: { user_id: session.user.id },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching privacy settings:", error);
    return NextResponse.json({ error: "Failed to fetch privacy settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const dataToUpdate: Record<string, VisibilityLevel> = {};

    if (body.profile_visibility && VALID_LEVELS.includes(body.profile_visibility)) {
      dataToUpdate.profile_visibility = body.profile_visibility;
    }
    if (body.ratings_visibility && VALID_LEVELS.includes(body.ratings_visibility)) {
      dataToUpdate.ratings_visibility = body.ratings_visibility;
    }
    if (body.watchlist_visibility && VALID_LEVELS.includes(body.watchlist_visibility)) {
      dataToUpdate.watchlist_visibility = body.watchlist_visibility;
    }
    if (body.activity_visibility && VALID_LEVELS.includes(body.activity_visibility)) {
      dataToUpdate.activity_visibility = body.activity_visibility;
    }

    const updated = await prisma.userPrivacySettings.upsert({
      where: { user_id: session.user.id },
      update: dataToUpdate,
      create: {
        user_id: session.user.id,
        ...dataToUpdate,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    console.error("Error updating privacy settings:", error);
    return NextResponse.json({ error: "Failed to update privacy settings" }, { status: 500 });
  }
}
