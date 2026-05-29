import ProfileTabs from "@/components/ProfileTabs";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  // 1. Verify the user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login"); // Or wherever your auth page is
  }

  // 2. Fetch all ratings for this specific user
  const { data: ratings, error } = await supabase
    .from("user_ratings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching profile data:", error);
  }

  // 3. Format the data to match exactly what ProfileTabs expects
  const formattedData = ratings?.map((row) => {
    // Extract the media type from our ID format (e.g., tmdb-tv-1234 -> SHOW)
    const parts = row.media_id.split('-');
    let typeLabel = "UNKNOWN";
    if (parts[0] === 'tmdb') typeLabel = parts[1] === 'tv' ? 'SHOW' : 'MOVIE';
    if (parts[0] === 'rawg') typeLabel = 'GAME';
    if (parts[0] === 'manga') typeLabel = 'MANGA';

    return {
      mediaId: row.media_id,
      score: row.score,
      reviewText: row.review_text || "",
      // NOTE: If you haven't added media_title and media_image to your database yet,
      // these will fall back to placeholders so the UI doesn't crash.
      title: row.media_title || `Unknown Title (${row.media_id})`,
      image: row.media_image || null,
      type: typeLabel
    };
  }) || [];

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-24 pb-12 px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Profile Header */}
        <div className="flex items-center gap-6 mb-12 border-b border-gray-800 pb-8">
          {user.user_metadata?.avatar_url ? (
             <img src={user.user_metadata.avatar_url} alt="Profile" className="w-24 h-24 rounded-full border-4 border-gray-800 shadow-xl" />
          ) : (
             <div className="w-24 h-24 rounded-full bg-blue-900 border-4 border-blue-500 flex items-center justify-center text-3xl font-black shadow-xl">
               {user.email?.charAt(0).toUpperCase()}
             </div>
          )}
          <div>
            <h1 className="text-4xl font-black">{user.user_metadata?.custom_claims?.global_name || user.email?.split('@')[0]}</h1>
            <p className="text-gray-400 mt-1">Total Ratings: <span className="text-white font-bold">{formattedData.length}</span></p>
          </div>
        </div>

        {/* Inject the data into your Tabs Component */}
        <ProfileTabs initialData={formattedData} />
        
      </div>
    </main>
  );
}