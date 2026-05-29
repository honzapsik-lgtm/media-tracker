"use server";

export interface DiscoverMediaItem {
  id: string;
  title: string;
  image: string;
  type: string;
  globalScore: number;
}

const isValidYear = (year: string) => /^\d{4}$/.test(year.trim());

const normalizeGenreKey = (genre: string) =>
  genre.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// TMDb genre IDs (common genres only)
const tmdbGenreIdByKey: Record<string, number> = {
  action: 28,
  drama: 18,
  scifi: 878, // also matches "sci-fi" after normalization
};

const rawgGenreSlugByKey: Record<string, string> = {
  action: "action",
  drama: "story-rich",
  scifi: "sci-fi",
};

// MAL genre IDs for manga (Jikan v4)
const jikanMangaGenreIdByKey: Record<string, number> = {
  action: 1,
  drama: 8,
  scifi: 24,
};

export async function getSeasonEpisodes(tvId: string, seasonNumber: number) {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) throw new Error("TMDB Key missing");

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`,
      { cache: 'force-cache' } // Cache the episodes so we don't spam the API
    );

    if (!res.ok) return [];
    const data = await res.json();

    return data.episodes.map((ep: {
      id: number;
      name: string;
      episode_number: number;
      overview: string;
      still_path: string | null;
      air_date: string;
      runtime: number;
      vote_average: number | null;
    }) => ({
      id: ep.id,
      name: ep.name,
      episode_number: ep.episode_number,
      overview: ep.overview,
      image: ep.still_path ? `https://image.tmdb.org/t/p/w400${ep.still_path}` : null,
      air_date: ep.air_date,
      runtime: ep.runtime,
      globalScore: ep.vote_average ? Math.round(ep.vote_average * 10) : 0
    }));
  } catch (error) {
    console.error("Failed to fetch episodes:", error);
    return [];
  }
}

export async function discoverMedia(
  type: string,
  genre: string,
  year: string,
  sort: string
): Promise<DiscoverMediaItem[]> {
  const normalizedGenre = normalizeGenreKey(genre);
  const yearOk = isValidYear(year) ? year.trim() : null;

  const safeGlobalScore = (score: unknown): number => {
    if (typeof score !== "number" || Number.isNaN(score)) return 0;
    return score;
  };

  const resultsToDiscoverItems = (
    items: DiscoverMediaItem[]
  ): DiscoverMediaItem[] => {
    // Enforce required output structure with fallbacks.
    return items.map((item) => ({
      ...item,
      title: item.title || "Untitled",
      image: item.image || "",
      globalScore: typeof item.globalScore === "number" ? item.globalScore : 0,
    }));
  };

  try {
    if (type === "movie" || type === "show") {
      const TMDB_API_KEY = process.env.TMDB_API_KEY;
      if (!TMDB_API_KEY) return [];

      const tmdbGenreId = tmdbGenreIdByKey[normalizedGenre];

      const tmdbDiscoverType = type === "movie" ? "movie" : "tv";
      const url = new URL(
        `https://api.themoviedb.org/3/discover/${tmdbDiscoverType}`
      );
      url.searchParams.set("api_key", TMDB_API_KEY);
      url.searchParams.set("language", "en-US");

      if (tmdbGenreId) url.searchParams.set("with_genres", String(tmdbGenreId));
      if (yearOk) {
        url.searchParams.set(
          tmdbDiscoverType === "movie" ? "primary_release_year" : "first_air_date_year",
          yearOk
        );
      }
      // TMDb expects sort_by like "popularity.desc" etc; if sort is empty, omit.
      if (sort) url.searchParams.set("sort_by", sort);

      // Keep response small-ish.
      url.searchParams.set("page", "1");

      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const data: any = await res.json();

      const results: any[] = Array.isArray(data?.results) ? data.results : [];
      const discoverTypeLabel = type; // "movie" | "show"

      return resultsToDiscoverItems(
        results
          .map((item: any) => {
            if (typeof item?.id !== "number") return null;

          const voteAverage = typeof item?.vote_average === "number" ? item.vote_average : null;
          const globalScore =
            voteAverage != null ? Math.round(voteAverage * 10) : 0;

          const posterPath = item?.poster_path as string | null;
          const backdropPath = item?.backdrop_path as string | null;

          const image = posterPath
            ? `https://image.tmdb.org/t/p/w500${posterPath}`
            : backdropPath
              ? `https://image.tmdb.org/t/p/w500${backdropPath}`
              : "";

          return {
            id: `tmdb-${tmdbDiscoverType}-${item.id}`,
            title: item?.title ?? item?.name ?? "Untitled",
            image,
            type: discoverTypeLabel,
            globalScore,
          };
          })
          .filter((x: DiscoverMediaItem | null): x is DiscoverMediaItem => x !== null)
      );
    }

    if (type === "game") {
      const RAWG_API_KEY = process.env.RAWG_API_KEY;
      if (!RAWG_API_KEY) return [];

      const rawgGenreSlug = rawgGenreSlugByKey[normalizedGenre] ?? normalizedGenre;

      const url = new URL("https://api.rawg.io/api/games");
      url.searchParams.set("key", RAWG_API_KEY);
      url.searchParams.set("page_size", "12");

      if (rawgGenreSlug) url.searchParams.set("genres", rawgGenreSlug);
      if (yearOk) {
        // RAWG expects: YYYY-01-01,YYYY-12-31
        url.searchParams.set("dates", `${yearOk}-01-01,${yearOk}-12-31`);
      }
      // RAWG expects ordering such as "-rating" or "released".
      if (sort) url.searchParams.set("ordering", sort);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return [];
      const data: any = await res.json();
      const results: any[] = Array.isArray(data?.results) ? data.results : [];

      return resultsToDiscoverItems(
        results
          .map((game: any) => {
            if (typeof game?.id !== "number") return null;

          const metacritic = typeof game?.metacritic === "number" ? game.metacritic : null;
          const rating = typeof game?.rating === "number" ? game.rating : null;

          // RAWG metacritic is already 0..100-like; RAWG rating is 0..5.
          const globalScore =
            metacritic != null ? Math.round(metacritic) : rating != null ? Math.round(rating * 20) : 0;

          return {
            id: `rawg-game-${game.id}`,
            title: game?.name ?? "Untitled",
            image: game?.background_image ?? "",
            type: "game",
            globalScore: safeGlobalScore(globalScore),
          };
          })
          .filter((x: DiscoverMediaItem | null): x is DiscoverMediaItem => x !== null)
      );
    }

    if (type === "manga") {
      const malGenreId = jikanMangaGenreIdByKey[normalizedGenre];

      const url = new URL("https://api.jikan.moe/v4/manga");
      const q = genre?.trim() ? genre.trim() : "";
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "12");
      url.searchParams.set("order_by", "score");
      url.searchParams.set("sort", sort === "lowest" ? "asc" : "desc");

      if (malGenreId) url.searchParams.set("genres", String(malGenreId));
      if (yearOk) {
        url.searchParams.set("start_date", `${yearOk}-01-01`);
        url.searchParams.set("end_date", `${yearOk}-12-31`);
      }

      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) return [];

      const data: any = await res.json();
      const results: any[] = Array.isArray(data?.data) ? data.data : [];

      return resultsToDiscoverItems(
        results
          .map((manga: any) => {
            if (typeof manga?.mal_id !== "number") return null;

          const score = typeof manga?.score === "number" ? manga.score : null;
          const globalScore = score != null ? Math.round(score * 10) : 0;

          const image =
            manga?.images?.webp?.image_url ??
            manga?.images?.jpg?.image_url ??
            manga?.images?.webp?.large_image_url ??
            manga?.images?.jpg?.large_image_url ??
            "";

          const title =
            manga?.title_english ?? manga?.title ?? manga?.title_japanese ?? "Untitled";

          return {
            id: `manga-${manga.mal_id}`,
            title,
            image,
            type: "manga",
            globalScore,
          };
          })
          .filter((x: DiscoverMediaItem | null): x is DiscoverMediaItem => x !== null)
      );
    }

    return [];
  } catch (error) {
    console.error("discoverMedia failed:", error);
    return [];
  }
}