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
