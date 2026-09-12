/* eslint-disable @typescript-eslint/no-explicit-any */
import { MediaItem, MediaCredit } from '@/types';
import { readApiCache, timeProviderFetch, writeApiCache } from '@/lib/api-cache';
import { prisma } from '@/lib/prisma';
import { normalizeTMDbRole } from './credits-parser';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60;

// We strongly type the response so Cursor gives us perfect autocomplete later
export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
}

export async function getTrendingMovies(): Promise<MediaItem[]> {
  const cacheId = 'tmdb-trending-movies-day';
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  if (!TMDB_API_KEY) return [];

  const res = await timeProviderFetch({
    provider: "tmdb",
    cacheId,
    operation: "tmdb.trending_movies",
    fetcher: () => fetch(
    `${BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}&language=en-US`,
    { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) throw new Error('Failed to fetch trending movies');
  const data = await res.json();

  // NORMALIZE the trending data to match the MediaItem interface
  const results = data.results.map((movie: any) => ({
    id: `tmdb-movie-${movie.id}`, // THE FIX: This now matches the new routing logic
    title: movie.title,
    type: 'movie',
    image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    releaseDate: movie.release_date || 'N/A'
  }));

  await writeApiCache(cacheId, 'tmdb', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function getTrendingShows(): Promise<MediaItem[]> {
  const cacheId = 'tmdb-trending-tv-day';
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  if (!TMDB_API_KEY) return [];

  const res = await timeProviderFetch({
    provider: "tmdb",
    cacheId,
    operation: "tmdb.trending_tv",
    fetcher: () => fetch(
    `${BASE_URL}/trending/tv/day?api_key=${TMDB_API_KEY}&language=en-US`,
    { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) throw new Error('Failed to fetch trending TV shows');
  const data = await res.json();

  const results = data.results.map((show: any) => ({
    id: `tmdb-tv-${show.id}`, 
    title: show.name || show.title,
    type: 'show',
    image: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
    releaseDate: show.first_air_date || show.release_date || 'N/A'
  }));

  await writeApiCache(cacheId, 'tmdb', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function searchTMDb(query: string): Promise<MediaItem[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const cacheId = `tmdb-search-${encodeURIComponent(normalizedQuery)}`;
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  if (!TMDB_API_KEY) throw new Error("TMDb API Key is missing");

  const encodedQuery = encodeURIComponent(normalizedQuery);
  const res = await timeProviderFetch({
    provider: "tmdb",
    cacheId,
    operation: "tmdb.search",
    fetcher: () => fetch(
    `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodedQuery}&language=en-US&page=1`,
    { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) throw new Error('Failed to search TMDb');
  const data = await res.json();
  
  // Filter out 'person' (actors) so we only get movies and tv shows
  const mediaOnly = data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');

  const results = mediaOnly.map((item: any) => ({
    // CRUCIAL: We inject the media_type into the ID so the details page knows which endpoint to hit
    id: `tmdb-${item.media_type}-${item.id}`, 
    title: item.title || item.name, // TMDb uses 'title' for movies, 'name' for TV
    type: item.media_type === 'tv' ? 'show' : 'movie',
    image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    releaseDate: item.release_date || item.first_air_date || 'N/A',
    originalLanguage: item.original_language,
    genreIds: item.genre_ids || []
  }));

  await writeApiCache(cacheId, 'tmdb', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function getTMDbDetails(id: string, type: 'movie' | 'tv') {
  const cacheId = `tmdb-${type}-${id}`;
  const cached = await prisma.apiCache.findUnique({ where: { id: cacheId } });
  if (cached && cached.data && JSON.stringify(cached.data) !== 'null' && cached.expires_at > new Date()) {
    const cachedData = cached.data as any;
    const needsCastUpgrade = type === 'tv' && Array.isArray(cachedData.cast) && cachedData.cast.length <= 15;
    if (cachedData.originalLanguage !== undefined && !needsCastUpgrade) {
      return cachedData;
    }
  }

  if (!TMDB_API_KEY) throw new Error("TMDb API Key is missing");

  const appendParams = type === 'tv'
    ? 'credits,aggregate_credits,videos,release_dates,watch/providers'
    : 'credits,videos,release_dates,watch/providers';

  const res = await timeProviderFetch({
    provider: "tmdb",
    cacheId,
    operation: "tmdb.details",
    fetcher: () => fetch(
      `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=${appendParams}`,
      { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const trailer = data.videos?.results?.find(
    (vid: any) => vid.site === 'YouTube' && vid.type === 'Trailer'
  );

  // For TV shows, aggregate_credits contains the series cast across all seasons (sorted by episode count/billing).
  // data.credits.cast only contains the cast credited in the most recent episode/season (which was only 14 actors for GoT).
  const rawCast = (type === 'tv' && data.aggregate_credits?.cast?.length)
    ? data.aggregate_credits.cast
    : (data.credits?.cast || []);

  const fullCast = rawCast.map((actor: any) => {
    const charName = (actor.roles && actor.roles.length > 0)
      ? actor.roles.map((r: any) => r.character).filter(Boolean).slice(0, 2).join(' / ')
      : actor.character || 'Unknown Role';

    return {
      id: actor.id,
      name: actor.name,
      character: charName,
      image: actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : null,
    };
  });

  // THE NEW CREW SEARCH LOGIC:
  const credits: MediaCredit[] = [];
  const rawCrew = (type === 'tv' && data.aggregate_credits?.crew?.length)
    ? data.aggregate_credits.crew
    : (data.credits?.crew || []);

  rawCrew.forEach((c: any) => {
    const jobsList: string[] = [];
    if (Array.isArray(c.jobs) && c.jobs.length > 0) {
      c.jobs.forEach((j: any) => {
        if (j.job) jobsList.push(j.job);
      });
    } else if (c.job) {
      jobsList.push(c.job);
    }

    jobsList.forEach((jobName) => {
      const role = normalizeTMDbRole(jobName);
      if (!credits.find(existing => existing.id === `tmdb-${c.id}` && existing.role === role)) {
        credits.push({
          id: `tmdb-${c.id}`,
          name: c.name,
          role: role,
          image: c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null,
        });
      }
    });
  });

  if (data.created_by) {
    data.created_by.forEach((c: any) => {
      if (!credits.find(existing => existing.id === `tmdb-${c.id}` && (existing.role === 'Creator' || existing.role === 'Original Creator'))) {
        credits.unshift({
          id: `tmdb-${c.id}`,
          name: c.name,
          role: 'Creator',
          image: c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null,
        });
      }
    });
  }
  let watchData = null;
  if (data['watch/providers']?.results?.US) {
    const us = data['watch/providers'].results.US;
    watchData = {
      flatrate: us.flatrate || [],
      rent: us.rent || [],
      buy: us.buy || []
    };
  }

  const result = {
    id: cacheId,
    title: data.title || data.name,
    originalTitle: data.original_name || data.original_title || null,
    originalLanguage: data.original_language || null,
    type: type === 'tv' ? 'show' : 'movie',
    image: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
    description: data.overview,
    releaseDate: data.release_date || data.first_air_date,
    globalScore: data.vote_average ? Math.round(data.vote_average * 10) : 0,
    runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null),
    genres: data.genres?.map((g: any) => g.name) || [],
    trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
    cast: fullCast,
    seasons: data.seasons || null,
    credits,
    watchData,
    studioData: getCleanStudios(data, type),
  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.apiCache.upsert({
    where: { id: cacheId },
    update: { data: result as any, expires_at: expiresAt },
    create: { id: cacheId, provider: 'tmdb', data: result as any, expires_at: expiresAt }
  });

  try {
    const numId = Number(id);
    if (!isNaN(numId) && watchData) {
      await prisma.media.updateMany({
        where: { tmdbId: numId },
        data: { watchData }
      });
    }
  } catch (e) {
    console.error("[TMDb Sync] Failed to update Prisma watchData", e);
  }

  return result;
}

export async function getTMDbSeasonData(tmdbShowId: number, seasonNumber: number) {
  if (!process.env.TMDB_API_KEY) {
    console.warn("[TMDb] API Key is missing. Cannot fetch season data.");
    return null;
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tmdbShowId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    if (res.status === 404) {
      console.warn(`[TMDb] Season ${seasonNumber} not found for show ${tmdbShowId}`);
      return null;
    }
    console.warn(`[TMDb] Failed to fetch season ${seasonNumber} for show ${tmdbShowId}: ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  if (!data.episodes) return [];

  return data.episodes.map((episode: any) => ({
    episode_number: episode.episode_number,
    name: episode.name,
    overview: episode.overview,
    still_path: episode.still_path ? `https://image.tmdb.org/t/p/w780${episode.still_path}` : null,
    air_date: episode.air_date,
    runtime: episode.runtime
  }));
}

export function getCleanStudios(data: any, type: 'movie' | 'tv'): { id: string; name: string }[] {
  const isAnime = (data.original_language === 'ja') && data.genres?.some((g: any) => g.name === 'Animation');
  const networks = data.networks || [];
  const prodCompanies = data.production_companies || [];

  let rawList: { id: string; name: string }[] = [];

  if (type === 'tv' && isAnime) {
    // For anime TV shows: production_companies contain the actual animation studios (first 1-3).
    // Broadcast networks in Japan (MBS, Tokyo MX, NHK G) are TV channels, not animation studios.
    const networkNames = new Set(networks.map((n: any) => (n.name || '').toLowerCase().trim()));
    const validProd = prodCompanies.filter((c: any) => !networkNames.has((c.name || '').toLowerCase().trim()));
    rawList = validProd.slice(0, 3).map((c: any) => ({ id: `tmdb-${c.id}`, name: c.name }));
  } else if (type === 'tv' && networks.length > 0) {
    // For Western/other TV shows: networks (HBO, AMC, Netflix, Apple TV+) are the primary identity
    rawList = networks.slice(0, 2).map((n: any) => ({ id: `tmdbnet-${n.id}`, name: n.name }));
  } else {
    // For movies or TV shows without networks: top 1-2 production companies
    rawList = prodCompanies.slice(0, 2).map((c: any) => ({ id: `tmdb-${c.id}`, name: c.name }));
  }

  // Deduplicate by normalized alphanumeric name
  const seen = new Set<string>();
  const result: { id: string; name: string }[] = [];

  for (const item of rawList) {
    if (!item.name) continue;
    const norm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(item);
    }
  }

  return result;
}

export function cleanStudioData(studios: any[], isAnime: boolean, isTv: boolean): any[] {
  if (!studios || !Array.isArray(studios) || studios.length === 0) return [];

  // Deduplicate by normalized name
  const seen = new Set<string>();
  const deduplicated: any[] = [];
  for (const s of studios) {
    const name = s.name || s;
    if (!name) continue;
    const norm = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(norm)) {
      seen.add(norm);
      deduplicated.push(s);
    }
  }

  // If it's a TV show that isn't anime, prefer networks (id starting with tmdbnet-)
  if (isTv && !isAnime) {
    const netOnly = deduplicated.filter(s => s.id && String(s.id).startsWith('tmdbnet-'));
    if (netOnly.length > 0) {
      return netOnly.slice(0, 2);
    }
  }

  // If anime TV show, exclude network stations (tmdbnet-) and take top 3 animation studios
  if (isTv && isAnime) {
    const prodOnly = deduplicated.filter(s => !s.id || !String(s.id).startsWith('tmdbnet-'));
    if (prodOnly.length > 0) {
      return prodOnly.slice(0, 3);
    }
  }

  return deduplicated.slice(0, 3);
}
