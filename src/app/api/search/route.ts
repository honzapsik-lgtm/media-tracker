import { NextRequest, NextResponse } from "next/server";
import { searchTMDb } from "@/lib/tmdb";
import { searchGames } from "@/lib/games";
import { searchAniList } from "@/lib/anilist";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || !q.trim()) {
    return NextResponse.json([]);
  }

  try {
    const [tmdbResults, games, manga] = await Promise.all([
      searchTMDb(q),
      searchGames(q),
      searchAniList(q)
    ]);

    // Interleave results (TMDB shows/movies, Games, Manga)
    const combinedResults = [];
    const maxLen = Math.max(tmdbResults.length, games.length, manga.length);
    for (let i = 0; i < maxLen; i++) {
      if (tmdbResults[i]) combinedResults.push(tmdbResults[i]);
      if (games[i]) combinedResults.push(games[i]);
      if (manga[i]) combinedResults.push(manga[i]);
    }

    // Return top 24 results across types
    return NextResponse.json(combinedResults.slice(0, 24));
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to fetch search results" }, { status: 500 });
  }
}
