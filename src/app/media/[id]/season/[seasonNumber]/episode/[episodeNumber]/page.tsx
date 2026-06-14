import { getSeasonEpisodes } from "@/app/actions";
import RatingSlider from "@/components/RatingSlider";
import ExpandableText from "@/components/ExpandableText";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTMDbDetails } from "@/lib/tmdb";
import type { Episode } from "@/app/media/[id]/season/[seasonNumber]/page";
import { getMediaStats, getDeepCriteriaRows, getListRank, calculateCriteriaAverages } from "@/lib/media-db";
import TextReviewEditor from "@/components/TextReviewEditor";
import { prisma } from "@/lib/prisma";
import { CRITERIA_CONFIG } from "@/lib/constants";
import { getEpisodeCrew } from "@/lib/credits-parser";
import ExpandableCast from "@/components/ExpandableCast";
import ExpandableAniListCast from "@/components/ExpandableAniListCast";
import { StaffGrid } from "@/components/StaffGrid";
export default async function EpisodePage({
  params,
}: {
  params: Promise<{
    id: string;
    seasonNumber: string;
    episodeNumber: string;
  }>;
}) {
  const { id, seasonNumber, episodeNumber } = await params;

  const parts = id.split("-");
  const provider = parts[0];
  const seasonNum = parseInt(seasonNumber, 10);
  const epNum = parseInt(episodeNumber, 10);
  if (Number.isNaN(seasonNum) || Number.isNaN(epNum)) notFound();

  let episodes: Episode[] = [];
  let episode: Episode | null = null;
  let showTitle = "";
  let episodeFullTitle = "";
  let episodeMediaId = "";
  let episodeCrew: any = null;
  let episodeCastData: any = null;
  let showDetails: any = null;

  if (provider === "tmdb" && parts[1] === "tv") {
    const tmdbId = parts[2];
    episodes = await getSeasonEpisodes(tmdbId, seasonNum);
    episode = episodes.find((ep) => ep.episode_number === epNum) || null;
    if (!episode) notFound();

    showDetails = await getTMDbDetails(tmdbId, "tv");
    showTitle = showDetails?.title || "Unknown Show";
    episodeFullTitle = `${showTitle} - S${seasonNum} E${episode.episode_number} - ${episode.name}`;
    episodeMediaId = `${id}-s${seasonNum}-e${epNum}`;
  } else {
    // anilist path
    const { getAnilistDetails } = await import('@/lib/anilist');
    const localMedia = await prisma.media.findUnique({ where: { id: id }, include: { seasons: true } });
    if (!localMedia || !localMedia.anilistId) notFound();

    const rootData = await getAnilistDetails(localMedia.anilistId);
    showTitle = localMedia.title || rootData?.title?.english || rootData?.title?.romaji || "Unknown Show";

    let seasonData = null;
    if (seasonNum === localMedia.anilistId) {
      seasonData = rootData;
    } else {
      seasonData = await getAnilistDetails(seasonNum);
      if (!seasonData) notFound();
    }

    const seasonRecord = localMedia.seasons.find((s: any) => s.anilistId === seasonNum);
    const hybridEpisodes = (seasonNum === localMedia.anilistId
      ? localMedia.episodeData
      : seasonRecord?.episodeData) as any[] | undefined;
    const seasonEpisodeCount = seasonData?.episodes || (seasonData?.nextAiringEpisode ? seasonData.nextAiringEpisode.episode - 1 : (seasonData?.streamingEpisodes?.length || 0));
    
    if (epNum < 1 || (seasonEpisodeCount > 0 && epNum > seasonEpisodeCount && (!hybridEpisodes || epNum > hybridEpisodes.length))) notFound();

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

    episode = episodes.find((ep) => Number(ep.episode_number) === Number(epNum)) || null;
    if (!episode) notFound();

    const seasonLabel = seasonData?.title?.english || seasonData?.title?.romaji || `Season`;
    episodeFullTitle = `${seasonLabel} - Episode ${epNum}`;
    episodeMediaId = `${id}-s${seasonNum}-e${epNum}`;
    let rawStaffData;
    if (seasonNum === localMedia.anilistId) {
      rawStaffData = localMedia.staffData || seasonData.staff;
      episodeCastData = localMedia.castData || seasonData.characters;
    } else {
      rawStaffData = seasonRecord?.staffData || seasonData.staff;
      episodeCastData = seasonRecord?.castData || seasonData.characters;
    }
    episodeCrew = getEpisodeCrew(rawStaffData, epNum);
  }

  const sortedEpisodes = [...episodes].sort(
    (a, b) => a.episode_number - b.episode_number
  );
  const currentIndex = sortedEpisodes.findIndex(
    (ep) => ep.episode_number === epNum
  );
  const prevEpisode =
    currentIndex > 0 ? sortedEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1
      ? sortedEpisodes[currentIndex + 1]
      : null;

  const [stats, placementRank, reviews, globalData] = await Promise.all([
    getMediaStats(episodeMediaId),
    getListRank(episodeMediaId),
    prisma.userRating.findMany({
      where: { media_id: episodeMediaId, review_text: { not: null } },
      select: { score: true, review_text: true, username: true, avatar_url: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
    getDeepCriteriaRows(episodeMediaId),
  ]);

  const globalCriteriaAverages = calculateCriteriaAverages(globalData);
  const activeCriteriaConfig = CRITERIA_CONFIG["show"] || [];

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24">
      {episode.originalImage && (
        <>
          <div className="absolute top-0 left-0 w-full h-[60vh] opacity-30 bg-cover bg-center" style={{ backgroundImage: `url(${episode.originalImage})` }} />
          <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-t from-gray-950 to-transparent" />
        </>
      )}
      
      <div className="max-w-7xl mx-auto px-8 pt-24 relative z-10">
        <Link
          href={`/media/${id}/season/${seasonNum}`}
          className="text-gray-400 hover:text-white mb-8 inline-block font-semibold"
        >
          ← Back to Season
        </Link>

        <div className="flex flex-col md:flex-row gap-10 mb-16">
          {/* Left Column: Poster & Slider */}
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 space-y-6">
            {episode.image ? (
              <img
                src={episode.image}
                alt={episode.name}
                className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-gray-800"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
                No Image
              </div>
            )}

            <RatingSlider
              mediaId={episodeMediaId}
              mediaType="episode"
              mediaTitle={episodeFullTitle}
              mediaImage={episode.image}
            />
          </div>

          {/* Right Column: Details & Scores */}
          <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4 drop-shadow-md">
              {episode.name}
            </h1>

            <div className="flex items-center gap-3 mt-3 mb-6">
              <span className="text-blue-400 font-bold uppercase tracking-widest text-sm border border-blue-500/30 bg-blue-500/10 px-3 py-1 rounded">
                Episode {episode.episode_number}
              </span>

              {episode.air_date && (
                <span className="text-gray-300 font-bold text-sm">
                  {episode.air_date}
                </span>
              )}

              {episode.air_date && episode.runtime > 0 && (
                <span className="text-gray-600">•</span>
              )}

              {episode.runtime > 0 && (
                <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                  {episode.runtime} min
                </span>
              )}

              <span className="text-gray-600">•</span>

              <div className="flex items-center gap-2">
                {prevEpisode && (
                  <Link
                    href={`/media/${id}/season/${seasonNum}/episode/${prevEpisode.episode_number}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-gray-800 bg-gray-900 text-sm text-gray-400 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    ←
                  </Link>
                )}

                {nextEpisode && (
                  <Link
                    href={`/media/${id}/season/${seasonNum}/episode/${nextEpisode.episode_number}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-gray-800 bg-gray-900 text-sm text-gray-400 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    →
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-8 mb-10 text-lg leading-relaxed text-gray-300 drop-shadow-sm">
              <ExpandableText text={episode.overview || "No overview available for this episode."} maxLength={500} />
            </div>

            {/* DYNAMIC EPISODE CREW GRID */}
            {episodeCrew && (episodeCrew.primary?.length > 0 || episodeCrew.secondary?.length > 0) ? (
              <StaffGrid 
                primaryStaff={episodeCrew.primary || []} 
                secondaryStaff={episodeCrew.secondary || []} 
              />
            ) : showDetails ? (
              <div className="flex flex-wrap gap-x-10 gap-y-6 py-5 border-y border-gray-800/60 mb-6 mt-8">
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
            ) : null}
            {/* MASTER STAT BLOCK */}
            <div className="flex flex-wrap gap-8 border-y border-gray-800 py-6 mb-8 mt-8 bg-gray-950/50 rounded-xl px-6">
              <div className="shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Community Score</p>
                <p className={`text-4xl font-extrabold ${stats?.community_average ? "text-blue-400" : "text-gray-500"}`}>
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
                <p className="text-xs text-gray-500 mt-1 uppercase">Global Episode</p>
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
                        const scoreColor = score >= 95 ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" : score >= 75 ? "text-green-400" : score >= 50 ? "text-blue-400" : score >= 25 ? "text-gray-400" : "text-gray-700";
                        return (
                          <div key={item.key} className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 font-medium">{item.label}</span>
                            <span className={`font-black ${scoreColor}`}>{score}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>



            </div>
          </div>

        {/* EPISODE CAST */}
        {episodeCastData && episodeCastData.edges?.length > 0 && (
          <div className="pt-8 border-t border-gray-800">
            <h2 className="text-2xl font-bold mb-6 mt-2">Episode Cast</h2>
            <ExpandableAniListCast castData={episodeCastData} />
          </div>
        )}

        {/* RESTORED REVIEWS SECTION */}
        <div className="mt-8 pt-12 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-8">Community Reviews</h2>
              <TextReviewEditor mediaId={episodeMediaId} mediaTitle={episodeFullTitle} mediaImage={episode.image} />
              
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
