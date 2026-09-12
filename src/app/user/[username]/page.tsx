import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatProfileRating } from "@/lib/media-db";
import OtherUserProfileView from "@/components/OtherUserProfileView";
import { FriendshipStatus, VisibilityLevel } from "@prisma/client";
import { FriendshipRelation } from "@/components/FriendActionButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = await params;
  const rawHandle = decodeURIComponent(resolvedParams.username).trim().replace(/^@/, "");

  const targetUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: rawHandle, mode: "insensitive" } },
        { id: rawHandle },
      ],
    },
    include: {
      privacySettings: true,
      badges: { select: { badge_id: true, unlocked_at: true } },
      stats_cache: true,
      ratings: {
        orderBy: { created_at: "desc" },
        take: 50,
      },
      _count: {
        select: { ratings: true },
      },
    },
  });

  if (!targetUser) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id;

  // If viewing own profile, redirect to /profile
  if (currentUserId === targetUser.id) {
    redirect("/profile");
  }

  let isFriend = false;
  let initialRelation: FriendshipRelation = "NONE";

  if (currentUserId) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { sender_id: currentUserId, receiver_id: targetUser.id },
          { sender_id: targetUser.id, receiver_id: currentUserId },
        ],
      },
    });

    if (friendship) {
      if (friendship.status === FriendshipStatus.ACCEPTED) {
        isFriend = true;
        initialRelation = "FRIENDS";
      } else if (friendship.status === FriendshipStatus.PENDING) {
        initialRelation =
          friendship.sender_id === currentUserId
            ? "PENDING_SENT"
            : "PENDING_RECEIVED";
      }
    }
  }

  // Privacy evaluation
  const privacy = targetUser.privacySettings || {
    profile_visibility: VisibilityLevel.PUBLIC,
    ratings_visibility: VisibilityLevel.PUBLIC,
    watchlist_visibility: VisibilityLevel.PUBLIC,
    activity_visibility: VisibilityLevel.PUBLIC,
  };

  const canViewProfile =
    privacy.profile_visibility === VisibilityLevel.PUBLIC ||
    (privacy.profile_visibility === VisibilityLevel.FRIENDS_ONLY && isFriend);

  const canViewRatings =
    canViewProfile &&
    (privacy.ratings_visibility === VisibilityLevel.PUBLIC ||
      (privacy.ratings_visibility === VisibilityLevel.FRIENDS_ONLY && isFriend));

  const canViewActivity =
    canViewProfile &&
    (privacy.activity_visibility === VisibilityLevel.PUBLIC ||
      (privacy.activity_visibility === VisibilityLevel.FRIENDS_ONLY && isFriend));

  // Fetch activities if allowed
  let activities: any[] = [];
  if (canViewActivity) {
    activities = await prisma.userActivity.findMany({
      where: { user_id: targetUser.id },
      orderBy: { created_at: "desc" },
      take: 30,
    });
  }

  const formattedRatings = canViewRatings
    ? targetUser.ratings.map(formatProfileRating)
    : [];

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-24 pb-12 px-4 sm:px-8">
      <OtherUserProfileView
        user={{
          id: targetUser.id,
          name: targetUser.name,
          username: targetUser.username,
          image: targetUser.image,
          country: targetUser.country,
          stateRegion: targetUser.stateRegion,
          created_at: targetUser.created_at ? targetUser.created_at.toISOString() : null,
          showcaseBadges: targetUser.showcaseBadges,
        }}
        ratings={formattedRatings}
        activities={activities}
        badges={targetUser.badges}
        statsCache={targetUser.stats_cache}
        canViewProfile={canViewProfile}
        canViewRatings={canViewRatings}
        canViewActivity={canViewActivity}
        isFriend={isFriend}
        initialRelation={initialRelation}
      />
    </main>
  );
}
