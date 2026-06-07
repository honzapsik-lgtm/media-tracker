/* eslint-disable @typescript-eslint/no-explicit-any */
import { MediaItem, MediaCredit } from '../types';
import { readApiCache, timeProviderFetch, writeApiCache } from '@/lib/api-cache';
import { prisma } from '@/lib/prisma';
const SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60;

export async function searchGames(query: string): Promise<MediaItem[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const cacheId = `rawg-search-${encodeURIComponent(normalizedQuery)}`;
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  const RAWG_API_KEY = process.env.RAWG_API_KEY;
  if (!RAWG_API_KEY) return []; // Silently fail if no key yet

  const encodedQuery = encodeURIComponent(normalizedQuery);
  const res = await timeProviderFetch({
    provider: "rawg",
    cacheId,
    operation: "rawg.search",
    fetcher: () => fetch(
    `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodedQuery}&page_size=10`,
    { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const results = data.results.map((game: any) => ({
    id: `rawg-game-${game.id}`,
    title: game.name,
    type: 'game',
    image: game.background_image || null,
    releaseDate: game.released || 'N/A'
  }));

  await writeApiCache(cacheId, 'rawg', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function getTrendingGames(): Promise<MediaItem[]> {
  const cacheId = 'rawg-trending-games-day';
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  const RAWG_API_KEY = process.env.RAWG_API_KEY;
  if (!RAWG_API_KEY) return [];

  const res = await timeProviderFetch({
    provider: "rawg",
    cacheId,
    operation: "rawg.trending_games",
    fetcher: () => fetch(
    `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&ordering=-added&page_size=10`,
    { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const results = data.results.map((game: any) => ({
    id: `rawg-game-${game.id}`,
    title: game.name,
    type: 'game',
    image: game.background_image || null,
    releaseDate: game.released || 'N/A'
  }));

  await writeApiCache(cacheId, 'rawg', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function getGameDetails(id: string) {
  const cacheId = `rawg-game-${id}`;
  const cached = await prisma.apiCache.findUnique({ where: { id: cacheId } });
  if (cached && cached.expires_at > new Date()) {
    return cached.data as any;
  }

  const RAWG_API_KEY = process.env.RAWG_API_KEY;
  if (!RAWG_API_KEY) throw new Error("RAWG API Key is missing");

  const res = await timeProviderFetch({
    provider: "rawg",
    cacheId,
    operation: "rawg.details",
    fetcher: () => fetch(
    `https://api.rawg.io/api/games/${id}?key=${RAWG_API_KEY}`,
    { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) return null;
  const data = await res.json();

  // RAWG provides HTML in their description, so we strip it out for clean text
  const cleanDescription = data.description_raw || data.description.replace(/<[^>]*>?/gm, '');

  const credits: MediaCredit[] = [];
  if (data.developers) {
    data.developers.forEach((d: any) => {
      credits.push({
        id: `rawg-creator-${d.id}`,
        name: d.name,
        role: 'Developer',
        image: d.image_background || null
      });
    });
  }
  if (data.publishers) {
    data.publishers.forEach((p: any) => {
      credits.push({
        id: `rawg-creator-${p.id}`,
        name: p.name,
        role: 'Publisher',
        image: p.image_background || null
      });
    });
  }

  const result = {
    id: cacheId,
    title: data.name,
    type: 'game',
    image: data.background_image || null,
    backdrop: data.background_image_additional || data.background_image || null,
    description: cleanDescription,
    releaseDate: data.released || 'N/A',
    globalScore: data.metacritic ? data.metacritic : 0,
    
    // THE FIX: Add the missing properties so TS matches TMDb
    runtime: data.playtime || null, // RAWG actually provides average playtime in hours!
    genres: data.genres?.map((g: any) => g.name) || [],
    trailerUrl: null, // We will leave this null for games for now
    cast: [],
    seasons: null,
    credits

  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.apiCache.upsert({
    where: { id: cacheId },
    update: { data: result as any, expires_at: expiresAt },
    create: { id: cacheId, provider: 'rawg', data: result as any, expires_at: expiresAt }
  });

  return result;
}
