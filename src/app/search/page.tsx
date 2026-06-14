import { searchTMDb } from "@/lib/tmdb";

import { searchGames } from "@/lib/games";
import { searchAniList } from "@/lib/anilist";
import { getListRankMap, getMediaStatsMap } from '@/lib/media-db';
import SearchResultsTabs from "@/components/SearchResultsTabs";
import Link from "next/link";
import { Suspense } from "react";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || "";
  
  // PARALLEL FETCHING: All APIs hit simultaneously
  const [tmdbResultsRaw, games, anilistRaw] = query 
    ? await Promise.all([searchTMDb(query), searchGames(query), searchAniList(query)])
    : [[], [], []];

  let anilist = anilistRaw;

  // The TMDB Shield
  const shieldedAnime: any[] = [];
  const tmdbResults = tmdbResultsRaw.filter((item: any) => {
    const genres = item.genreIds || item.genre_ids || [];
    const lang = item.originalLanguage || item.original_language;
    const isJapaneseAnime = lang === 'ja' && genres.some((g: any) => Number(g) === 16);
    if (isJapaneseAnime) {
      shieldedAnime.push(item);
      return false;
    }
    return true;
  });

  // AniList Typo Fallback: fuzzy matching fallback utilizing TMDB's superior search
  if (anilist.length === 0 && shieldedAnime.length > 0) {
    anilist = await searchAniList(shieldedAnime[0].title);
  }

  // Interleave results (AniList, TMDB, Games)
  let combinedResults: any[] = [];
  if (query) {
    const maxLen = Math.max(tmdbResults.length, games.length, anilist.length);
    for (let i = 0; i < maxLen; i++) {
      if (anilist[i]) combinedResults.push(anilist[i]);
      if (tmdbResults[i]) combinedResults.push(tmdbResults[i]);
      if (games[i]) combinedResults.push(games[i]);
    }
  }

  if (combinedResults.length > 0) {
    const mediaIds = combinedResults.map(i => i.id);
    const [statsMap, rankMap] = await Promise.all([
      getMediaStatsMap(mediaIds),
      getListRankMap(mediaIds),
    ]);
    combinedResults = combinedResults.map(item => ({
      ...item,
      communityScore: statsMap[item.id] || null,
      listRank: rankMap[item.id] || null,
    }));
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 font-semibold flex w-fit items-center gap-2 transition-colors">
            ← Back Home
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          Search Results for: <span className="text-blue-400">&ldquo;{query}&rdquo;</span>
        </h1>

        {combinedResults.length === 0 && query ? (
          <p className="text-gray-400">No results found.</p>
        ) : (
          /* Hand the data off to the interactive UI */
          <SearchResultsTabs results={combinedResults} />
        )}
      </div>
    </main>
  );
}
