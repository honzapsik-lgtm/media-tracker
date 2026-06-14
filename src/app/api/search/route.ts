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
    const [tmdbResultsRaw, games, anilistRaw] = await Promise.all([
      searchTMDb(q),
      searchGames(q),
      searchAniList(q)
    ]);

    let anilist = anilistRaw;

    // The TMDB Shield
    const shieldedAnime: any[] = [];
    const tmdbResults = tmdbResultsRaw.filter((item: any) => {
      // Handle both mapped and raw formats from TMDB just in case
      const genres = item.genreIds || item.genre_ids || [];
      const lang = item.originalLanguage || item.original_language;
      const isJapaneseAnime = lang === 'ja' && genres.some((g: any) => Number(g) === 16);
      if (isJapaneseAnime) {
        shieldedAnime.push(item);
        return false;
      }
      return true;
    });

    // AniList Typo Fallback: If AniList failed to find anything due to typos, 
    // but TMDB successfully fuzzy-matched an anime, use TMDB's official title to search AniList!
    if (anilist.length === 0 && shieldedAnime.length > 0) {
      anilist = await searchAniList(shieldedAnime[0].title);
    }

    // Combine results (AniList prioritized, then TMDB, then games)
    // Avoid alphabetical sorting as it destroys relevance scoring
    const combinedResults = [];
    const maxLen = Math.max(tmdbResults.length, games.length, anilist.length);
    for (let i = 0; i < maxLen; i++) {
      if (anilist[i]) combinedResults.push(anilist[i]);
      if (tmdbResults[i]) combinedResults.push(tmdbResults[i]);
      if (games[i]) combinedResults.push(games[i]);
    }

    // Limit to top 20 instead of 8 to show more results across types
    return NextResponse.json(combinedResults.slice(0, 20));
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to fetch search results" }, { status: 500 });
  }
}
