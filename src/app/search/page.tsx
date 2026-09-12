import { searchTMDb } from "@/lib/tmdb";

import { searchGames } from "@/lib/games";
import { searchMangaDex } from "@/lib/mangadex";
import { getListRankMap, getMediaStatsMap } from '@/lib/media-db';
import { prisma } from "@/lib/prisma";
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
  const cleanUserQuery = query.trim().replace(/^@/, "");
  const [tmdbResults, games, manga, userResults] = query 
    ? await Promise.all([
        searchTMDb(query),
        searchGames(query),
        searchMangaDex(query),
        cleanUserQuery
          ? prisma.user.findMany({
              where: {
                OR: [
                  { username: { contains: cleanUserQuery, mode: "insensitive" } },
                  { name: { contains: cleanUserQuery, mode: "insensitive" } },
                ],
              },
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
                country: true,
                stateRegion: true,
                created_at: true,
                _count: {
                  select: { ratings: true },
                },
              },
              take: 30,
            })
          : Promise.resolve([]),
      ])
    : [[], [], [], []];

  // Interleave results (TMDB, Games, Manga)
  let combinedResults: any[] = [];
  if (query) {
    const maxLen = Math.max(tmdbResults.length, games.length, manga.length);
    for (let i = 0; i < maxLen; i++) {
      if (tmdbResults[i]) combinedResults.push(tmdbResults[i]);
      if (games[i]) combinedResults.push(games[i]);
      if (manga[i]) combinedResults.push(manga[i]);
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

        {combinedResults.length === 0 && userResults.length === 0 && query ? (
          <p className="text-gray-400">No results found.</p>
        ) : (
          /* Hand the data off to the interactive UI */
          <SearchResultsTabs results={combinedResults} userResults={userResults} />
        )}
      </div>
    </main>
  );
}
