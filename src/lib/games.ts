/* eslint-disable @typescript-eslint/no-explicit-any */
import { MediaItem, MediaCredit } from '../types';
import { readApiCache, timeProviderFetch, writeApiCache } from '@/lib/api-cache';
import { prisma } from '@/lib/prisma';
const SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60;

export async function getIGDBToken(): Promise<string> {
  const cacheKey = 'igdb-access-token';
  const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
  
  if (cached && cached.expires_at > new Date()) {
    const tokenObj = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
    if (tokenObj && tokenObj.access_token) {
      return tokenObj.access_token;
    }
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.warn("Missing Twitch Client ID or Secret for IGDB auth");
    return "";
  }

  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
    method: 'POST'
  });

  if (!res.ok) {
    throw new Error("Failed to fetch IGDB token");
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in * 1000) - 60000); // 1 minute safety buffer

  await prisma.apiCache.upsert({
    where: { id: cacheKey },
    update: { data: data as any, expires_at: expiresAt },
    create: { id: cacheKey, provider: 'igdb', data: data as any, expires_at: expiresAt }
  });

  return data.access_token;
}

export async function searchGames(query: string): Promise<MediaItem[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const cacheId = `igdb-search-${encodeURIComponent(normalizedQuery)}`;
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) return [];

  const bodyQuery = `search "${normalizedQuery}"; fields name, cover.image_id, first_release_date; limit 10;`;

  const res = await timeProviderFetch({
    provider: "igdb",
    cacheId,
    operation: "igdb.search",
    fetcher: () => fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`
      },
      body: bodyQuery,
      next: { revalidate: 3600 }
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const results = data.map((game: any) => ({
    id: `igdb-game-${game.id}`,
    title: game.name,
    type: 'game',
    image: game.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg` : null,
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : 'N/A'
  }));

  await writeApiCache(cacheId, 'igdb', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function getTrendingGames(): Promise<MediaItem[]> {
  const cacheId = 'igdb-trending-games-day';
  const cached = await readApiCache<MediaItem[]>(cacheId);
  if (cached) return cached;

  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) return [];

  const bodyQuery = `fields name, cover.image_id, first_release_date; sort total_rating_count desc; where total_rating_count > 0; limit 10;`;

  const res = await timeProviderFetch({
    provider: "igdb",
    cacheId,
    operation: "igdb.trending_games",
    fetcher: () => fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`
      },
      body: bodyQuery,
      next: { revalidate: 3600 }
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const results = data.map((game: any) => ({
    id: `igdb-game-${game.id}`,
    title: game.name,
    type: 'game',
    image: game.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg` : null,
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : 'N/A'
  }));

  await writeApiCache(cacheId, 'igdb', results, SEARCH_CACHE_TTL_SECONDS);

  return results;
}

export async function getGameDetails(id: string) {
  const numericId = parseInt(id.replace('igdb-game-', '').replace('rawg-game-', ''), 10);
  
  const cacheId = `igdb-game-${numericId}`;
  const cached = await prisma.apiCache.findUnique({ where: { id: cacheId } });
  if (cached && cached.expires_at > new Date()) {
    return cached.data as any;
  }

  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) throw new Error("Missing IGDB credentials");

  const bodyQuery = `fields name, cover.image_id, summary, first_release_date, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, game_engines.name, platforms.name, multiplayer_modes.*; where id = ${numericId};`;

  const res = await timeProviderFetch({
    provider: "igdb",
    cacheId,
    operation: "igdb.details",
    fetcher: () => fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`
      },
      body: bodyQuery,
      next: { revalidate: 3600 }
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  
  const game = data[0];

  const credits: MediaCredit[] = [];
  if (game.involved_companies) {
    game.involved_companies.forEach((ic: any) => {
      if (ic.company && ic.company.name) {
        if (ic.developer) {
          credits.push({
            id: `igdb-company-${ic.company.id}-dev`,
            name: ic.company.name,
            role: 'Developer',
            image: null
          });
        }
        if (ic.publisher) {
          credits.push({
            id: `igdb-company-${ic.company.id}-pub`,
            name: ic.company.name,
            role: 'Publisher',
            image: null
          });
        }
      }
    });
  }

  const result = {
    id: cacheId,
    title: game.name,
    type: 'game',
    image: game.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg` : null,
    backdrop: game.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg` : null,
    description: game.summary || null,
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : 'N/A',
    globalScore: 0,
    runtime: null,
    genres: [],
    trailerUrl: null,
    cast: [],
    seasons: null,
    credits
  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.apiCache.upsert({
    where: { id: cacheId },
    update: { data: result as any, expires_at: expiresAt },
    create: { id: cacheId, provider: 'igdb', data: result as any, expires_at: expiresAt }
  });

  return result;
}
