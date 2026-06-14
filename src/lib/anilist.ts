import { MediaItem } from "@/types";
import { prisma } from "@/lib/prisma";
import { getMangaDexId, getMangaDexCoverUrl } from "./mangadex";

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (i + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    return res;
  }
  return fetch(url, options);
}

export async function getAnilistDetails(anilistId: number) {
  const cacheKey = `anilist-${anilistId}`;
  
  try {
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
    if (cached && cached.expires_at > new Date()) {
      return cached.data;
    }
  } catch (e) {
    console.error("Failed to read ApiCache", e);
  }

  const response = await fetchWithRetry("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: `
          query ($id: Int, $page: Int) {
            Media(id: $id) {
              id
              idMal
              title {
                romaji
                english
              }
              description
              format
              episodes
              nextAiringEpisode {
                episode
              }
              duration
              streamingEpisodes {
                title
                thumbnail
              }
              coverImage {
                extraLarge
                large
              }
              bannerImage
              trailer {
                id
                site
                thumbnail
              }
              externalLinks {
                site
                url
                icon
                color
                type
                language
              }
              startDate {
                year
                month
                day
              }
              averageScore
              staff(page: $page, perPage: 25, sort: [RELEVANCE, ID]) {
                pageInfo {
                  hasNextPage
                }
                edges {
                  role
                  node {
                    id
                    name {
                      full
                    }
                    image {
                      large
                    }
                  }
                }
              }
              relations {
                edges {
                  relationType
                  node {
                    id
                    title {
                      romaji
                      english
                    }
                    episodes
                    coverImage {
                      extraLarge
                      large
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { id: anilistId, page: 1 }
      })
    });

    if (!response.ok) return null;
    const json = await response.json();
    const mediaData = json.data?.Media || null;
    
    if (mediaData) {
      try {
        await prisma.apiCache.upsert({
          where: { id: cacheKey },
          update: { data: mediaData as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
          create: { id: cacheKey, provider: 'anilist', data: mediaData as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }
        });
      } catch (e) {
        console.error("Failed to write ApiCache", e);
      }
    }
    
    return mediaData;
}

export async function fetchAnilistNodeEdges(anilistId: number) {
  let page = 1;
  let hasNextPage = true;
  let mediaNode: any = null;
  
  const cacheKey = `anilist-edges-${anilistId}`;
  
  try {
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheKey } });
    if (cached && cached.expires_at > new Date()) {
      return cached.data;
    }
  } catch (e) {
    console.error("Failed to read ApiCache", e);
  }

  let maxPages = 4;

  while (hasNextPage && page <= maxPages) {
    const response = await fetchWithRetry("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: `
          query ($id: Int, $page: Int) {
            Media(id: $id) {
              id
              idMal
              title { romaji english }
              format
              episodes
              duration
              trailer {
                id
                site
                thumbnail
              }
              externalLinks {
                site
                url
                icon
                color
                type
                language
              }
              studios {
                edges {
                  isMain
                  node {
                    id
                    name
                  }
                }
              }
              staff(page: $page, perPage: 25, sort: [RELEVANCE, ID]) {
                pageInfo {
                  hasNextPage
                }
                edges {
                  role
                  node {
                    id
                    name { full }
                    image { large }
                  }
                }
              }
              characters(page: $page, perPage: 25, sort: [ROLE, RELEVANCE]) {
                pageInfo {
                  hasNextPage
                }
                edges {
                  role
                  node {
                    id
                    name { full }
                    image { large }
                  }
                  voiceActors {
                    id
                    languageV2
                    name { full }
                    image { large }
                  }
                }
              }
              relations {
                edges {
                  relationType
                  node {
                    id
                    format
                    episodes
                    duration
                    trailer {
                      id
                      site
                      thumbnail
                    }
                    externalLinks {
                      site
                      url
                      icon
                      color
                      type
                      language
                    }
                    startDate { year month day }
                    title { romaji english }
                  }
                }
              }
            }
          }
        `,
        variables: { id: anilistId, page }
      })
    });

    if (!response.ok) break;
    const json = await response.json();
    const data = json.data?.Media;

    if (!data) break;

    if (!mediaNode) {
      mediaNode = data;
      if (mediaNode.episodes && mediaNode.episodes > 100) {
        maxPages = 10;
      }
    } else {
      if (data.staff?.edges) {
        mediaNode.staff.edges = mediaNode.staff.edges.concat(data.staff.edges);
      }
      if (data.characters?.edges) {
        mediaNode.characters.edges = mediaNode.characters.edges.concat(data.characters.edges);
      }
    }

    hasNextPage = data.staff?.pageInfo?.hasNextPage || data.characters?.pageInfo?.hasNextPage;
    page++;
  }

  if (mediaNode) {
    // MangaDex Augmentation
    if (['MANGA', 'NOVEL', 'ONE_SHOT'].includes(mediaNode.format)) {
      const mdId = await getMangaDexId(mediaNode);
      if (mdId) {
        mediaNode.mangadexId = mdId;
        const mdCover = await getMangaDexCoverUrl(mdId);
        if (mdCover) {
          mediaNode.coverImage = mediaNode.coverImage || {};
          mediaNode.coverImage.extraLarge = mdCover;
          mediaNode.coverImage.large = mdCover;
        }
      }
    }

    try {
      await prisma.apiCache.upsert({
        where: { id: cacheKey },
        update: { data: mediaNode as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
        create: { id: cacheKey, provider: 'anilist', data: mediaNode as any, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }
      });
    } catch (e) {
      console.error("Failed to write ApiCache", e);
    }
  }

  return mediaNode;
}

export async function fetchAnilistNodes(anilistIds: number[]) {
  if (anilistIds.length === 0) return [];
  const response = await fetchWithRetry("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      query: `
        query ($ids: [Int]) {
          Page(page: 1, perPage: 50) {
            media(id_in: $ids) {
              id
              idMal
              title { romaji english }
              episodes
              format
              startDate { year month day }
              nextAiringEpisode { episode }
            }
          }
        }
      `,
      variables: { ids: anilistIds }
    })
  });
  if (!response.ok) return [];
  const json = await response.json();
  return json.data?.Page?.media || [];
}

export function resolveAniListType(format: string, episodes: number | null, duration: number | null): string {
  const isSerialized = ['TV', 'TV_SHORT'].includes(format) || (['ONA', 'OVA'].includes(format) && (episodes ?? 0) > 1);
  if (isSerialized) return 'SERIALIZED';

  const isFeature = format === 'MOVIE' || (['ONA', 'OVA', 'SPECIAL'].includes(format) && (episodes === 1) && (duration ?? 0) >= 45);
  if (isFeature) return 'FEATURE';

  const isManga = ['MANGA', 'NOVEL', 'ONE_SHOT'].includes(format);
  if (isManga) return 'MANGA';

  return 'STANDALONE';
}

export async function searchAniList(query: string): Promise<MediaItem[]> {
  const response = await fetchWithRetry("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      query: `
        query ($search: String) {
          Page(page: 1, perPage: 15) {
            media(search: $search, sort: POPULARITY_DESC) {
              id
              title {
                romaji
                english
              }
              format
              episodes
              duration
              coverImage {
                large
              }
              startDate {
                year
                month
                day
              }
              relations {
                edges {
                  relationType
                  node {
                    format
                    episodes
                    duration
                  }
                }
              }
            }
          }
        }
      `,
      variables: { search: query }
    }),
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error("AniList API Error in searchAniList:", response.status, response.statusText, text);
    return [];
  }

  const json = await response.json();
  const mediaList = json.data?.Page?.media || [];

  const results: MediaItem[] = [];

  for (const item of mediaList) {
    const structuralType = resolveAniListType(item.format || '', item.episodes, item.duration);
    
    // Deduplication check
    const edges = item.relations?.edges || [];
    const hasSerializedParentOrPrequel = edges.some((edge: any) => {
      if (edge.relationType === 'PREQUEL' || edge.relationType === 'PARENT') {
        // TV shows should NEVER be hidden by a PARENT relation, only by PREQUEL (previous seasons).
        // This prevents Steins;Gate (TV) from being hidden by Chaos;Head (TV).
        if (edge.relationType === 'PARENT' && ['TV', 'TV_SHORT'].includes(item.format || '')) {
          return false;
        }

        // Usurper Protection: If current node is TV, only yield to TV
        if (['TV', 'TV_SHORT'].includes(item.format || '')) {
          if (!['TV', 'TV_SHORT'].includes(edge.node?.format || '')) {
            return false;
          }
        }

        const parentType = resolveAniListType(edge.node?.format || '', edge.node?.episodes, edge.node?.duration);
        return parentType === 'SERIALIZED';
      }
      return false;
    });
    
    if (hasSerializedParentOrPrequel && structuralType !== 'FEATURE') {
      continue;
    }

    const title = item.title.english || item.title.romaji || "Unknown Title";
    const releaseDate = item.startDate?.year ? `${item.startDate.year}-${String(item.startDate.month || 1).padStart(2, '0')}-${String(item.startDate.day || 1).padStart(2, '0')}` : 'N/A';
    
    let type = 'other';
    if (structuralType === 'SERIALIZED') type = 'show';
    else if (structuralType === 'FEATURE') type = 'movie';
    else if (structuralType === 'MANGA') type = 'manga';

    results.push({
      id: String(item.id),
      title,
      type,
      image: item.coverImage?.large || null,
      releaseDate,
      origin: 'ANILIST'
    });
  }

  return results;
}

