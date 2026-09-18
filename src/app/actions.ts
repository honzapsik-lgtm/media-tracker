"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { readApiCache, timeProviderFetch, writeApiCache } from "@/lib/api-cache";
import { getIGDBToken } from "@/lib/games";

export interface DiscoverMediaItem {
  id: string;
  title: string;
  image: string;
  type: string;
  globalScore: number;
  releaseDate?: string | null;
}

const DISCOVER_CACHE_TTL_SECONDS = 6 * 60 * 60;

const isValidYear = (year: string) => /^\d{4}$/.test(year.trim());

const normalizeGenreKey = (genre: string) =>
  genre.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// TMDb Movie Genre IDs
const tmdbMovieGenreIdByKey: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  sciencefiction: 878,
  tvmovie: 10770,
  thriller: 53,
  war: 10752,
  western: 37,
};

// TMDb TV Show Genre IDs
const tmdbShowGenreIdByKey: Record<string, number> = {
  action: 10759,
  adventure: 10759,
  actionadventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  scifi: 10765,
  fantasy: 10765,
  scififantasy: 10765,
  sciencefiction: 10765,
  soap: 10766,
  talk: 10767,
  war: 10768,
  politics: 10768,
  warpolitics: 10768,
  western: 37,
};

interface IgdbFilter {
  genreId?: number;
  themeId?: number;
}

const igdbFilterByKey: Record<string, IgdbFilter> = {
  // Genres
  pointandclick: { genreId: 2 },
  fighting: { genreId: 4 },
  shooter: { genreId: 5 },
  music: { genreId: 7 },
  platform: { genreId: 8 },
  platformer: { genreId: 8 },
  puzzle: { genreId: 9 },
  racing: { genreId: 10 },
  realtimestrategyrts: { genreId: 11 },
  rts: { genreId: 11 },
  roleplaying: { genreId: 12 },
  roleplayingrpg: { genreId: 12 },
  rpg: { genreId: 12 },
  simulator: { genreId: 13 },
  simulation: { genreId: 13 },
  sport: { genreId: 14 },
  sports: { genreId: 14 },
  strategy: { genreId: 15 },
  turnbasedstrategytbs: { genreId: 16 },
  tbs: { genreId: 16 },
  tactical: { genreId: 24 },
  hackandslashbeatemup: { genreId: 25 },
  quiztrivia: { genreId: 26 },
  trivia: { genreId: 26 },
  pinball: { genreId: 30 },
  adventure: { genreId: 31 },
  indie: { genreId: 32 },
  arcade: { genreId: 33 },
  visualnovel: { genreId: 34 },
  cardboardgame: { genreId: 35 },
  cardandboardgame: { genreId: 35 },
  boardgames: { genreId: 35 },
  card: { genreId: 35 },
  moba: { genreId: 36 },
  massmultiplayer: { genreId: 36 },
  massivelymultiplayer: { genreId: 36 },
  mmo: { genreId: 36 },
  casual: { genreId: 33 },
  // Themes
  action: { themeId: 1 },
  actionadventure: { themeId: 1, genreId: 31 },
  fantasy: { themeId: 17 },
  scifi: { themeId: 18 },
  sciencefiction: { themeId: 18 },
  horror: { themeId: 19 },
  thriller: { themeId: 20 },
  suspense: { themeId: 20 },
  survival: { themeId: 21 },
  historical: { themeId: 22 },
  stealth: { themeId: 23 },
  comedy: { themeId: 27 },
  drama: { themeId: 31 },
  openworld: { themeId: 38 },
  warfare: { themeId: 39 },
  war: { themeId: 39 },
  mystery: { themeId: 43 },
  romance: { themeId: 44 },
  sandbox: { themeId: 33 },
  educational: { themeId: 34 },
  kids: { themeId: 35 },
  family: { themeId: 35 },
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
    let rawEpisodes = (data.episodes || []) as any[];

    const { getCanonFinaleEpisodeNumbers, getExcludedSeason0EpisodeNumbers } = await import('@/lib/anime-canon');

    // 1. If viewing Season 0 (Specials & OVAs), filter out any specials that were integrated into regular seasons
    if (seasonNumber === 0) {
      const excluded = getExcludedSeason0EpisodeNumbers(tvId);
      if (excluded.length > 0) {
        rawEpisodes = rawEpisodes.filter(ep => !excluded.includes(ep.episode_number));
      }
    }

    const mappedEpisodes = rawEpisodes.map((ep: {
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
      globalScore: ep.vote_average ? Math.round(ep.vote_average * 10) : 0,
      isFinaleSpecial: false
    }));

    // 2. If this season concludes with canon finale specials from Season 0 (e.g. AoT Season 4)
    const canonSpecials = getCanonFinaleEpisodeNumbers(tvId, seasonNumber);
    if (canonSpecials.length > 0) {
      try {
        const s0Res = await fetch(
          `https://api.themoviedb.org/3/tv/${tvId}/season/0?api_key=${TMDB_API_KEY}&language=en-US`,
          { cache: 'force-cache' }
        );
        if (s0Res.ok) {
          const s0Data = await s0Res.json();
          const s0Eps = (s0Data.episodes || []) as any[];
          const matchingSpecials = s0Eps.filter(ep => canonSpecials.includes(ep.episode_number));

          matchingSpecials.forEach((ep) => {
            mappedEpisodes.push({
              id: ep.id,
              name: ep.name,
              episode_number: mappedEpisodes.length + 1,
              overview: ep.overview,
              image: ep.still_path ? `https://image.tmdb.org/t/p/w400${ep.still_path}` : null,
              air_date: ep.air_date,
              runtime: ep.runtime,
              globalScore: ep.vote_average ? Math.round(ep.vote_average * 10) : 0,
              isFinaleSpecial: true
            });
          });
        }
      } catch (err) {
        console.warn(`[getSeasonEpisodes] Failed to append canon specials for show ${tvId}:`, err);
      }
    }

    return mappedEpisodes;
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
  const cacheId = [
    "discover",
    type.trim().toLowerCase() || "all",
    normalizedGenre || "all",
    yearOk || "all",
    sort.trim().toLowerCase() || "default",
  ].join("-");

  const cached = await readApiCache<DiscoverMediaItem[]>(cacheId);
  if (cached) return cached;

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

      const tmdbDiscoverType = type === "movie" ? "movie" : "tv";
      const tmdbGenreId = tmdbDiscoverType === "movie"
        ? tmdbMovieGenreIdByKey[normalizedGenre]
        : tmdbShowGenreIdByKey[normalizedGenre];

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
      if (sort) {
        const tmdbSort = sort === "popular" ? "popularity.desc" : sort === "top_rated" ? "vote_average.desc" : sort;
        url.searchParams.set("sort_by", tmdbSort);
      }

      // Keep response small-ish.
      url.searchParams.set("page", "1");

      let res: Response | null = null;
      try {
        res = await timeProviderFetch({
          provider: "tmdb",
          cacheId,
          operation: "tmdb.discover",
          fetcher: async () => {
            try {
              return await fetch(url.toString(), { next: { revalidate: 3600 } });
            } catch {
              await new Promise((r) => setTimeout(r, 300));
              return await fetch(url.toString(), { next: { revalidate: 3600 } });
            }
          },
        });
      } catch (err) {
        console.warn("[discoverMedia] TMDb discover request failed:", err);
        return [];
      }
      if (!res || !res.ok) return [];
      const data: any = await res.json();

      const results: any[] = Array.isArray(data?.results) ? data.results : [];
      const discoverTypeLabel = type; // "movie" | "show"

      const discoverItems = resultsToDiscoverItems(
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

          const releaseDate = tmdbDiscoverType === "movie" ? item?.release_date : item?.first_air_date;

          return {
            id: `tmdb-${tmdbDiscoverType}-${item.id}`,
            title: item?.title ?? item?.name ?? "Untitled",
            image,
            type: discoverTypeLabel,
            globalScore,
            releaseDate: releaseDate || null,
          };
          })
          .filter(Boolean) as DiscoverMediaItem[]
      );

      await writeApiCache(cacheId, "tmdb", discoverItems, DISCOVER_CACHE_TTL_SECONDS);

      return discoverItems;
    }

    if (type === "game") {
      const token = await getIGDBToken();
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (!token || !clientId) return [];

      const filter = igdbFilterByKey[normalizedGenre];
      const whereConditions: string[] = ["cover != null"];

      if (filter) {
        if (filter.genreId && filter.themeId) {
          whereConditions.push(`(genres = (${filter.genreId}) | themes = (${filter.themeId}))`);
        } else if (filter.genreId) {
          whereConditions.push(`genres = (${filter.genreId})`);
        } else if (filter.themeId) {
          whereConditions.push(`themes = (${filter.themeId})`);
        }
      }

      if (yearOk) {
        const startTs = Math.floor(new Date(`${yearOk}-01-01T00:00:00Z`).getTime() / 1000);
        const endTs = Math.floor(new Date(`${yearOk}-12-31T23:59:59Z`).getTime() / 1000);
        whereConditions.push(`first_release_date >= ${startTs} & first_release_date <= ${endTs}`);
      }

      let sortClause = "sort total_rating_count desc;";
      if (sort === "top_rated") {
        whereConditions.push("total_rating != null & total_rating_count >= 5");
        sortClause = "sort total_rating desc;";
      } else if (sort === "lowest") {
        whereConditions.push("total_rating != null & total_rating_count >= 5");
        sortClause = "sort total_rating asc;";
      } else if (sort === "newest") {
        const nowTs = Math.floor(Date.now() / 1000);
        whereConditions.push(`first_release_date != null & first_release_date <= ${nowTs}`);
        sortClause = "sort first_release_date desc;";
      } else if (sort === "oldest") {
        whereConditions.push("first_release_date != null");
        sortClause = "sort first_release_date asc;";
      } else {
        whereConditions.push("total_rating_count != null");
        sortClause = "sort total_rating_count desc;";
      }

      const bodyQuery = `fields id, name, cover.image_id, first_release_date, total_rating; where ${whereConditions.join(" & ")}; ${sortClause} limit 12;`;

      let res: Response | null = null;
      try {
        res = await timeProviderFetch({
          provider: "igdb",
          cacheId,
          operation: "igdb.discover",
          fetcher: async () => {
            return await fetch("https://api.igdb.com/v4/games", {
              method: "POST",
              headers: {
                "Client-ID": clientId,
                "Authorization": `Bearer ${token}`
              },
              body: bodyQuery,
              next: { revalidate: 3600 }
            });
          }
        });
      } catch (err) {
        console.warn("[discoverMedia] IGDB discover request failed:", err);
        return [];
      }

      if (!res || !res.ok) return [];
      const results: any[] = await res.json().catch(() => []);

      const discoverItems = resultsToDiscoverItems(
        results
          .map((game: any) => {
            if (typeof game?.id !== "number") return null;

            const score = typeof game?.total_rating === "number" ? Math.round(game.total_rating) : 0;
            const image = game.cover?.image_id
              ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg`
              : "";
            const releaseDate = game.first_release_date
              ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
              : null;

            return {
              id: `igdb-game-${game.id}`,
              title: game?.name ?? "Untitled",
              image,
              type: "game",
              globalScore: safeGlobalScore(score),
              releaseDate,
            };
          })
          .filter(Boolean) as DiscoverMediaItem[]
      );

      await writeApiCache(cacheId, "igdb", discoverItems, DISCOVER_CACHE_TTL_SECONDS);

      return discoverItems;
    }

    if (type === "manga") {
      return await fetchAniListMangaDiscover(normalizedGenre, yearOk, sort, cacheId, resultsToDiscoverItems);
    }

    return [];
  } catch (error) {
    console.error("discoverMedia failed:", error);
    return [];
  }
}

async function fetchAniListMangaDiscover(
  normalizedGenre: string,
  yearOk: string | null,
  sort: string,
  cacheId: string,
  resultsToDiscoverItems: (items: DiscoverMediaItem[]) => DiscoverMediaItem[]
): Promise<DiscoverMediaItem[]> {
  try {
    const anilistGenreMap: Record<string, { genre?: string; tag?: string }> = {
      action: { genre: "Action" },
      adventure: { genre: "Adventure" },
      comedy: { genre: "Comedy" },
      drama: { genre: "Drama" },
      fantasy: { genre: "Fantasy" },
      horror: { genre: "Horror" },
      mystery: { genre: "Mystery" },
      psychological: { genre: "Psychological" },
      romance: { genre: "Romance" },
      scifi: { genre: "Sci-Fi" },
      sciencefiction: { genre: "Sci-Fi" },
      slice: { genre: "Slice of Life" },
      sliceoflife: { genre: "Slice of Life" },
      sports: { genre: "Sports" },
      supernatural: { genre: "Supernatural" },
      suspense: { genre: "Thriller" },
      thriller: { genre: "Thriller" },
      historical: { tag: "Historical" },
      martialarts: { tag: "Martial Arts" },
      mecha: { genre: "Mecha" },
      seinen: { tag: "Seinen" },
      shounen: { tag: "Shounen" },
      shoujo: { tag: "Shoujo" },
      josei: { tag: "Josei" },
      isekai: { tag: "Isekai" },
      ecchi: { genre: "Ecchi" },
      music: { genre: "Music" },
    };

    const mapped = anilistGenreMap[normalizedGenre];
    const anilistQuery = `
      query ($genre: String, $tag: String, $sort: [MediaSort], $year: String) {
        Page(page: 1, perPage: 12) {
          media(type: MANGA, genre: $genre, tag: $tag, sort: $sort, startDate_like: $year) {
            id
            title { english romaji }
            coverImage { large extraLarge }
            averageScore
            startDate { year month day }
          }
        }
      }
    `;
    let anilistSort: string[];
    if (sort === "top_rated") anilistSort = ["SCORE_DESC"];
    else if (sort === "lowest") anilistSort = ["SCORE_ASC"];
    else if (sort === "newest") anilistSort = ["START_DATE_DESC"];
    else if (sort === "oldest") anilistSort = ["START_DATE_ASC"];
    else anilistSort = ["POPULARITY_DESC"];

    const aniRes = await timeProviderFetch({
      provider: "anilist",
      cacheId,
      operation: "anilist.discover",
      fetcher: () => fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: anilistQuery,
          variables: {
            genre: mapped?.genre,
            tag: mapped?.tag,
            sort: anilistSort,
            year: yearOk ? `${yearOk}%` : undefined
          }
        }),
        next: { revalidate: 3600 }
      })
    });

    if (!aniRes.ok) return [];
    const aniJson = await aniRes.json();
    const aniMedia = aniJson.data?.Page?.media || [];
    const aniItems = resultsToDiscoverItems(
      aniMedia.map((m: any) => ({
        id: `anilist-manga-${m.id}`,
        title: m.title?.english || m.title?.romaji || "Untitled",
        image: m.coverImage?.extraLarge || m.coverImage?.large || "",
        type: "manga",
        globalScore: typeof m.averageScore === "number" ? m.averageScore : 0,
        releaseDate: m.startDate?.year ? `${m.startDate.year}-${String(m.startDate.month || 1).padStart(2, "0")}-${String(m.startDate.day || 1).padStart(2, "0")}` : null,
      }))
    );
    if (aniItems.length > 0) {
      await writeApiCache(cacheId, "anilist", aniItems, DISCOVER_CACHE_TTL_SECONDS);
      return aniItems;
    }
  } catch (aniErr) {
    console.warn("[discoverMedia] AniList manga discover failed:", aniErr);
  }
  return [];
}
