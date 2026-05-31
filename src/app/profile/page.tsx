import ProfileTabs from "@/components/ProfileTabs";
import ProfileHeader from "@/components/ProfileHeader";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatProfileRating } from "@/lib/media-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      ratings: { orderBy: { created_at: "desc" } },
      badges: { select: { badge_id: true, unlocked_at: true } },
    },
  });

  if (!user) redirect("/");
  
  const badges = user.badges || [];
  const formattedData = user.ratings.map(formatProfileRating);

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-24 pb-12 px-8">
      <div className="max-w-7xl mx-auto">
        {/* Pass userBadges to the header so it can populate the edit dropdowns */}
        <ProfileHeader user={user} ratings={formattedData} userBadges={badges} />
        
        <ProfileTabs initialData={formattedData} userBadges={badges} />
      </div>
    </main>
  );
}
