import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const media = await prisma.media.findUnique({
      where: { id },
      select: { franchiseSyncedAt: true, relatedMediaId: true }
    });

    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let isSynced = !!media.franchiseSyncedAt;
    if (!isSynced && media.relatedMediaId) {
      const rootMedia = await prisma.media.findUnique({
        where: { id: media.relatedMediaId },
        select: { franchiseSyncedAt: true }
      });
      isSynced = !!rootMedia?.franchiseSyncedAt;
    }

    return NextResponse.json({ isSynced });
  } catch (error) {
    console.error("Failed to check sync status:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
