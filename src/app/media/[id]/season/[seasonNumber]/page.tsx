import { getSeasonEpisodes } from "@/app/actions";
import { getTMDbDetails } from "@/lib/tmdb";
import RatingSlider from "@/components/RatingSlider";
import EpisodeList from "@/components/EpisodeList";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";
import { getMediaStats, getDeepCriteriaRows, getListRank, calculateCriteriaAverages } from "@/lib/media-db";
import TextReviewEditor from "@/components/TextReviewEditor";
import { prisma } from "@/lib/prisma";
import { CRITERIA_CONFIG } from "@/lib/constants";
import { getSeasonCrew, getMasterStudios } from "@/lib/credits-parser";
import ExpandableCast from "@/components/ExpandableCast";
import ExpandableAniListCast from "@/components/ExpandableAniListCast";
import { StaffGrid } from "@/components/StaffGrid";
import AnimeThemes from "@/components/AnimeThemes";

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
  let seasonCredits: any = null;
  let seasonTrailerUrl: string | null = null;
  let seasonStreamingLinks: any[] = [];
  let seasonStudioData: any = null;
  let seasonCastData: any = null;
  let seasonThemeData: any = null;
  
  const parts = id.split("-");
  const provider = parts[0];

  if (provider === "tmdb" && parts[1] === "tv") {
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
  } else {
    // Check if it's an internal AniList CUID
    const localMedia = await prisma.media.findUnique({ where: { id: id }, include: { seasons: true } });
    if (!localMedia || !localMedia.anilistId) notFound();
    
    // For AniList, `seasonNumber` is actually the AniList ID of the season node!
    const anilistSeasonId = parseInt(seasonNumber, 10);
    if (Number.isNaN(anilistSeasonId)) notFound();
    
    // We need getAnilistDetails from anilist.ts
    const { getAnilistDetails } = await import('@/lib/anilist');
    
    const rootData = await getAnilistDetails(localMedia.anilistId);
    if (!rootData) notFound();
    showTitle = localMedia.title || rootData.title?.english || rootData.title?.romaji || "Unknown Show";
    
    let seasonData = null;
    if (anilistSeasonId === localMedia.anilistId) {
      seasonData = rootData;
    } else {
      seasonData = await getAnilistDetails(anilistSeasonId);
      if (!seasonData) notFound();
    }
    
    seasonLabel = seasonData.title?.english || seasonData.title?.romaji || `Season`;
    seasonPoster = seasonData.coverImage?.extraLarge || seasonData.coverImage?.large || rootData.coverImage?.extraLarge || rootData.coverImage?.large || null;
    seasonOverview = seasonData.description || "";
    seasonAirDate = seasonData.startDate?.year ? `${seasonData.startDate.year}-${String(seasonData.startDate.month || 1).padStart(2, '0')}-${String(seasonData.startDate.day || 1).padStart(2, '0')}` : "";
    seasonEpisodeCount = seasonData.episodes || (seasonData.nextAiringEpisode ? seasonData.nextAiringEpisode.episode - 1 : (seasonData.streamingEpisodes?.length || null));
    
    seasonMediaId = `${id}-s${anilistSeasonId}`;
    seasonFullTitle = seasonLabel;
    seasonDuration = seasonData.duration || null;
    seasonTrailerUrl = seasonData.trailer?.site === "youtube" ? `https://www.youtube.com/embed/${seasonData.trailer.id}` : null;
    seasonStreamingLinks = seasonData.externalLinks?.filter((link: any) => link.type === "STREAMING") || [];
    
    const seasonRecord = localMedia.seasons.find((s: any) => s.anilistId === anilistSeasonId);
    
    if (anilistSeasonId === localMedia.anilistId) {
      seasonThemeData = localMedia.themeData || null;
      seasonStudioData = localMedia.studioData || seasonData.studios;
      seasonCastData = localMedia.castData || seasonData.characters;
      seasonCredits = getSeasonCrew(localMedia.staffData || seasonData.staff);
    } else {
      seasonThemeData = seasonRecord?.themeData || null;
      seasonStudioData = seasonRecord?.studioData || seasonData.studios;
      seasonCastData = seasonRecord?.castData || seasonData.characters;
      seasonCredits = getSeasonCrew(seasonRecord?.staffData || seasonData.staff);
    }

    const hybridEpisodes = (anilistSeasonId === localMedia.anilistId
      ? localMedia.episodeData
      : seasonRecord?.episodeData) as any[] | undefined;
    
    if (seasonEpisodeCount && seasonEpisodeCount > 0) {
      const streamingEpisodes = seasonData.streamingEpisodes?.length === seasonEpisodeCount
        ? seasonData.streamingEpisodes
        : [];

      episodes = Array.from({ length: seasonEpisodeCount }, (_, i) => {
        const aniEpNum = i + 1;
        const ep = streamingEpisodes?.[i];
        
        let hybridEp = null;
        if (hybridEpisodes && hybridEpisodes.length > 0) {
          hybridEp = hybridEpisodes.find((he: any) => Number(he.episode_number) === aniEpNum);
        }

        if (hybridEp) {
          return {
            id: hybridEp.id || hybridEp.episode_number,
            name: hybridEp.name || ep?.title || `Episode ${aniEpNum}`,
            episode_number: aniEpNum,
            overview: hybridEp.overview || "",
            image: hybridEp.still_path ? (hybridEp.still_path.startsWith("http") ? hybridEp.still_path : `https://image.tmdb.org/t/p/w780${hybridEp.still_path}`) : (ep?.thumbnail || null),
            originalImage: hybridEp.still_path ? (hybridEp.still_path.startsWith("http") ? hybridEp.still_path.replace("/w780", "/original") : `https://image.tmdb.org/t/p/original${hybridEp.still_path}`) : (ep?.thumbnail || null),
            air_date: hybridEp.air_date || "",
            runtime: hybridEp.runtime || seasonData.duration || 0,
            globalScore: 0
          };
        }

        return {
          id: aniEpNum,
          name: ep?.title || `Episode ${aniEpNum}`,
          episode_number: aniEpNum,
          overview: "",
          image: ep?.thumbnail || null,
          originalImage: ep?.thumbnail || null,
          air_date: "",
          runtime: seasonData.duration || 0,
          globalScore: 0
        };
      });
    } else if (hybridEpisodes && hybridEpisodes.length > 0) {
      // Fallback if AniList has 0 episodes but TMDb has them
      episodes = hybridEpisodes.map(hybridEp => ({
        id: hybridEp.id || hybridEp.episode_number,
        name: hybridEp.name || `Episode ${hybridEp.episode_number}`,
        episode_number: Number(hybridEp.episode_number),
        overview: hybridEp.overview || "",
        image: hybridEp.still_path ? (hybridEp.still_path.startsWith("http") ? hybridEp.still_path : `https://image.tmdb.org/t/p/w780${hybridEp.still_path}`) : null,
        originalImage: hybridEp.still_path ? (hybridEp.still_path.startsWith("http") ? hybridEp.still_path.replace("/w780", "/original") : `https://image.tmdb.org/t/p/original${hybridEp.still_path}`) : null,
        air_date: hybridEp.air_date || "",
        runtime: hybridEp.runtime || seasonData.duration || 0,
        globalScore: 0
      }));
    }
    
    const timelineItems = [
      { id: localMedia.anilistId, releaseDate: localMedia.releaseDate ? new Date(localMedia.releaseDate).getTime() : 0 },
      ...localMedia.seasons.map((s: any) => ({
        id: s.anilistId,
        releaseDate: s.releaseDate ? new Date(s.releaseDate).getTime() : Infinity
      }))
    ].sort((a, b) => a.releaseDate - b.releaseDate);
    
    const currentIndex = timelineItems.findIndex((item) => item.id === anilistSeasonId);
    if (currentIndex > 0) prevSeasonNum = timelineItems[currentIndex - 1].id;
    if (currentIndex !== -1 && currentIndex < timelineItems.length - 1) nextSeasonNum = timelineItems[currentIndex + 1].id;
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
            {seasonStreamingLinks && seasonStreamingLinks.length > 0 && (
              <div className="mt-4 bg-gray-950/50 p-5 rounded-2xl border border-gray-800 shadow-xl">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Where to Watch</h3>
                <div className="flex flex-col gap-3">
                  {seasonStreamingLinks.map((link: any) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 p-3 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors">
                      {link.icon ? <img src={link.icon} className="w-6 h-6 object-contain" /> : <div className="w-6 h-6 bg-gray-800 rounded-full"></div>}
                      <span className="font-bold text-gray-200 text-sm" style={{ color: link.color || '#fff' }}>{link.site}</span>
                    </a>
                  ))}
                </div>
              </div>
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
            {seasonStudioData && getMasterStudios(seasonStudioData).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[10px] text-blue-500 uppercase tracking-widest font-black self-center mr-2">Studio</span>
                {getMasterStudios(seasonStudioData).map((s: any, i: number, arr: any[]) => (
                  <span key={s.id || s} className="flex gap-2 items-center">
                    <span className="text-sm font-bold text-gray-200">{s.name || s}</span>
                    {i < arr.length - 1 && <span className="text-gray-600 text-xs font-black">•</span>}
                  </span>
                ))}
              </div>
            )}

            {/* DYNAMIC CREW GRID */}
            {provider === "tmdb" && showDetails && (
              <div className="flex flex-wrap gap-x-10 gap-y-4 py-5 border-y border-gray-800/60 mb-6">
                {showDetails.director && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Director</span>
                    <span className="text-sm font-bold text-gray-200">{showDetails.director}</span>
                  </div>
                )}
                
                {showDetails.writer && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Writer / Script</span>
                    <span className="text-sm font-bold text-gray-200">{showDetails.writer}</span>
                  </div>
                )}

                {showDetails.music && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Music / Score</span>
                    <span className="text-sm font-bold text-gray-200">{showDetails.music}</span>
                  </div>
                )}

                {showDetails.creator && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Creator / Author</span>
                    <span className="text-sm font-bold text-gray-200">{showDetails.creator}</span>
                  </div>
                )}
              </div>
            )}

            {/* DYNAMIC CREW GRID */}
            {provider !== "tmdb" && (
              <StaffGrid 
                primaryStaff={seasonCredits?.primary || []} 
                secondaryStaff={seasonCredits?.secondary || []} 
              />
            )}

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

        {/* RESTORED CAST AND TRAILER SECTION */}
        {(seasonCastData?.edges?.length > 0 || seasonTrailerUrl) && (
          <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-gray-800">
            {seasonCastData && seasonCastData.edges?.length > 0 && (
              <div className="lg:col-span-2">
                <ExpandableAniListCast castData={seasonCastData} />
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
