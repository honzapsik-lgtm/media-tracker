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
    const res = await fetch(`https://api.mangadex.org/manga?title=${encodedTitle}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].id;
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
