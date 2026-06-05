import { searchTMDb } from "@/lib/tmdb";
import { searchBooks } from "@/lib/books";
import { searchGames } from "@/lib/games";
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
  const [tmdbResults, books, games] = query 
    ? await Promise.all([searchTMDb(query), searchBooks(query), searchGames(query)])
    : [[], [], []];

  // Combine and sort alphabetically
  let combinedResults = [...tmdbResults, ...books, ...games].sort((a, b) => 
    a.title.localeCompare(b.title)
  );

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
