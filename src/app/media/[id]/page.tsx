import ExpandableCast from "@/components/ExpandableCast";
import { getTMDbDetails } from "@/lib/tmdb";
import { getGameDetails } from "@/lib/games";
import { getBookDetails } from "@/lib/books";
import RatingSlider from "@/components/RatingSlider";
import TextReviewEditor from "@/components/TextReviewEditor";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";
import WatchlistButton from "@/components/WatchlistButton";
import { prisma } from "@/lib/prisma";
import { CRITERIA_CONFIG } from "@/lib/constants";
import {
  calculateCriteriaAverages,
  getDeepCriteriaRows,
  getListRank,
  getListRankMap,
  getMediaStats,
  getMediaStatsMap,
} from "@/lib/media-db";



const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; 
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; 
};

interface TmdbSeasonSummary { id: number; name: string; season_number: number; episode_count: number; }

export default async function MediaDetailsPage({ params }: { params: Promise<{ id: string }>; }) {
  const resolvedParams = await params;
  const mediaId = resolvedParams.id;
  
  const parts = mediaId.split('-');
  
  // Intercept and redirect direct links to seasons and episodes (e.g. from profile)
  if (parts.length > 3 && parts[0] === "tmdb" && parts[1] === "tv") {
    if (parts.length === 4 && parts[3].startsWith("s")) {
      redirect(`/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${parts[3].substring(1)}`);
    } else if (parts.length === 5 && parts[3].startsWith("s") && parts[4].startsWith("e")) {
      redirect(`/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${parts[3].substring(1)}/episode/${parts[4].substring(1)}`);
    }
  }

  const provider = parts[0]; 
  
  let mediaDetails = null;
  
  if (provider === 'tmdb') {
    const tmdbType = parts[1] as 'movie' | 'tv'; 
    const externalId = parts[2];
    mediaDetails = await getTMDbDetails(externalId, tmdbType);
  } else if (provider === 'rawg') {
    mediaDetails = await getGameDetails(parts[2]);
  } else if (provider === 'manga') {
    mediaDetails = await getBookDetails(parts[1]);
  }

  if (!mediaDetails) return notFound();
  const mediaTypeKey = (mediaDetails.type as "game" | "movie" | "show" | "manga") || "movie";

  const [stats, placementRank, globalData, reviews] = await Promise.all([
    getMediaStats(mediaId),
    getListRank(mediaId),
    getDeepCriteriaRows(mediaId),
    prisma.userRating.findMany({
      where: { media_id: mediaId, review_text: { not: null } },
      select: { score: true, review_text: true, username: true, avatar_url: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const globalCriteriaAverages = calculateCriteriaAverages(globalData);

  const seasonStatsMap: Record<string, number> = {};
  const seasonRankMap: Record<string, number> = {};
  
  if (mediaTypeKey === "show" && mediaDetails.seasons) {
    const seasonIds = (mediaDetails.seasons as TmdbSeasonSummary[]).map((s) => `${mediaId}-s${s.season_number}`);
    const [sStats, sRanks] = await Promise.all([
      getMediaStatsMap(seasonIds),
      getListRankMap(seasonIds),
    ]);
    Object.assign(seasonStatsMap, sStats);
    Object.assign(seasonRankMap, sRanks);
  }

  const getPlatformName = (type: string) => {
    if (type === 'movie' || type === 'show') return 'TMDb Score';
    if (type === 'game') return 'Metacritic';
    if (type === 'manga') return 'MyAnimeList';
    return 'Global Score';
  };

  const activeCriteriaConfig = CRITERIA_CONFIG[mediaTypeKey] || [];

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24">
      {mediaDetails.backdrop && (
        <>
          <div className="absolute top-0 left-0 w-full h-[60vh] opacity-20 bg-cover bg-center" style={{ backgroundImage: `url(${mediaDetails.backdrop})` }} />
          <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-t from-gray-950 to-transparent" />
        </>
      )}
      
      <div className="max-w-7xl mx-auto px-8 pt-24 relative z-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-8 inline-block font-semibold">← Back to Search</Link>
        
        <div className="flex flex-col md:flex-row gap-10 mb-16">
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 space-y-6">
            {mediaDetails.image ? (
              <img src={mediaDetails.image} alt={mediaDetails.title} className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-gray-800" />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">No Image</div>
            )}
            <RatingSlider mediaId={mediaId} mediaType={mediaTypeKey} mediaTitle={mediaDetails.title} mediaImage={mediaDetails.image} mediaReleaseDate={mediaDetails.releaseDate} />
          </div>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h1 className="text-4xl sm:text-5xl font-black text-white">
                {mediaDetails.title}
              </h1>
              
              <WatchlistButton 
                mediaId={mediaDetails.id} 
                title={mediaDetails.title} 
                image={mediaDetails.image} 
                type={mediaDetails.type} 
              />
            </div>

            {/* NEW METADATA ROW */}
            <div className="flex items-center gap-3 mt-3 mb-4">
              {mediaDetails.releaseDate && (
                <span className="text-gray-300 font-bold text-sm">
                  {mediaDetails.releaseDate.split('-')[0]}
                </span>
              )}
              
              {mediaDetails.releaseDate && mediaDetails.runtime && (
                <span className="text-gray-600">•</span>
              )}

              {mediaDetails.runtime && (
                <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                  {mediaDetails.runtime} min
                </span>
              )}

              {mediaDetails.type === "show" && mediaDetails.seasons && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                    {(mediaDetails.seasons as any[]).filter((s: any) => s.season_number > 0).length} seasons
                  </span>
                </>
              )}
            </div>

            {/* DYNAMIC CREW GRID */}
            {mediaDetails.credits && mediaDetails.credits.length > 0 && (
              <div className="flex flex-wrap gap-x-10 gap-y-6 py-5 border-y border-gray-800/60 mb-6">
                {mediaDetails.credits.map((credit: any) => (
                  <Link key={`${credit.id}-${credit.role}`} href={`/person/${credit.id}`} className="flex flex-col group">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1 group-hover:text-blue-400 transition-colors">{credit.role}</span>
                    <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{credit.name}</span>
                  </Link>
                ))}
              </div>
            )}

            <ExpandableText text={mediaDetails.description} maxLength={300} />
            
            <div className="flex flex-wrap gap-8 border-y border-gray-800 py-6 mb-8 mt-8 bg-gray-950/50 rounded-xl px-6">
              <div className="shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Community Score</p>
                <p className={`text-4xl font-extrabold ${getScoreColor(stats?.community_average)}`}>
                  {stats?.community_average ? `${stats.community_average}%` : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{stats?.total_ratings || 0} ratings</p>
              </div>
              <div className="w-px bg-gray-800 hidden sm:block"></div>

              <div className="shrink-0">
                <p className="text-xs text-blue-500 uppercase tracking-widest font-bold mb-1">List Rank</p>
                <p className="text-4xl font-extrabold text-white">
                  {placementRank ? `#${placementRank}` : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-1 uppercase">Global {mediaTypeKey}</p>
              </div>
              
              {activeCriteriaConfig.length > 0 && Object.keys(globalCriteriaAverages).length > 0 && (
                <>
                  <div className="w-px bg-gray-800 hidden lg:block"></div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Global Deep Review</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {activeCriteriaConfig.map((item) => {
                        const score = globalCriteriaAverages[item.key];
                        if (score === undefined) return null;
                        return (
                          <div key={item.key} className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 font-medium">{item.label}</span>
                            <span className={`font-black ${getScoreColor(score)}`}>{score}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {mediaDetails.type === "show" && mediaDetails.seasons && (
              <div className="mt-12">
                <h2 className="text-3xl font-bold mb-8">Seasons</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(mediaDetails.seasons as TmdbSeasonSummary[]).filter((s) => s.season_number > 0).map((season) => {
                    const sId = `${mediaId}-s${season.season_number}`;
                    const cScore = seasonStatsMap[sId];
                    const gRank = seasonRankMap[sId];

                    return (
                      <Link key={season.id} href={`/media/${mediaId}/season/${season.season_number}`} className="bg-gray-900 p-5 rounded-xl border border-gray-800 hover:border-blue-500 hover:bg-gray-800/80 transition-colors text-center block relative overflow-hidden group">
                        
                        <div className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded border ${cScore ? (cScore >= 75 ? 'bg-green-900/40 text-green-400 border-green-800/50' : cScore >= 50 ? 'bg-blue-900/40 text-blue-400 border-blue-800/50' : 'bg-gray-800 text-gray-400 border-gray-700') : 'bg-gray-950 text-gray-600 border-gray-800'}`}>
                          ★ {cScore || 'N/A'}
                        </div>

                        <div className={`absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded border ${gRank ? 'bg-blue-900/80 text-blue-400 border-blue-500' : 'bg-gray-900/80 text-gray-500 border-gray-700'}`}>
                          {gRank ? `#${gRank}` : '# -'}
                        </div>

                        <p className="font-bold text-lg mt-3">{season.name}</p>
                        <p className="text-sm text-gray-400 mt-1">{season.episode_count} Episodes</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RESTORED CAST AND TRAILER SECTION */}
        <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-gray-800">
          {mediaDetails.cast?.length > 0 && <ExpandableCast cast={mediaDetails.cast} />}
          {mediaDetails.trailerUrl && (
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold mb-6">Trailer</h2>
              <div className="w-full aspect-video rounded-xl overflow-hidden shadow-xl shadow-black/50 border border-gray-800">
                <iframe src={mediaDetails.trailerUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
              </div>
            </div>
          )}
        </div>

        {/* RESTORED REVIEWS SECTION */}
        <div className="mt-16 pt-12 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-8">Community Reviews</h2>
          <TextReviewEditor mediaId={mediaId} mediaTitle={mediaDetails.title} mediaImage={mediaDetails.image} />
          
          {!reviews || reviews.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed"><p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p></div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {reviews.map((review, index) => (
                <div key={index} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                  {review.avatar_url ? ( <img src={review.avatar_url} alt={review.username ?? "Reviewer"} className="w-10 h-10 rounded-full border border-gray-700 object-cover" /> ) : ( <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-500 flex items-center justify-center font-bold text-sm">{review.username?.charAt(0).toUpperCase() || '?'}</div> )}
                      <div><p className="font-bold text-gray-200">{review.username}</p><p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                    </div>
                    <div className={`px-3 py-1 rounded-lg border font-black ${review.score >= 95 ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.3)]' : review.score >= 75 ? 'bg-green-900 border-green-500 text-green-400' : review.score >= 50 ? 'bg-blue-900 border-blue-500 text-blue-400' : review.score >= 25 ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-950 border-gray-800 text-gray-600'}`}>
                      {review.score}%
                    </div>
                  </div>
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap flex-1">&ldquo;{review.review_text}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
