import { getSeasonEpisodes } from "@/app/actions";
import { getTMDbDetails } from "@/lib/tmdb";
import RatingSlider from "@/components/RatingSlider";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";
import { getListRank, getMediaStats } from "@/lib/media-db";

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

  const [stats, placementRank] = await Promise.all([
    getMediaStats(seasonMediaId),
    getListRank(seasonMediaId),
  ]);

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
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
              {showDetails.title}
            </h1>

            <div className="flex items-center gap-3 mb-4">
              {seasonNum > 1 && (
                <Link
                  href={`/media/${id}/season/${seasonNum - 1}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-xl text-gray-300 hover:border-blue-500 hover:text-white transition-colors"
                >
                  ←
                </Link>
              )}

              <p className="text-2xl text-blue-400 font-bold">{seasonLabel}</p>

              {nextSeasonNum != null && (
                <Link
                  href={`/media/${id}/season/${nextSeasonNum}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-xl text-gray-300 hover:border-blue-500 hover:text-white transition-colors"
                >
                  →
                </Link>
              )}
            </div>

            {/* NEW MASTER STAT BLOCK */}
            <div className="flex flex-wrap gap-8 border-y border-gray-800 py-6 mb-8 mt-8 bg-gray-950/50 rounded-xl px-6">
              <div className="shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">TMDb Score</p>
                <p className={`text-4xl font-extrabold ${getScoreColor(tmdbSeasonScore)}`}>{tmdbSeasonScore ? `${tmdbSeasonScore}%` : 'N/A'}</p>
              </div>
              <div className="w-px bg-gray-800 hidden sm:block"></div>
              
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
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              {seasonMeta?.episode_count != null && (
                <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                  {seasonMeta.episode_count} episodes
                </span>
              )}
            </div>

            {seasonMeta?.overview && (
              <ExpandableText text={seasonMeta.overview} maxLength={300} />
            )}

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
                      <p className={`text-xs font-bold whitespace-nowrap ${getScoreColor(ep.globalScore)}`}>
                        ★ {ep.globalScore}%
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
      </div>
    </main>
  );
}
