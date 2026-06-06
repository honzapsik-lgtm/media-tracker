import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    await requireAdmin();
    const { userId } = await params;

    const [
      user,
      accounts,
      sessions,
      statsCache,
      ratingsCount,
      watchlistCount,
      badgesCount,
      rankedListsCount,
      jobs,
      logs
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          created_at: true,
          image: true,
        },
      }),
      prisma.account.findMany({ where: { userId } }),
      prisma.session.findMany({ where: { userId } }),
      prisma.userStatsCache.findMany({ where: { user_id: userId } }),
      prisma.userRating.count({ where: { user_id: userId } }),
      prisma.userWatchlist.count({ where: { user_id: userId } }),
      prisma.userBadge.count({ where: { user_id: userId } }),
      prisma.userList.count({ where: { user_id: userId } }),
      // For JSON fields, Prisma doesn't support deep filtering directly in all DBs natively via simple syntax easily,
      // but we can query by raw if needed. Since we just need recent jobs for a user, 
      // let's fetch recent jobs and filter in JS if it's too complex, or use a raw query.
      // Assuming payload has `userId` at top level. In Postgres, we can do path queries.
      prisma.$queryRaw`SELECT * FROM "BackgroundJob" WHERE payload->>'userId' = ${userId} ORDER BY created_at DESC LIMIT 10`,
      prisma.systemLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
      })
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user,
      accounts,
      sessions,
      statsCache,
      aggregates: {
        ratings: ratingsCount,
        watchlist: watchlistCount,
        badges: badgesCount,
        rankedLists: rankedListsCount,
      },
      jobs,
      logs,
    });
  } catch (error: any) {
    await appLog({
      level: "error",
      event: "admin.api.user.get.failed",
      requestId,
      error,
      persist: true,
    });

    if (error.code === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
