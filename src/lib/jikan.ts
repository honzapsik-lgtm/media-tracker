export interface AnimeThemes {
  openings: string[];
  endings: string[];
}

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const MAX_RETRIES = 3;
const DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches anime themes from Jikan API.
 * Includes a strict delay/retry wrapper to respect Jikan's 3 req/sec rate limit.
 */
export async function getAnimeThemes(malId: number, retryCount = 0): Promise<AnimeThemes | null> {
  try {
    const res = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/themes`);
    
    // 429 Too Many Requests -> Retry with delay
    if (res.status === 429) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`[Jikan] Rate limited (429) for MAL ID ${malId}. Retrying in ${DELAY_MS}ms...`);
        await sleep(DELAY_MS * (retryCount + 1));
        return getAnimeThemes(malId, retryCount + 1);
      }
      throw new Error(`Rate limit exceeded for Jikan API after ${MAX_RETRIES} retries.`);
    }

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`[Jikan] 404 Not Found for MAL ID ${malId}.`);
        return null;
      }
      throw new Error(`Jikan API Error for MAL ID ${malId}: ${res.statusText}`);
    }

    const json = await res.json();
    const data = json.data;

    if (!data) return { openings: [], endings: [] };

    return {
      openings: data.openings || [],
      endings: data.endings || []
    };
  } catch (error) {
    console.error(`[Jikan Error] Failed to fetch themes for MAL ID ${malId}:`, error);
    return null;
  }
}

async function fetchFromAnimeThemesMoe(title: string, originalTitle?: string | null): Promise<AnimeThemes | null> {
  const searchQueries = [title.trim()];
  if (originalTitle && originalTitle.trim() !== title.trim()) {
    searchQueries.push(originalTitle.trim());
  }

  for (const q of searchQueries) {
    try {
      const url = `https://api.animethemes.moe/anime?q=${encodeURIComponent(q)}&include=animethemes.song.artists`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MediaTracker/1.0'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const animeList: any[] = data.anime || [];
      if (animeList.length === 0) continue;

      const normalizedQ = q.toLowerCase();
      let bestMatch = animeList.find((a: any) => 
        a.name.toLowerCase() === normalizedQ ||
        a.slug?.toLowerCase() === normalizedQ.replace(/[^a-z0-9]/g, '_')
      );

      if (!bestMatch) {
        bestMatch = animeList.find((a: any) => a.media_format === 'TV' && a.animethemes?.length > 0) || animeList[0];
      }

      if (!bestMatch?.animethemes || bestMatch.animethemes.length === 0) continue;

      const openings: string[] = [];
      const endings: string[] = [];

      for (const t of bestMatch.animethemes) {
        const type = t.type;
        const slug = t.slug || '';
        const songTitle = t.song?.title || 'Unknown';
        const artist = t.song?.artists?.[0]?.name;
        const label = `${slug ? slug + ': ' : ''}"${songTitle}"${artist ? ` by ${artist}` : ''}`;

        if (type === 'OP') {
          openings.push(label);
        } else if (type === 'ED') {
          endings.push(label);
        }
      }

      if (openings.length > 0 || endings.length > 0) {
        return { openings, endings };
      }
    } catch {
      // Continue to next query / provider
    }
  }

  return null;
}

/**
 * Searches for anime themes by title with AnimeThemes.moe as primary and Jikan as fallback.
 */
export async function fetchAnimeThemesForMedia(title: string, originalTitle?: string | null): Promise<AnimeThemes | null> {
  const query = (title || originalTitle || "").trim();
  if (!query) return null;

  const cacheKey = `anime-themes-${query.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  try {
    const { prisma } = await import("@/lib/prisma");
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
    if (cached && cached.expires_at > new Date() && cached.data) {
      return cached.data as any;
    }
  } catch (e) {
    // Ignore cache read error
  }

  // 1. Primary: AnimeThemes.moe API (fast, reliable, full credits)
  try {
    const atThemes = await fetchFromAnimeThemesMoe(title, originalTitle);
    if (atThemes && (atThemes.openings.length > 0 || atThemes.endings.length > 0)) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
        await prisma.apiCache.upsert({
          where: { id: cacheKey },
          update: { data: atThemes as any, expires_at: expiresAt },
          create: { id: cacheKey, provider: 'animethemes', data: atThemes as any, expires_at: expiresAt }
        });
      } catch (e) {
        // Ignore cache write error
      }
      return atThemes;
    }
  } catch (err) {
    console.warn('[AnimeThemes.moe] Error fetching themes:', err);
  }

  // 2. Fallback: Jikan (MyAnimeList) API
  try {
    const searchQueries = [query];
    if (originalTitle && originalTitle !== query) {
      searchQueries.push(originalTitle.trim());
    }

    for (const q of searchQueries) {
      const res = await fetch(`${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(q)}&limit=1`, {
        signal: AbortSignal.timeout(3500)
      });

      if (!res.ok) continue;

      const json = await res.json();
      const item = json.data?.[0];
      if (!item) continue;

      let themes: AnimeThemes | null = null;
      if (item.theme && (item.theme.openings?.length > 0 || item.theme.endings?.length > 0)) {
        themes = {
          openings: item.theme.openings || [],
          endings: item.theme.endings || []
        };
      } else if (item.mal_id) {
        themes = await getAnimeThemes(item.mal_id);
      }

      if (themes && (themes.openings.length > 0 || themes.endings.length > 0)) {
        try {
          const { prisma } = await import("@/lib/prisma");
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
          await prisma.apiCache.upsert({
            where: { id: cacheKey },
            update: { data: themes as any, expires_at: expiresAt },
            create: { id: cacheKey, provider: 'jikan', data: themes as any, expires_at: expiresAt }
          });
        } catch (e) {
          // Ignore cache write error
        }
        return themes;
      }
    }

    return null;
  } catch (error) {
    console.warn(`[Jikan] Could not fetch themes for query "${query}":`, error);
    return null;
  }
}

