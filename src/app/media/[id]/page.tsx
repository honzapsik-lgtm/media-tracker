import ExpandableCast from "@/components/ExpandableCast";
import { getTMDbDetails } from "@/lib/tmdb";
import { getGameDetails } from "@/lib/games";
import { getBookDetails } from "@/lib/books";
import RatingSlider from "@/components/RatingSlider";
import TextReviewEditor from "@/components/TextReviewEditor";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";

interface TmdbSeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
}

export default async function MediaDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const mediaId = resolvedParams.id;
  
  const parts = mediaId.split('-');
  const provider = parts[0]; 
  
  let mediaDetails = null;
  
  if (provider === 'tmdb') {
    const tmdbType = parts[1] as 'movie' | 'tv'; 
    const externalId = parts[2];
    mediaDetails = await getTMDbDetails(externalId, tmdbType);
  } 
  else if (provider === 'rawg') {
    // ID format is rawg-game-1234
    const externalId = parts[2];
    mediaDetails = await getGameDetails(externalId);
  }
  else if (provider === 'manga') {
    // ID format is manga-1234
    const externalId = parts[1];
    mediaDetails = await getBookDetails(externalId);
  }

  if (!mediaDetails) return notFound();

  // 2. Fetch the Community Score from your Supabase Database
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: stats } = await supabase
    .from('media_stats')
    .select('community_average, total_ratings')
    .eq('id', mediaId)
    .single();

  // Fetch Community Reviews (only where review_text is not empty)
  const { data: reviews } = await supabase
    .from("user_ratings")
    .select("score, review_text, username, avatar_url, created_at")
    .eq("media_id", mediaId)
    .not("review_text", "is", null)
    .order("created_at", { ascending: false });

  const getPlatformName = (type: string) => {
    if (type === 'movie' || type === 'show') return 'TMDb Score';
    if (type === 'game') return 'Metacritic';
    if (type === 'manga') return 'MyAnimeList';
    return 'Global Score';
  };

    return (
      <main className="min-h-screen bg-gray-950 text-white relative pb-24">
        {/* Massive Background Image with Gradient Fade */}
        {mediaDetails.backdrop && (
          <>
            <div className="absolute top-0 left-0 w-full h-[60vh] opacity-20 bg-cover bg-center" 
                 style={{ backgroundImage: `url(${mediaDetails.backdrop})` }} 
            />
            <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-t from-gray-950 to-transparent" />
          </>
        )}
        
        <div className="max-w-7xl mx-auto px-8 pt-24 relative z-10">
          <Link href="/" className="text-gray-400 hover:text-white mb-8 inline-block font-semibold">
            ← Back to Search
          </Link>
          
          {/* Top Section: Poster & Main Info */}
          <div className="flex flex-col md:flex-row gap-10 mb-16">
            {/* Left Column: Poster ONLY */}
            <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 space-y-6">
              {mediaDetails.image ? (
                <img src={mediaDetails.image} alt={mediaDetails.title} className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-gray-800" />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
                  No Image
                </div>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <RatingSlider mediaId={mediaId} mediaType={mediaDetails.type || "unknown"} mediaTitle={mediaDetails.title} mediaImage={mediaDetails.image} />
              </div>
            </div>
  
            {/* Right Column: Info & Ratings */}
            <div className="flex-1">
              <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">{mediaDetails.title}</h1>
              
              {/* NEW: Genres & Runtime */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {mediaDetails.releaseDate && (
                  <span className="text-sm font-bold text-gray-300">
                    {mediaDetails.releaseDate.split('-')[0]}
                  </span>
                )}
                {mediaDetails.runtime && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700"></span>
                    <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                      {mediaDetails.runtime} min
                    </span>
                  </>
                )}
                {mediaDetails.genres?.length > 0 && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 hidden sm:block"></span>
                    {mediaDetails.genres.map((genre: string) => (
                      <span key={genre} className="text-xs font-bold uppercase tracking-wider text-blue-300 bg-blue-900/30 px-3 py-1.5 rounded-md border border-blue-800/50">
                        {genre}
                      </span>
                    ))}
                  </>
                )}
              </div>
  
              {/* The Expandable Description */}
              <ExpandableText text={mediaDetails.description} maxLength={300} />
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10 border-t border-gray-800 pt-6">
                {mediaDetails.creator && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Creator</p>
                    <p className="text-md font-semibold text-gray-200">{mediaDetails.creator}</p>
                  </div>
                )}
                {mediaDetails.director && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Director</p>
                    <p className="text-md font-semibold text-gray-200">{mediaDetails.director}</p>
                  </div>
                )}
                {mediaDetails.writer && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Writer / Story</p>
                    <p className="text-md font-semibold text-gray-200">{mediaDetails.writer}</p>
                  </div>
                )}
                {mediaDetails.music && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Composer</p>
                    <p className="text-md font-semibold text-gray-200">{mediaDetails.music}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-8 border-y border-gray-800 py-6 max-w-2xl mb-8">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">{getPlatformName(mediaDetails.type)}</p>
                  <p className="text-4xl font-extrabold text-green-400">{mediaDetails.globalScore}%</p>
                </div>
                <div className="w-px bg-gray-800"></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Community Score</p>
                  <p className="text-4xl font-extrabold text-blue-400">
                    {stats?.community_average ? `${stats.community_average}%` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{stats?.total_ratings || 0} ratings</p>
                </div>
              </div>

              {mediaDetails.type === "show" && mediaDetails.seasons && (
                <div className="mt-12">
                  <h2 className="text-3xl font-bold mb-8">Seasons</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(mediaDetails.seasons as TmdbSeasonSummary[])
                      .filter((s) => s.season_number > 0)
                      .map((season) => (
                        <Link
                          key={season.id}
                          href={`/media/${mediaId}/season/${season.season_number}`}
                          className="bg-gray-900 p-5 rounded-xl border border-gray-800 hover:border-blue-500 hover:bg-gray-800/80 transition-colors text-center block"
                        >
                          <p className="font-bold text-lg">{season.name}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            {season.episode_count}{" "}
                            {season.episode_count === 1 ? "Episode" : "Episodes"}
                          </p>
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
  
          {/* Bottom Section: Cast & Trailer */}
          <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-gray-800">
            
            {/* Cast Members (Takes up 2/3 of the grid) */}
            {mediaDetails.cast?.length > 0 && (
              <ExpandableCast cast={mediaDetails.cast} />
            )}
  
            {/* Trailer (Takes up 1/3 of the grid) */}
            {mediaDetails.trailerUrl && (
              <div className="lg:col-span-1">
                <h2 className="text-2xl font-bold mb-6">Trailer</h2>
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-xl shadow-black/50 border border-gray-800">
                  <iframe 
                    src={mediaDetails.trailerUrl} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            )}
          </div>

          {/* NEW: Community Reviews Feed */}
          <div className="mt-16 pt-12 border-t border-gray-800">
            <h2 className="text-3xl font-bold mb-8">Community Reviews</h2>
            
            {/* THE NEW TEXT REVIEW EDITOR COMPONENT IS PLACED HERE */}
            <TextReviewEditor mediaId={mediaId} mediaTitle={mediaDetails.title} mediaImage={mediaDetails.image} />
            
            {!reviews || reviews.length === 0 ? (
              <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                <p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {reviews.map((review, index) => (
                  <div key={index} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col">
                    
                    {/* Review Header (User Info & Score) */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {review.avatar_url ? (
                          <img src={review.avatar_url} alt={review.username} className="w-10 h-10 rounded-full border border-gray-700 object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-500 flex items-center justify-center font-bold text-sm">
                            {review.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-200">{review.username}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-gray-950 border border-gray-800 font-black text-blue-400">
                        {review.score}%
                      </div>
                    </div>

                    {/* Review Body */}
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap flex-1">
                      "{review.review_text}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
}