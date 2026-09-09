import { getSeasonEpisodes } from "@/app/actions";
import { getTMDbDetails } from "@/lib/tmdb";
import RatingSlider from "@/components/RatingSlider";
import EpisodeList from "@/components/EpisodeList";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";
import { getMediaStats, getDeepCriteriaRows, getListRank, calculateCriteriaAverages } from "@/lib/media-db";
import TextReviewEditor from "@/components/TextReviewEditor";
import { prisma } from "@/lib/prisma";
import { CRITERIA_CONFIG } from "@/lib/constants";
import ExpandableCast from "@/components/ExpandableCast";
import { StaffGrid } from "@/components/StaffGrid";
import AnimeThemes from "@/components/AnimeThemes";
import WatchProviders from "@/components/WatchProviders";

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  overview: string;
  image: string | null;
  air_date: string;
  runtime: number;
  globalScore: number;
  originalImage?: string | null;
}

interface TmdbSeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
  overview?: string;
  vote_average?: number | null;
  air_date?: string;
}

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; 
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; 
};

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string; seasonNumber: string }>;
}) {
  const { id, seasonNumber } = await params;

  let showTitle = "";
  let seasonLabel = "";
  let seasonPoster: string | null = null;
  let seasonOverview = "";
  let seasonAirDate = "";
  let seasonEpisodeCount: number | null = null;
  let episodes: Episode[] = [];
  let nextSeasonNum: string | number | undefined;
  let prevSeasonNum: string | number | undefined;
  let seasonMediaId = "";
  let seasonFullTitle = "";
  let showDetails: any = null;
  let seasonDuration: number | null = null;
  let primaryStaff: any[] = [];
  let secondaryStaff: any[] = [];
  let seasonTrailerUrl: string | null = null;
  let seasonThemeData: any = null;
  
  const parts = id.split("-");
  const provider = parts[0];

  if (provider !== "tmdb" || parts[1] !== "tv") {
    const localMedia = await prisma.media.findUnique({ where: { id: id } });
    if (localMedia?.tmdbId) {
      redirect(`/media/tmdb-tv-${localMedia.tmdbId}/season/1`);
    }
    notFound();
  }

  const tmdbId = parts[2];
  const seasonNum = parseInt(seasonNumber, 10);
  if (Number.isNaN(seasonNum) || seasonNum < 0) notFound();

  showDetails = await getTMDbDetails(tmdbId, "tv");
  if (!showDetails || showDetails.type !== "show") notFound();

  episodes = await getSeasonEpisodes(tmdbId, seasonNum);

  const seasons = (showDetails.seasons ?? []) as TmdbSeasonSummary[];
  const validSeasonNumbers = seasons
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number)
    .sort((a, b) => a - b);

  if (!validSeasonNumbers.includes(seasonNum)) notFound();

  const seasonMeta = seasons.find((s) => s.season_number === seasonNum);
  nextSeasonNum = validSeasonNumbers.find((n) => n > seasonNum);
  prevSeasonNum = validSeasonNumbers.slice().reverse().find((n) => n < seasonNum);

  seasonPoster = seasonMeta?.poster_path
    ? `https://image.tmdb.org/t/p/w500${seasonMeta.poster_path}`
    : showDetails.image;

  seasonLabel = seasonMeta?.name ?? `Season ${seasonNum}`;
  showTitle = showDetails.title;
  seasonOverview = seasonMeta?.overview || "";
  seasonAirDate = seasonMeta?.air_date || "";
  seasonEpisodeCount = seasonMeta?.episode_count ?? null;
  seasonMediaId = `${id}-s${seasonNum}`;
  seasonFullTitle = `${showTitle} - ${seasonLabel}`;
  seasonDuration = showDetails.runtime || null;
  seasonTrailerUrl = showDetails.trailerUrl || null;

  if (showDetails.originalLanguage === "ja" && showDetails.genres?.includes("Animation")) {
    const { fetchAnimeThemesForMedia } = await import("@/lib/jikan");
    seasonThemeData = await fetchAnimeThemesForMedia(`${showTitle} ${seasonLabel}`, showDetails.originalTitle);
  }

  const crewCredits = showDetails.credits || [];
  if (Array.isArray(crewCredits)) {
    primaryStaff = crewCredits.filter((c: any) => ['Director', 'Writer', 'Creator', 'Original Creator', 'Series Composition', 'Developer'].includes(c.role));
    secondaryStaff = crewCredits.filter((c: any) => !['Director', 'Writer', 'Creator', 'Original Creator', 'Series Composition', 'Developer'].includes(c.role));
  }

  const [stats, placementRank, reviews, globalData] = await Promise.all([
    getMediaStats(seasonMediaId),
    getListRank(seasonMediaId),
    prisma.userRating.findMany({
      where: { media_id: seasonMediaId, review_text: { not: null } },
      select: { score: true, review_text: true, username: true, avatar_url: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
    getDeepCriteriaRows(seasonMediaId),
  ]);

  const globalCriteriaAverages = calculateCriteriaAverages(globalData);
  const activeCriteriaConfig = CRITERIA_CONFIG["show"] || [];

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24">
      <div className="max-w-7xl mx-auto px-8 pt-24 relative z-10">
        <Link
          href={`/media/${id}`}
          className="text-gray-400 hover:text-white mb-8 inline-block font-semibold"
        >
          ← Back to Show
        </Link>

        <div className="flex flex-col md:flex-row gap-10 mb-16">
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 space-y-6">
            {seasonPoster ? (
              <img
                src={seasonPoster}
                alt={seasonLabel}
                className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-gray-800"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
                No Poster
              </div>
            )}

            {/* Passes the required Title and Image down so Profile page doesn't break */}
            <RatingSlider 
              mediaId={seasonMediaId} 
              mediaType="season" 
              mediaTitle={seasonFullTitle}
              mediaImage={seasonPoster}
            />

            {/* WHERE TO WATCH */}
            {showDetails?.watchData && (
              <WatchProviders watchData={showDetails.watchData} />
            )}
            
            <AnimeThemes themeData={seasonThemeData} />
          </div>

          <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
              {seasonFullTitle}
            </h1>

            <div className="flex items-center gap-3 mt-3 mb-4">
              {seasonAirDate && (
                <span className="text-gray-300 font-bold text-sm">
                  {seasonAirDate.split('-')[0]}
                </span>
              )}

              {seasonAirDate && seasonEpisodeCount != null && (
                <span className="text-gray-600">•</span>
              )}

              {seasonEpisodeCount != null && (
                <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                  {seasonEpisodeCount} episodes
                </span>
              )}

              {seasonDuration != null && (
                <>
                  <span className="text-gray-600 hidden sm:inline">•</span>
                  <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                    Avg ep {seasonDuration} min
                  </span>
                </>
              )}

              <span className="text-gray-600 hidden sm:inline">•</span>

              <div className="flex items-center gap-2">
                {prevSeasonNum != null && (
                  <Link
                    href={`/media/${id}/season/${prevSeasonNum}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-gray-800 bg-gray-900 text-sm text-gray-400 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    ←
                  </Link>
                )}

                <p className="text-sm text-blue-400 font-bold uppercase tracking-widest">{seasonLabel}</p>

                {nextSeasonNum != null && (
                  <Link
                    href={`/media/${id}/season/${nextSeasonNum}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-gray-800 bg-gray-900 text-sm text-gray-400 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    →
                  </Link>
                )}
              </div>
            </div>

            {/* STUDIOS ROW */}
            {showDetails?.studioData && showDetails.studioData.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[10px] text-blue-500 uppercase tracking-widest font-black self-center mr-2">Studio</span>
                {showDetails.studioData.map((s: any, i: number, arr: any[]) => (
                  <span key={s.id || s} className="flex gap-2 items-center">
                    <span className="text-sm font-bold text-gray-200">{s.name || s}</span>
                    {i < arr.length - 1 && <span className="text-gray-600 text-xs font-black">•</span>}
                  </span>
                ))}
              </div>
            )}

            {/* DYNAMIC CREW GRID */}
            <StaffGrid 
              primaryStaff={primaryStaff} 
              secondaryStaff={secondaryStaff} 
            />

            {seasonOverview && (
              <ExpandableText text={seasonOverview} maxLength={300} />
            )}

            {/* MASTER STAT BLOCK */}
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
                <p className="text-xs text-gray-500 mt-1 uppercase">Global Season</p>
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



            <h2 className="text-2xl font-bold mb-6 mt-12">Episodes</h2>

            <EpisodeList 
              mediaId={id} 
              seasonNumber={seasonNumber} 
              episodes={episodes} 
            />

          </div>
        </div>

        {((showDetails?.cast && showDetails.cast.length > 0) || seasonTrailerUrl) && (
          <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-gray-800">
            {showDetails?.cast && showDetails.cast.length > 0 && (
              <div className="lg:col-span-2">
                <ExpandableCast cast={showDetails.cast.map((c: any) => ({ ...c, id: `tmdb-${c.id}`, role: c.character }))} />
              </div>
            )}
            {seasonTrailerUrl && (
              <div className="lg:col-span-1">
                <h2 className="text-2xl font-bold mb-6 mt-2">Trailer</h2>
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-xl shadow-black/50 border border-gray-800">
                  <iframe src={seasonTrailerUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESTORED REVIEWS SECTION */}
        <div className="mt-8 pt-12 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-8">Community Reviews</h2>
              <TextReviewEditor mediaId={seasonMediaId} mediaTitle={seasonFullTitle} mediaImage={seasonPoster} />
              
              {!reviews || reviews.length === 0 ? (
                <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed"><p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p></div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {reviews.map((review: any, index: number) => (
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
