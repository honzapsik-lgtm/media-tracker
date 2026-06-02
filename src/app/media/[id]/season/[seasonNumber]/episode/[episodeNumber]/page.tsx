import { getSeasonEpisodes } from "@/app/actions";
import RatingSlider from "@/components/RatingSlider";
import ExpandableText from "@/components/ExpandableText";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTMDbDetails } from "@/lib/tmdb";
import type { Episode } from "@/app/media/[id]/season/[seasonNumber]/page";
import { getMediaStats } from "@/lib/media-db";

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
  if (parts[0] !== "tmdb" || parts[1] !== "tv") notFound();

  const tmdbId = parts[2];
  const seasonNum = parseInt(seasonNumber, 10);
  const epNum = parseInt(episodeNumber, 10);
  if (Number.isNaN(seasonNum) || Number.isNaN(epNum)) notFound();

  const episodes: Episode[] = await getSeasonEpisodes(tmdbId, seasonNum);
  const episode = episodes.find((ep) => ep.episode_number === epNum);
  if (!episode) notFound();

  const showDetails = await getTMDbDetails(tmdbId, "tv");
  const showTitle = showDetails?.title || "Unknown Show";
  const episodeFullTitle = `${showTitle} - S${seasonNum} E${episode.episode_number} - ${episode.name}`;

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

  const episodeMediaId = `${id}-s${seasonNum}-e${epNum}`;
  const stats = await getMediaStats(episodeMediaId);

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24">
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

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <RatingSlider
                mediaId={episodeMediaId}
                mediaType="episode"
                mediaTitle={episodeFullTitle}
                mediaImage={episode.image}
              />
            </div>
          </div>

          {/* Right Column: Details & Scores */}
          <div className="flex-1">
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
              {episode.name}
            </h1>

            <div className="flex flex-wrap gap-3 mb-6">
              {prevEpisode && (
                <Link
                  href={`/media/${id}/season/${seasonNum}/episode/${prevEpisode.episode_number}`}
                  className="text-sm font-bold text-gray-300 bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors"
                >
                  ← Previous Episode
                </Link>
              )}
              {nextEpisode && (
                <Link
                  href={`/media/${id}/season/${seasonNum}/episode/${nextEpisode.episode_number}`}
                  className="text-sm font-bold text-gray-300 bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors"
                >
                  Next Episode →
                </Link>
              )}
            </div>

            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
              Episode {episode.episode_number}
            </p>

            <div className="flex gap-8 border-y border-gray-800 py-6 max-w-2xl mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">
                  TMDb Score
                </p>
                <p className="text-4xl font-extrabold text-green-400">
                  {episode.globalScore}%
                </p>
              </div>
              <div className="w-px bg-gray-800"></div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">
                  Community Score
                </p>
                <p className="text-4xl font-extrabold text-blue-400">
                  {stats?.community_average
                    ? `${stats.community_average}%`
                    : "N/A"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.total_ratings ?? 0} ratings
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              {episode.air_date && (
                <span className="text-sm font-bold text-gray-300">
                  {episode.air_date.split("-")[0]}
                </span>
              )}
              {episode.runtime > 0 && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-700"></span>
                  <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                    {episode.runtime} min
                  </span>
                </>
              )}
            </div>

            <ExpandableText text={episode.overview} maxLength={300} />
          </div>
        </div>
      </div>
    </main>
  );
}
