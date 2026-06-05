import { NextRequest, NextResponse } from "next/server";
import { searchTMDb } from "@/lib/tmdb";
import { searchBooks } from "@/lib/books";
import { searchGames } from "@/lib/games";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || !q.trim()) {
    return NextResponse.json([]);
  }

  try {
    const [tmdbResults, books, games] = await Promise.all([
      searchTMDb(q),
      searchBooks(q),
      searchGames(q)
    ]);

    // Combine and sort alphabetically
    const combinedResults = [...tmdbResults, ...books, ...games].sort((a, b) => 
      a.title.localeCompare(b.title)
    );

    // Limit to top 8 for the dropdown
    return NextResponse.json(combinedResults.slice(0, 8));
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to fetch search results" }, { status: 500 });
  }
}
