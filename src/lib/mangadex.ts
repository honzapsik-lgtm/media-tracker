import { MediaItem } from "@/types";
import { prisma } from "@/lib/prisma";

/**
 * Extracts MangaDex ID from an AniList node's externalLinks, or falls back to text search.
 */
export async function getMangaDexId(node: any): Promise<string | null> {
  const isManga = ['MANGA', 'NOVEL', 'ONE_SHOT'].includes(node.format);
  if (!isManga) return null;

  // Primary Strategy: Extract from externalLinks
  const links = node.externalLinks || [];
  const mdLink = links.find((l: any) => l.site === 'MangaDex');
  
  if (mdLink && mdLink.url) {
    const match = mdLink.url.match(/mangadex\.org\/title\/([a-f0-9\-]+)/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Fallback Strategy: Text search
  const title = node.title?.english || node.title?.romaji;
  if (!title) return null;

  try {
    const encodedTitle = encodeURIComponent(title);
    const res = await fetch(`https://api.mangadex.org/manga?title=${encodedTitle}&limit=10`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const searchTitles = [node.title?.english, node.title?.romaji]
        .filter(Boolean)
        .map((t: string) => t.toLowerCase().trim());

      let bestMangaId = null;
      let highestScore = -999;

      for (const manga of data.data) {
        const mainTitles = Object.values(manga.attributes.title || {}).map((t: any) => t.toLowerCase().trim());
        const altTitles = (manga.attributes.altTitles || []).flatMap((alt: any) => Object.values(alt).map((t: any) => t.toLowerCase().trim()));
        const allMangaTitles = [...mainTitles, ...altTitles];

        const hasExactMatch = allMangaTitles.some(t => searchTitles.includes(t));
        const hasPartialMatch = allMangaTitles.some(t => searchTitles.some(st => t.includes(st) || st.includes(t)));
        let score = hasExactMatch ? 100 : hasPartialMatch ? 50 : 0;

        const tags = (manga.attributes.tags || []).map((tag: any) => tag.attributes.name.en.toLowerCase());
        if (tags.includes("official colored") || tags.includes("colored")) {
          score -= 50;
        }
        if (tags.includes("doujinshi")) {
          score -= 80;
        }
        if (tags.includes("fan colored")) {
          score -= 70;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMangaId = manga.id;
        }
      }

      if (highestScore >= 40) {
        return bestMangaId;
      }
      return null;
    }
  } catch (error) {
    console.error(`[MangaDex Fallback Error] for title "${title}":`, error);
  }

  return null;
}

/**
 * Pings MangaDex API to extract the high-resolution cover URL.
 */
export async function getMangaDexCoverUrl(mangadexId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mangadex.org/manga/${mangadexId}?includes[]=cover_art`);
    if (!res.ok) return null;
    const data = await res.json();
    
    const manga = data.data;
    if (!manga || !manga.relationships) return null;

    const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
      const fileName = coverRel.attributes.fileName;
      return `https://uploads.mangadex.org/covers/${mangadexId}/${fileName}`;
    }
  } catch (error) {
    console.error(`[MangaDex Cover Error] for id "${mangadexId}":`, error);
  }
  return null;
}

/**
 * Searches MangaDex API for manga by title and maps them to MediaItem format.
 */
export async function searchMangaDex(query: string): Promise<MediaItem[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const cacheKey = `mangadex-search-${encodeURIComponent(normalizedQuery.toLowerCase())}`;
  try {
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
    if (cached && cached.data && cached.expires_at > new Date()) {
      return cached.data as unknown as MediaItem[];
    }
  } catch (e) {
    // Ignore cache read errors
  }

  try {
    const encodedTitle = encodeURIComponent(normalizedQuery);
    const res = await fetch(
      `https://api.mangadex.org/manga?title=${encodedTitle}&limit=15&includes[]=cover_art&includes[]=author&order[relevance]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    const results: MediaItem[] = [];
    for (const manga of data.data) {
      const titles = manga.attributes?.title || {};
      const title = titles.en || titles['ja-ro'] || Object.values(titles)[0] || "Unknown Title";

      // Exclude doujinshis unless query explicitly requests doujin
      const tags = (manga.attributes?.tags || []).map((t: any) => t.attributes?.name?.en?.toLowerCase()).filter(Boolean);
      const isDoujin = tags.includes('doujinshi');
      if (isDoujin && !normalizedQuery.toLowerCase().includes('doujin')) {
        continue;
      }

      // Cover Art
      const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
      const fileName = coverRel?.attributes?.fileName;
      const image = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg` : null;

      const year = manga.attributes?.year;
      const releaseDate = year ? `${year}-01-01` : 'N/A';

      results.push({
        id: `mangadex-${manga.id}`,
        title,
        type: 'manga',
        image,
        releaseDate,
        origin: 'MANGADEX'
      });
    }

    try {
      await prisma.apiCache.upsert({
        where: { id: cacheKey },
        update: { data: results as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24) },
        create: { id: cacheKey, provider: 'mangadex', data: results as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24) }
      });
    } catch (e) {
      // Ignore cache write errors
    }

    return results;
  } catch (error) {
    console.warn(`[MangaDex Search Error] for query "${query}":`, error);
    return [];
  }
}

/**
 * Fetches full manga details from MangaDex.
 */
export async function getMangaDexDetails(mangadexId: string) {
  const cacheKey = `mangadex-details-${mangadexId}`;
  try {
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
    if (cached && cached.data && cached.expires_at > new Date()) {
      return cached.data as any;
    }
  } catch (e) {
    // Ignore cache read errors
  }

  try {
    const res = await fetch(`https://api.mangadex.org/manga/${mangadexId}?includes[]=cover_art&includes[]=author&includes[]=artist`);
    if (!res.ok) return null;
    const json = await res.json();
    const manga = json.data;
    if (!manga) return null;

    const titles = manga.attributes?.title || {};
    const title = titles.en || titles['ja-ro'] || Object.values(titles)[0] || "Unknown Title";
    const descObj = manga.attributes?.description || {};
    const description = descObj.en || Object.values(descObj)[0] || "";

    const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
    const fileName = coverRel?.attributes?.fileName;
    const image = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg` : null;

    const authors = manga.relationships?.filter((r: any) => r.type === 'author' || r.type === 'artist') || [];
    const staff = authors.map((a: any) => ({
      id: a.id,
      name: a.attributes?.name || "Unknown",
      role: a.type === 'author' ? 'Author' : 'Artist',
      image: null
    }));

    const year = manga.attributes?.year;
    const releaseDate = year ? `${year}-01-01` : null;
    const status = manga.attributes?.status || null;
    const lastChapter = manga.attributes?.lastChapter;
    const chapters = lastChapter && !isNaN(parseInt(lastChapter, 10)) ? parseInt(lastChapter, 10) : null;
    const lastVolume = manga.attributes?.lastVolume;
    const volumes = lastVolume && !isNaN(parseInt(lastVolume, 10)) ? parseInt(lastVolume, 10) : null;

    const alId = manga.attributes?.links?.al ? parseInt(manga.attributes.links.al, 10) : null;
    const malId = manga.attributes?.links?.mal ? parseInt(manga.attributes.links.mal, 10) : null;

    const tags = (manga.attributes?.tags || [])
      .map((t: any) => t.attributes?.name?.en)
      .filter(Boolean);

    const result = {
      id: manga.id,
      mangadexId: manga.id,
      anilistId: isNaN(Number(alId)) ? null : alId,
      malId: isNaN(Number(malId)) ? null : malId,
      title,
      description,
      image,
      releaseDate,
      status,
      chapters,
      volumes,
      genres: tags,
      staff
    };

    try {
      await prisma.apiCache.upsert({
        where: { id: cacheKey },
        update: { data: result as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
        create: { id: cacheKey, provider: 'mangadex', data: result as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }
      });
    } catch (e) {
      // Ignore cache write errors
    }

    return result;
  } catch (error) {
    console.warn(`[MangaDex Details Error] for ${mangadexId}:`, error);
    return null;
  }
}

/**
 * Resolves an AniList ID to MangaDex details via MAL-Sync.
 */
export async function getMangaDexByAniListId(anilistId: number) {
  try {
    const res = await fetch(`https://api.malsync.moe/mal/manga/anilist:${anilistId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const mdSites = data.Sites?.Mangadex;
    if (mdSites) {
      const firstMdKey = Object.keys(mdSites)[0];
      const mdEntry = mdSites[firstMdKey];
      const mdId = mdEntry?.identifier || firstMdKey;
      if (mdId) {
        return await getMangaDexDetails(mdId);
      }
    }
  } catch (error) {
    console.warn(`[MAL-Sync MangaDex Error] for anilist ${anilistId}:`, error);
  }
  return null;
}

/**
 * Upserts a manga record into Prisma Media table from MangaDex details.
 */
export async function upsertMangaDexMedia(mdDetails: any) {
  const mangadexId = mdDetails.mangadexId || mdDetails.id;
  const anilistId = mdDetails.anilistId || null;
  const title = mdDetails.title || "Unknown Title";
  const releaseDate = mdDetails.releaseDate || null;
  const staffData = mdDetails.staff || [];

  // Check if media already exists by mangadexId or anilistId
  let existing = await prisma.media.findFirst({
    where: {
      OR: [
        { mangadexId },
        ...(anilistId ? [{ anilistId }] : [])
      ]
    }
  });

  if (existing) {
    if (!existing.mangadexId || (anilistId && !existing.anilistId)) {
      existing = await prisma.media.update({
        where: { id: existing.id },
        data: {
          mangadexId: existing.mangadexId || mangadexId,
          anilistId: existing.anilistId || anilistId
        }
      });
    }
    return existing;
  }

  const created = await prisma.media.create({
    data: {
      mangadexId,
      anilistId,
      title,
      type: "MANGA",
      isMainStoryline: true,
      releaseDate,
      staffData
    }
  });

  return created;
}

