/* eslint-disable @typescript-eslint/no-explicit-any */
import { MediaItem, MediaCredit, GameCompany, GameCharacter, GameCrewMember } from '../types';
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
  if (cached && cached.data && JSON.stringify(cached.data) !== 'null' && cached.expires_at > new Date()) {
    return cached.data as any;
  }

  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) throw new Error("Missing IGDB credentials");

  const bodyQuery = `fields name, cover.image_id, summary, first_release_date, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, game_engines.name, platforms.name, websites.url; where id = ${numericId};`;

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

  if (!res.ok) {
    console.error("IGDB Fetch details failed. Status:", res.status, "Text:", res.statusText);
    try {
      console.error("Response body:", await res.text());
    } catch (_) {}
    return null;
  }
  const data = await res.json();
  if (!data || data.length === 0) {
    console.error("IGDB Fetch details succeeded but returned empty array or falsy data:", data);
    return null;
  }
  
  const game = data[0];

  const companies: GameCompany[] = [];
  if (game.involved_companies) {
    game.involved_companies.forEach((ic: any) => {
      if (ic.company && ic.company.name) {
        companies.push({
          id: `igdb-${ic.company.id}`,
          name: ic.company.name,
          isDeveloper: !!ic.developer,
          isPublisher: !!ic.publisher
        });
      }
    });
  }

  const characters: GameCharacter[] = [];
  try {
    const charQuery = `fields name, description, mug_shot.image_id; where games = (${numericId}); limit 50;`;
    const charRes = await fetch("https://api.igdb.com/v4/characters", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`
      },
      body: charQuery
    });
    if (charRes.ok) {
      const charData = await charRes.json();
      if (Array.isArray(charData)) {
        charData.forEach((char: any) => {
          characters.push({
            id: char.id,
            name: char.name,
            description: char.description || null,
            imageUrl: char.mug_shot?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${char.mug_shot.image_id}.jpg` : null
          });
        });
      }
    }
  } catch (charError) {
    console.error("Failed to fetch characters details from IGDB:", charError);
  }

  const engines: string[] = [];
  if (game.game_engines) {
    game.game_engines.forEach((e: any) => {
      if (e.name) {
        engines.push(e.name);
      }
    });
  }

  const storeDomains = [
    { name: "Steam", pattern: /steampowered\.com|steamcommunity\.com/, color: "#66c0f4" },
    { name: "GOG.com", pattern: /gog\.com/, color: "#bf00ff" },
    { name: "Epic Games", pattern: /epicgames\.com/, color: "#ffffff" },
    { name: "PlayStation Store", pattern: /playstation\.com/, color: "#003087" },
    { name: "Xbox Store", pattern: /xbox\.com/, color: "#107c10" },
    { name: "Nintendo eShop", pattern: /nintendo\.com|nintendo\.co/, color: "#e60012" },
    { name: "itch.io", pattern: /itch\.io/, color: "#fa5c5c" },
    { name: "App Store", pattern: /apple\.com\/.*app-store|apps\.apple\.com/, color: "#007aff" },
    { name: "Google Play", pattern: /play\.google\.com/, color: "#00c6ff" }
  ];

  const playLinks: { site: string; url: string; color: string }[] = [];
  if (game.websites) {
    game.websites.forEach((w: any) => {
      const matchedStore = storeDomains.find(store => store.pattern.test(w.url));
      if (matchedStore) {
        if (!playLinks.some(link => link.site === matchedStore.name)) {
          playLinks.push({
            site: matchedStore.name,
            url: w.url,
            color: matchedStore.color
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
    credits: [],
    companies,
    characters,
    engines,
    playLinks
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

export async function getGameCrew(gameName: string, releaseYear?: number): Promise<GameCrewMember[]> {
  const yearSuffix = releaseYear ? `-${releaseYear}` : "";
  const cacheKey = `rawg-crew-${encodeURIComponent(gameName.toLowerCase())}${yearSuffix}`;
  
  const cached = await readApiCache<GameCrewMember[]>(cacheKey);
  if (cached) return cached;

  const RAWG_API_KEY = process.env.RAWG_API_KEY;
  if (!RAWG_API_KEY) {
    console.warn("RAWG_API_KEY is not defined in environment variables.");
    return [];
  }

  try {
    // 1. Search for game
    let searchUrl = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(gameName)}`;
    if (releaseYear) {
      searchUrl += `&dates=${releaseYear}-01-01,${releaseYear}-12-31`;
    }
    
    let res = await fetch(searchUrl);
    if (!res.ok && releaseYear) {
      // Try search without year constraint if first fetch failed
      searchUrl = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(gameName)}`;
      res = await fetch(searchUrl);
    }
    
    if (!res.ok) return [];
    const searchData = await res.json();
    if (!searchData.results || searchData.results.length === 0) return [];
    
    const rawgGameId = searchData.results[0].id;
    
    // 2. Fetch development team
    const teamUrl = `https://api.rawg.io/api/games/${rawgGameId}/development-team?key=${RAWG_API_KEY}`;
    const teamRes = await fetch(teamUrl);
    if (!teamRes.ok) return [];
    
    const teamData = await teamRes.json();
    if (!teamData.results || !Array.isArray(teamData.results)) return [];
    
    const keyRoles = ["director", "writer", "composer", "design"];
    const crew: GameCrewMember[] = [];
    
    teamData.results.forEach((member: any) => {
      const matchedPositions = member.positions?.filter((pos: any) => 
        keyRoles.includes(pos.slug.toLowerCase()) || keyRoles.includes(pos.name.toLowerCase())
      ) || [];
      
      if (matchedPositions.length > 0) {
        const role = matchedPositions.map((pos: any) => pos.name).join(", ");
        crew.push({
          id: `rawg-${member.id}`,
          name: member.name,
          role: role,
          imageUrl: member.image || null
        });
      }
    });
    
    await writeApiCache(cacheKey, 'rawg', crew, 7 * 24 * 60 * 60);
    return crew;
  } catch (error) {
    console.error("Error fetching RAWG crew:", error);
    return [];
  }
}

