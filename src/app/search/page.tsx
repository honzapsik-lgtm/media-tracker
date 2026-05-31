import { searchTMDb } from "@/lib/tmdb";
import { searchBooks } from "@/lib/books";
import { searchGames } from "@/lib/games";
import SearchBar from "@/components/SearchBar";
import SearchResultsTabs from "@/components/SearchResultsTabs"; // Import the new component
import Link from "next/link";

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
  const combinedResults = [...tmdbResults, ...books, ...games].sort((a, b) => 
    a.title.localeCompare(b.title)
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 font-semibold flex w-fit items-center gap-2 transition-colors">
            ← Back Home
          </Link>
        </div>

        <SearchBar />

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
