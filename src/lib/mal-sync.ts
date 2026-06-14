export interface MalSyncMapping {
  malId: number | null;
  tmdbId: number | null;
  episodeStart: number | null;
}

export async function getMapping(anilistId: number): Promise<MalSyncMapping> {
  try {
    const res = await fetch(`https://api.malsync.moe/mal/anime/anilist:${anilistId}`);
    
    if (!res.ok) {
      if (res.status === 404) {
        return { malId: null, tmdbId: null, episodeStart: null };
      }
      throw new Error(`Failed to fetch MAL-Sync mapping for ${anilistId}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    const malId = data.malId ? Number(data.malId) : null;
    
    let tmdbId = null;
    if (data.Sites && data.Sites.TMDB) {
      const firstTmdbKey = Object.keys(data.Sites.TMDB)[0];
      if (firstTmdbKey) {
        tmdbId = Number(data.Sites.TMDB[firstTmdbKey].id || firstTmdbKey);
      }
    }

    let episodeStart: number | null = null;
    if (data.Sites) {
      for (const siteName in data.Sites) {
        for (const key in data.Sites[siteName]) {
          const entry = data.Sites[siteName][key];
          if (entry && typeof entry === 'object') {
            if (entry.episode_start !== undefined && entry.episode_start !== null) {
              episodeStart = Number(entry.episode_start);
            } else if (entry.offset !== undefined && entry.offset !== null) {
              episodeStart = Number(entry.offset);
            } else if (entry.mal_episode_start !== undefined && entry.mal_episode_start !== null) {
              episodeStart = Number(entry.mal_episode_start);
            }
          }
        }
      }
    }
    
    return { malId, tmdbId, episodeStart };
  } catch (error) {
    console.error(`[MAL-Sync Error] Could not fetch mapping for AniList ${anilistId}:`, error);
    return { malId: null, tmdbId: null, episodeStart: null };
  }
}
