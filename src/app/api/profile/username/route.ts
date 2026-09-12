import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,25}$/;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({
        available: false,
        error: "Nicknames must be 3-25 characters and contain only letters, numbers, underscores, hyphens, and dots."
      });
    }

    const session = await getServerSession(authOptions);
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
        ...(session?.user?.id ? { id: { not: session.user.id } } : {}),
      },
      select: { id: true },
    });

    return NextResponse.json({ available: !existing });
  } catch (error) {
    console.error("Error checking username availability:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const cleanUsername = body.username?.trim();

    if (!cleanUsername) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    }

    if (!USERNAME_REGEX.test(cleanUsername)) {
      return NextResponse.json({
        error: "Nicknames must be 3-25 characters and contain only letters, numbers, underscores, hyphens, and dots."
      }, { status: 400 });
    }

    // Case-insensitive uniqueness check
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: cleanUsername,
          mode: "insensitive",
        },
        id: { not: session.user.id },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "Nickname is already taken by another user." }, { status: 409 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { username: cleanUsername },
      select: { id: true, username: true, name: true },
    });

    // Ensure privacy settings record exists
    await prisma.userPrivacySettings.upsert({
      where: { user_id: session.user.id },
      update: {},
      create: { user_id: session.user.id },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating username:", error);
    return NextResponse.json({ error: "Failed to update nickname" }, { status: 500 });
  }
}
