/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';

const BASE_URL = 'https://api.jikan.moe/v4';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchJikanWithRateLimit(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    await delay(400);
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      return data.data;
    }
    if (res.status === 429 || res.status >= 500) {
      console.warn(`Jikan API rate limit/error (${res.status}), backing off...`);
      await delay(2000 * (i + 1));
      continue;
    }
    throw new Error(`Jikan API error: ${res.status}`);
  }
  throw new Error(`Jikan API error after ${retries} retries`);
}

export async function syncJikanFranchise(startId: string) {
  const visited = new Set<string>();
  const queued = new Set<string>([startId]);
  const nodes = new Map<string, any>();
  const queue = [startId];

  // 1. Traverse Graph
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    try {
      const data = await fetchJikanWithRateLimit(`${BASE_URL}/anime/${currentId}/full`);
      
      // Strict Relation Ignoring
      if (currentId !== startId) {
        if (!["TV", "Movie", "OVA", "ONA", "Special"].includes(data.type)) {
          continue;
        }
        if (["OVA", "ONA", "Special"].includes(data.type)) {
          const date = data.aired?.from ? new Date(data.aired.from).getFullYear() : 0;
          if (date > 0 && date < 2000) continue; // Ignore obscure pre-2000 OVAs
        }
      }
      
      nodes.set(currentId, data);

      if (data.relations) {
        for (const relation of data.relations) {
          // Ignore relations like "Adaptation" or "Character" (e.g. Manga)
          if (!["Sequel", "Prequel", "Parent Story", "Side Story", "Alternative Setting", "Alternative Version", "Spin-off"].includes(relation.relation)) continue;
          
          for (const entry of relation.entry) {
            if (entry.type === "anime" && !visited.has(entry.mal_id.toString()) && !queued.has(entry.mal_id.toString())) {
              queued.add(entry.mal_id.toString());
              queue.push(entry.mal_id.toString());
            }
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch jikan relations for ${currentId}`, err);
    }
  }

  // 2. Find True Root
  const allNodes = Array.from(nodes.values());
  if (allNodes.length === 0) return;

  // Prioritize TV or Movie over OVAs and Specials
  const validNodes = allNodes.filter(n => n.type === 'TV' || n.type === 'Movie');
  const candidates = validNodes.length > 0 ? validNodes : allNodes;
  
  candidates.sort((a, b) => {
    const aDate = a.aired?.from ? new Date(a.aired.from).getTime() : Infinity;
    const bDate = b.aired?.from ? new Date(b.aired.from).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    // Fallback to popularity
    return (a.popularity || 99999) - (b.popularity || 99999);
  });

  const rootNode = candidates[0];
  const rootCacheId = `jikan-${rootNode.type === 'Movie' ? 'movie' : 'tv'}-${rootNode.mal_id}`;

  const timeline = allNodes.map((item) => {
    const isMovieType = item.type === "Movie" || item.type === "Music" || (item.type === "TV Special" && item.episodes === 1);
    const isRoot = item.mal_id === rootNode.mal_id;
    
    let prefix = "jikan-tv-";
    if (isMovieType) {
      prefix = "jikan-movie-";
    } else if (item.type === "TV" && !isRoot) {
      // ONLY non-root TV series become seasons. OVAs, ONAs, Specials remain jikan-tv-.
      prefix = "jikan-season-";
    }

    const uiType = item.type === "TV" ? (isRoot ? "show" : "season") : (item.type === "Movie" ? "movie" : item.type);

    return {
      id: `${prefix}${item.mal_id}`,
      title: item.title_english || item.title,
      type: uiType,
      releaseDate: item.aired?.from ? item.aired.from.split('T')[0] : 'N/A',
      format: item.type
    };
  }).sort((a, b) => {
    if (a.releaseDate === 'N/A') return 1;
    if (b.releaseDate === 'N/A') return -1;
    return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
  });

  // 4. Update Cache for all existing nodes in the timeline
  const allCacheIds = timeline.map(t => t.id);

  const existingCaches = await prisma.apiCache.findMany({
    where: { id: { in: allCacheIds } }
  });

  for (const cache of existingCaches) {
    const payload = cache.data as any;
    payload.franchise = timeline;
    await prisma.apiCache.update({
      where: { id: cache.id },
      data: { data: payload }
    });
  }
}
