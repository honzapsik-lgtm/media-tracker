import { getSeasonEpisodes } from "@/app/actions";
import { getTMDbDetails } from "@/lib/tmdb";
import RatingSlider from "@/components/RatingSlider";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";
import { getListRank, getMediaStats, getDeepCriteriaRows, calculateCriteriaAverages } from "@/lib/media-db";
import TextReviewEditor from "@/components/TextReviewEditor";
import { prisma } from "@/lib/prisma";
import { CRITERIA_CONFIG } from "@/lib/constants";

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  overview: string;
  image: string | null;
  air_date: string;
  runtime: number;
  globalScore: number;
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

  const parts = id.split("-");
  if (parts[0] !== "tmdb" || parts[1] !== "tv") notFound();

  const tmdbId = parts[2];
  const seasonNum = parseInt(seasonNumber, 10);
  if (Number.isNaN(seasonNum) || seasonNum < 0) notFound();

  const showDetails = await getTMDbDetails(tmdbId, "tv");
  if (!showDetails || showDetails.type !== "show") notFound();

  const episodes: Episode[] = await getSeasonEpisodes(tmdbId, seasonNum);

  const seasons = (showDetails.seasons ?? []) as TmdbSeasonSummary[];
  const validSeasonNumbers = seasons
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number)
    .sort((a, b) => a - b);

  if (!validSeasonNumbers.includes(seasonNum)) notFound();

  const seasonMeta = seasons.find((s) => s.season_number === seasonNum);
  const nextSeasonNum = validSeasonNumbers.find((n) => n > seasonNum);
  const tmdbSeasonScore = seasonMeta?.vote_average
    ? Math.round(seasonMeta.vote_average * 10)
    : 0;

  const seasonPoster = seasonMeta?.poster_path
    ? `https://image.tmdb.org/t/p/w500${seasonMeta.poster_path}`
    : showDetails.image;

  // Exact ID formatting so the DB recognizes it as a show
  const seasonMediaId = `${id}-s${seasonNum}`;
  const seasonFullTitle = `${showDetails.title} - ${seasonMeta?.name ?? `Season ${seasonNum}`}`;

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

  const seasonLabel = seasonMeta?.name ?? `Season ${seasonNum}`;

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
          </div>

          <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
              {showDetails.title} - Season {seasonNum}
            </h1>

            <div className="flex items-center gap-3 mt-3 mb-4">
              {seasonMeta?.air_date && (
                <span className="text-gray-300 font-bold text-sm">
                  {seasonMeta.air_date.split('-')[0]}
                </span>
              )}

              {seasonMeta?.air_date && seasonMeta?.episode_count != null && (
                <span className="text-gray-600">•</span>
              )}

              {seasonMeta?.episode_count != null && (
                <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                  {seasonMeta.episode_count} episodes
                </span>
              )}

              <span className="text-gray-600">•</span>

              <div className="flex items-center gap-2">
                {seasonNum > 1 && (
                  <Link
                    href={`/media/${id}/season/${seasonNum - 1}`}
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

            {/* DYNAMIC CREW GRID */}
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

            {seasonMeta?.overview && (
              <ExpandableText text={seasonMeta.overview} maxLength={300} />
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

            {episodes.length === 0 ? (
              <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                <p className="text-gray-400">No episodes found for this season.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {episodes.map((ep) => (
                  <Link
                    key={ep.id}
                    href={`/media/${id}/season/${seasonNum}/episode/${ep.episode_number}`}
                    className="bg-gray-900 p-5 rounded-xl border border-gray-800 hover:border-blue-500 hover:bg-gray-800/80 transition-colors block"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-black text-gray-500">
                        Episode {ep.episode_number}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-gray-100">{ep.name}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {ep.air_date && <span>{ep.air_date}</span>}
                      {ep.runtime ? (
                        <span>
                          {ep.air_date ? " • " : ""}
                          {ep.runtime} min
                        </span>
                      ) : null}
                    </p>
                  </Link>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* RESTORED REVIEWS SECTION */}
        <div className="mt-8 pt-12 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-8">Community Reviews</h2>
              <TextReviewEditor mediaId={seasonMediaId} mediaTitle={seasonFullTitle} mediaImage={seasonPoster} />
              
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
