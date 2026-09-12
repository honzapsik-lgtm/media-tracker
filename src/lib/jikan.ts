export interface AnimeThemeGroup {
  seasonName: string;
  seasonNumber?: number;
  order?: number;
  openings: string[];
  endings: string[];
}

export interface AnimeThemes {
  openings: string[];
  endings: string[];
  groups?: AnimeThemeGroup[];
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
      throw new Error(`Failed to fetch themes: ${res.status} ${res.statusText}`);
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

function parseEpisodeRange(str: string | null | undefined): { start: number; end: number } | null {
  if (!str) return null;
  const match = String(str).match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : start;
  return { start, end };
}

function rangesOverlap(r1: { start: number; end: number }, r2: { start: number; end: number }): boolean {
  return Math.max(r1.start, r2.start) <= Math.min(r1.end, r2.end);
}

function formatThemeLabel(t: any): string {
  const slug = t.slug || '';
  const songTitle = t.song?.title || 'Unknown';
  const artist = t.song?.artists?.[0]?.name;
  return `${slug ? slug + ': ' : ''}"${songTitle}"${artist ? ` by ${artist}` : ''}`;
}

function classifyAnimeSeasonGroup(name: string, format?: string): { seasonName: string; seasonNumber?: number; order: number; isMovie?: boolean; isSpecial?: boolean } {
  const lower = name.toLowerCase();
  
  if (lower.includes('chuugakkou') || lower.includes('junior high')) {
    return { seasonName: 'Junior High (Spin-off)', order: 99, isSpecial: true };
  }
  if (format === 'Movie' || lower.includes('movie')) {
    return { seasonName: 'Movies', order: 80, isMovie: true };
  }
  // Check final season & kanketsu FIRST before general special/ova check so AOT specials stay in The Final Season
  if (lower.includes('final season') || lower.includes('kanketsu') || lower.includes('season 4') || lower.includes('4th season')) {
    return { seasonName: 'The Final Season', seasonNumber: 4, order: 4 };
  }
  if (format === 'OVA' || lower.includes('ova') || lower.includes('lost girls')) {
    return { seasonName: 'Specials & OVAs', order: 90, isSpecial: true };
  }
  if (lower.includes('season 3') || lower.includes('3rd season') || lower.includes('yuukaku')) {
    return { seasonName: 'Season 3', seasonNumber: 3, order: 3 };
  }
  if (lower.includes('season 2') || lower.includes('2nd season') || lower.includes('mugen ressha')) {
    return { seasonName: 'Season 2', seasonNumber: 2, order: 2 };
  }
  if (lower.includes('season 5') || lower.includes('5th season') || lower.includes('hashira')) {
    return { seasonName: 'Season 5', seasonNumber: 5, order: 5 };
  }
  if (lower.includes('season 4') || lower.includes('katanakaji')) {
    return { seasonName: 'Season 4', seasonNumber: 4, order: 4 };
  }

  // Check general season/part regex (e.g. "Season 5", "5th Season", "Part 2", etc.)
  const seasonMatch = lower.match(/(?:season|part)\s*(\d+)/i) || lower.match(/(\d+)(?:st|nd|rd|th)\s*season/i);
  if (seasonMatch) {
    const sNum = parseInt(seasonMatch[1], 10);
    return { seasonName: `Season ${sNum}`, seasonNumber: sNum, order: sNum };
  }

  return { seasonName: 'Season 1', seasonNumber: 1, order: 1 };
}

async function fetchFromAnimeThemesMoe(
  title: string, 
  originalTitle?: string | null, 
  isMovie = false,
  seasons?: any[]
): Promise<AnimeThemes | null> {
  const searchQueries = [title.trim()];
  if (originalTitle && originalTitle.trim() !== title.trim()) {
    searchQueries.push(originalTitle.trim());
  }

  for (const q of searchQueries) {
    try {
      const url = `https://api.animethemes.moe/anime?q=${encodeURIComponent(q)}&include=animethemes.song.artists,animethemes.animethemeentries`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MediaTracker/1.0'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const animeList: any[] = data.anime || [];
      if (animeList.length === 0) continue;

      // Handle Movie specifically: return ONLY this single movie's themes with no season groups
      if (isMovie) {
        const movieEntries = animeList.filter((a: any) => a.media_format === 'Movie');
        const bestMovie = movieEntries[0] || animeList.find((a: any) => a.name?.toLowerCase().includes('movie')) || animeList[0];
        if (!bestMovie?.animethemes || bestMovie.animethemes.length === 0) continue;

        const openings: string[] = [];
        const endings: string[] = [];

        for (const t of bestMovie.animethemes) {
          if (t.slug?.includes('-EN')) continue;
          const type = t.type;
          const label = formatThemeLabel(t);

          if (type === 'OP') {
            if (!openings.includes(label)) openings.push(label);
          } else if (type === 'ED') {
            if (!endings.includes(label)) endings.push(label);
          }
        }

        if (openings.length > 0 || endings.length > 0) {
          return { openings, endings }; // No groups array!
        }
        continue;
      }

      // Filter TV entries matching franchise primary token
      const anchor = animeList.find((a: any) => (a.media_format === 'TV' || a.name?.toLowerCase().includes('kanketsu')) && a.animethemes?.length > 0) || animeList[0];
      const anchorNameWords = (anchor?.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length >= 4);
      const primaryToken = anchorNameWords[0]; // e.g. "shingeki", "kimetsu", "jujutsu"

      const matchedEntries = animeList.filter((a: any) => {
        // Exclude non-canon spin-offs
        if (a.media_format === 'OVA') return false;
        const aName = (a.name || '').toLowerCase();
        const aSlug = (a.slug || '').toLowerCase();
        if (aName.includes('chuugakkou')) return false;
        if (primaryToken && (aName.includes(primaryToken) || aSlug.includes(primaryToken))) {
          return true;
        }
        return false;
      });

      const entriesToProcess = matchedEntries.length > 0 ? matchedEntries : [animeList[0]];

      const allOpeningsSet = new Set<string>();
      const allEndingsSet = new Set<string>();

      // Check if entries represent multiple distinct seasons (e.g. AOT, Demon Slayer, Jujutsu Kaisen)
      const seasonalNames = new Set<string>();
      for (const entry of entriesToProcess) {
        const c = classifyAnimeSeasonGroup(entry.name || '', entry.media_format);
        if (!c.isMovie && !c.isSpecial) {
          seasonalNames.add(c.seasonName);
        }
      }
      const isSeasonalAnime = seasonalNames.size > 1;

      let groups: AnimeThemeGroup[] = [];

      if (isSeasonalAnime) {
        // CASE 1: SEASONAL ANIME (e.g. Attack on Titan, Demon Slayer, Jujutsu Kaisen)
        // Group by season names: "Season 1", "Season 2", "Season 3", "The Final Season", "Movies"
        const groupMap = new Map<string, { seasonName: string; seasonNumber?: number; order: number; openings: string[]; endings: string[] }>();

        for (const entry of entriesToProcess) {
          if (!entry.animethemes || entry.animethemes.length === 0) continue;

          const classification = classifyAnimeSeasonGroup(entry.name || '', entry.media_format);
          if (classification.isSpecial) continue;

          const groupKey = classification.seasonName;

          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              seasonName: classification.seasonName,
              seasonNumber: classification.seasonNumber,
              order: classification.order,
              openings: [],
              endings: []
            });
          }

          const group = groupMap.get(groupKey)!;

          for (const t of entry.animethemes) {
            if (t.slug?.includes('-EN')) continue;
            const type = t.type;
            const label = formatThemeLabel(t);

            if (type === 'OP') {
              if (!group.openings.includes(label)) group.openings.push(label);
              allOpeningsSet.add(label);
            } else if (type === 'ED') {
              if (!group.endings.includes(label)) group.endings.push(label);
              allEndingsSet.add(label);
            }
          }
        }

        groups = Array.from(groupMap.values())
          .filter(g => g.openings.length > 0 || g.endings.length > 0)
          .sort((a, b) => a.order - b.order)
          .map(g => ({
            seasonName: g.seasonName,
            seasonNumber: g.seasonNumber,
            openings: g.openings,
            endings: g.endings
          }));
      } else {
        // CASE 2: CONTINUOUS ANIME (e.g. One Piece, Bleach, Naruto)
        // Group using the exact episode ranges provided from the API on each OP
        const mainEntry = entriesToProcess.find((e: any) => e.media_format === 'TV' && e.animethemes?.length > 0) || entriesToProcess[0];

        const ops = (mainEntry.animethemes || []).filter((t: any) => t.type === 'OP' && !t.slug?.includes('-EN'));
        const eds = (mainEntry.animethemes || []).filter((t: any) => t.type === 'ED' && !t.slug?.includes('-EN'));

        for (const t of (mainEntry.animethemes || [])) {
          if (t.slug?.includes('-EN')) continue;
          const label = formatThemeLabel(t);
          if (t.type === 'OP') allOpeningsSet.add(label);
          if (t.type === 'ED') allEndingsSet.add(label);
        }

        for (const op of ops) {
          const rawEps = op.animethemeentries?.[0]?.episodes || '';
          if (!rawEps) continue;
          const opRange = parseEpisodeRange(rawEps);
          if (!opRange) continue;

          const gOps = [formatThemeLabel(op)];
          const gEds: string[] = [];

          for (const ed of eds) {
            const edRanges = (ed.animethemeentries || []).map((e: any) => parseEpisodeRange(e.episodes)).filter(Boolean);
            if (edRanges.some((er: any) => rangesOverlap(er, opRange))) {
              const edLabel = formatThemeLabel(ed);
              if (!gEds.includes(edLabel)) gEds.push(edLabel);
            }
          }

          const cleanLabel = rawEps.includes(',') ? `${opRange.start}-${opRange.end}` : rawEps;
          groups.push({
            seasonName: cleanLabel,
            order: opRange.start,
            openings: gOps,
            endings: gEds
          });
        }
      }

      const allOpenings = Array.from(allOpeningsSet);
      const allEndings = Array.from(allEndingsSet);

      if (allOpenings.length > 0 || allEndings.length > 0) {
        return {
          openings: allOpenings,
          endings: allEndings,
          groups
        };
      }
    } catch {
      // Continue to next query / provider
    }
  }

  return null;
}


/**
 * Searches for anime themes by title with AnimeThemes.moe as primary and Jikan as fallback.
 * If mediaType === 'movie', fetches strictly for the movie and excludes TV season groups.
 */
export async function fetchAnimeThemesForMedia(
  title: string, 
  originalTitle?: string | null,
  mediaType?: string | null,
  seasons?: any[]
): Promise<AnimeThemes | null> {
  const query = (title || originalTitle || "").trim();
  if (!query) return null;

  const isMovie = mediaType === 'movie' || mediaType === 'feature';
  const queryClean = query.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const cacheKey = isMovie ? `anime-themes-movie-${queryClean}` : `anime-themes-v5-${queryClean}`;

  try {
    const { prisma } = await import("@/lib/prisma");
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
    if (cached && cached.expires_at > new Date() && cached.data) {
      const parsed = cached.data as any;
      if (isMovie) {
        if (parsed.openings?.length > 0 || parsed.endings?.length > 0) {
          return parsed as any;
        }
      } else {
        if (Array.isArray(parsed?.groups) && parsed.groups.length > 0) {
          return parsed as any;
        }
      }
    }
  } catch (e) {
    // Ignore cache read error
  }

  // 1. Primary: AnimeThemes.moe API (fast, reliable, full credits)
  try {
    const atThemes = await fetchFromAnimeThemesMoe(title, originalTitle, isMovie, seasons);
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

    const typeFilter = isMovie ? '&type=movie' : '';
    for (const q of searchQueries) {
      const res = await fetch(`${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(q)}${typeFilter}&limit=1`, {
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

/**
 * Fetches anime themes tailored to a specific season/cour.
 */
export async function fetchAnimeThemesForSeason(
  showTitle: string,
  seasonNumber: number,
  seasonLabel?: string,
  originalTitle?: string | null,
  seasons?: any[]
): Promise<AnimeThemes | null> {
  const franchiseThemes = await fetchAnimeThemesForMedia(showTitle, originalTitle, 'tv', seasons);
  if (!franchiseThemes) return null;

  if (franchiseThemes.groups && franchiseThemes.groups.length > 0) {
    // 1. Direct season number match
    let match = franchiseThemes.groups.find(g => g.seasonNumber === seasonNumber);

    // 2. If seasonNumber === 0, match specials/OVAs group
    if (seasonNumber === 0) {
      match = franchiseThemes.groups.find(g => 
        g.seasonName.toLowerCase().includes('special') || 
        g.seasonName.toLowerCase().includes('ova')
      );
    }

    // 3. Label matching if not found (e.g. "The Final Season")
    if (!match && seasonLabel) {
      const lowerLabel = seasonLabel.toLowerCase();
      match = franchiseThemes.groups.find(g => {
        const lowerGroup = g.seasonName.toLowerCase();
        return lowerGroup.includes(lowerLabel) || lowerLabel.includes(lowerGroup);
      });
    }

    if (match && (match.openings.length > 0 || match.endings.length > 0)) {
      return {
        openings: match.openings,
        endings: match.endings,
        groups: [match]
      };
    }
  }

  return franchiseThemes;
}


