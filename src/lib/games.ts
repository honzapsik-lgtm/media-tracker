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

  const bodyQuery = `fields name, cover.image_id, summary, first_release_date, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, game_engines.name, platforms.name, websites.url, videos.video_id; where id = ${numericId};`;

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

  let trailerUrl = null;
  if (game.videos && game.videos.length > 0) {
    const trailerVideo = game.videos.find((v: any) => v.name?.toLowerCase().includes('trailer')) || game.videos[0];
    if (trailerVideo && trailerVideo.video_id) {
      trailerUrl = `https://www.youtube.com/embed/${trailerVideo.video_id}`;
    }
  }

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
    trailerUrl,
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

export async function getRAWGGameDetails(id: number) {
  const cacheId = `rawg-game-${id}`;
  const cached = await prisma.apiCache.findUnique({ where: { id: cacheId } });
  if (cached && cached.data && JSON.stringify(cached.data) !== 'null' && cached.expires_at > new Date()) {
    return cached.data as any;
  }

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) throw new Error("Missing RAWG credentials");

  const res = await timeProviderFetch({
    provider: "rawg",
    cacheId,
    operation: "rawg.details",
    fetcher: () => fetch(`https://api.rawg.io/api/games/${id}?key=${apiKey}`, { next: { revalidate: 3600 } }),
  });

  if (!res.ok) {
    console.error("RAWG Fetch details failed. Status:", res.status);
    return null;
  }
  const game = await res.json();
  if (!game) return null;

  const companies: GameCompany[] = [];
  if (game.developers) {
    game.developers.forEach((d: any) => {
      companies.push({
        id: `rawg-dev-${d.id}`,
        name: d.name,
        isDeveloper: true,
        isPublisher: false
      });
    });
  }
  if (game.publishers) {
    game.publishers.forEach((p: any) => {
      companies.push({
        id: `rawg-pub-${p.id}`,
        name: p.name,
        isDeveloper: false,
        isPublisher: true
      });
    });
  }

  const playLinks: { site: string; url: string; color: string }[] = [];
  if (game.stores) {
    const storeColors: Record<string, string> = {
      "steam": "#66c0f4",
      "playstation-store": "#003087",
      "xbox-store": "#107c10",
      "gog": "#bf00ff",
      "nintendo": "#e60012",
      "epic-games": "#ffffff",
      "app-store": "#007aff",
      "google-play": "#00c6ff",
    };
    game.stores.forEach((s: any) => {
      if (s.store) {
        const slug = s.store.slug;
        const color = storeColors[slug] || "#ffffff";
        playLinks.push({
          site: s.store.name,
          url: s.url || `https://${s.store.domain || 'rawg.io'}`,
          color
        });
      }
    });
  }

  const genres = game.genres ? game.genres.map((g: any) => g.name) : [];

  const result = {
    id: cacheId,
    title: game.name,
    type: 'game',
    image: game.background_image || null,
    backdrop: game.background_image_additional || game.background_image || null,
    description: game.description_raw || game.description || null,
    releaseDate: game.released || 'N/A',
    globalScore: game.metacritic || 0,
    runtime: game.playtime || null,
    genres,
    trailerUrl: game.clip?.clip || null,
    cast: [],
    seasons: null,
    credits: [],
    companies,
    characters: [],
    engines: [],
    playLinks
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

export async function resolveRAWGToIGDB(rawgId: number): Promise<number | null> {
  const cacheKey = `rawg-to-igdb-${rawgId}`;
  const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
  if (cached && cached.data) {
    const val = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
    if (val && typeof val.igdbId === 'number') {
      return val.igdbId;
    }
  }

  // 1. Fetch RAWG game to get the title
  const rawgGame = await getRAWGGameDetails(rawgId);
  if (!rawgGame || !rawgGame.title) return null;

  // 2. Search IGDB by name
  const igdbGames = await searchGames(rawgGame.title);
  if (igdbGames && igdbGames.length > 0) {
    const match = igdbGames.find(g => g.title.toLowerCase() === rawgGame.title.toLowerCase()) || igdbGames[0];
    const igdbId = parseInt(match.id.replace('igdb-game-', ''), 10);
    
    // Cache the mapping
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.apiCache.upsert({
      where: { id: cacheKey },
      update: { data: { igdbId } as any, expires_at: expiresAt },
      create: { id: cacheKey, provider: 'rawg', data: { igdbId } as any, expires_at: expiresAt }
    });
    
    return igdbId;
  }

  return null;
}

