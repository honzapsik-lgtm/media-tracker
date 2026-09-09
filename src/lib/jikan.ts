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

/**
 * Searches for anime themes by title with strict timeout, caching, and graceful fallback.
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

