import ProfileTabs from "@/components/ProfileTabs";
import ProfileHeader from "@/components/ProfileHeader";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ratings, error } = await supabase
    .from("user_ratings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching profile data:", error);
  }

  const { data: unlockedBadges } = await supabase
    .from("user_badges")
    .select("badge_id, unlocked_at")
    .eq("user_id", user.id);
  
  const badges = unlockedBadges || [];

  const formattedData = ratings?.map((row) => {
    const parts = row.media_id.split('-');
    let typeLabel = "UNKNOWN";

    if (parts[0] === 'tmdb') {
      typeLabel = parts[1] === 'movie' ? 'MOVIE' : 'SHOW';
    } else if (parts[0] === 'rawg') {
      typeLabel = 'GAME';
    } else if (parts[0] === 'manga') {
      typeLabel = 'MANGA';
    }

    return {
      mediaId: row.media_id,
      score: row.score,
      reviewText: row.review_text,
      title: row.media_title || `Unknown Title (${row.media_id})`,
      image: row.media_image || null,
      type: typeLabel,
      rankPosition: row.rank_position || null,
    };
  }) || [];

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