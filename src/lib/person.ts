import { UnifiedProfile, UnifiedCredit } from '@/types/person';
import { PersonProfile } from '@/types';
import { prisma } from '@/lib/prisma';
import { timeProviderFetch } from '@/lib/api-cache';
import { getIGDBToken } from '@/lib/games';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export function parsePersonSlug(slug: string): [string, string] | null {
  if (!slug) return null;
  const lower = slug.toLowerCase().trim();

  // MangaDex with prefix: mangadex-00000000-0000-0000-0000-000000000000
  const mdPrefixMatch = lower.match(/^mangadex-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (mdPrefixMatch) {
    return ['mangadex', mdPrefixMatch[1]];
  }

  // Bare UUID (MangaDex)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lower)) {
    return ['mangadex', lower];
  }

  // Provider with numeric ID: tmdb-1234, igdb-5678, rawg-9012, anilist-3456
  const providerMatch = lower.match(/^(tmdb|anilist|igdb|mal|rawg)(?:-[a-z]+)?-(\d+)$/i);
  if (providerMatch) {
    return [providerMatch[1], providerMatch[2]];
  }

  // Bare integer (TMDb)
  if (/^\d+$/.test(lower)) {
    return ['tmdb', lower];
  }

  return null;
}

export async function getUnifiedPersonProfile(slug: string): Promise<UnifiedProfile | null> {
  const parsed = parsePersonSlug(slug);
  if (!parsed) return null;

  const [provider, rawId] = parsed;

  const tmdbId = provider === 'tmdb' ? parseInt(rawId, 10) : null;
  const anilistId = provider === 'anilist' ? parseInt(rawId, 10) : null;
  const igdbId = provider === 'igdb' ? parseInt(rawId, 10) : null;
  const rawgId = provider === 'rawg' ? parseInt(rawId, 10) : null;
  const mangadexId = provider === 'mangadex' ? rawId : null;

  if (!tmdbId && !anilistId && !igdbId && !rawgId && !mangadexId) return null;

  // 1. Check DB first
  const dbPerson = await prisma.person.findFirst({
    where: {
      OR: [
        ...(tmdbId ? [{ tmdbId }] : []),
        ...(anilistId ? [{ anilistId }] : []),
        ...(igdbId ? [{ igdbId }] : []),
        ...(rawgId ? [{ rawgId }] : []),
        ...(mangadexId ? [{ mangadexId }] : []),
      ]
    }
  });

  if (dbPerson && dbPerson.updatedAt) {
    const ageDays = (new Date().getTime() - dbPerson.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7 && dbPerson.mergedCredits) {
      return {
        id: dbPerson.id,
        tmdbId: dbPerson.tmdbId,
        anilistId: dbPerson.anilistId,
        igdbId: dbPerson.igdbId,
        malId: dbPerson.malId,
        rawgId: dbPerson.rawgId,
        mangadexId: dbPerson.mangadexId,
        name: dbPerson.name,
        nativeName: dbPerson.nativeName,
        bio: dbPerson.biography,
        profileImage: dbPerson.profileImage,
        birthDate: dbPerson.birthDate,
        deathDate: dbPerson.deathDate,
        knownForDepartment: dbPerson.knownForDepartment,
        credits: dbPerson.mergedCredits as unknown as { cast: UnifiedCredit[]; crew: UnifiedCredit[] }
      };
    }
  }

  // 2. Fetch fresh data from provider
  let fetchedData: UnifiedProfile | null = null;
  if (tmdbId) {
    fetchedData = await fetchTMDbPerson(tmdbId);
  } else if (mangadexId) {
    fetchedData = await fetchMangaDexPerson(mangadexId);
  } else if (igdbId) {
    fetchedData = await fetchIGDBPerson(igdbId);
  } else if (rawgId) {
    fetchedData = await fetchRAWGPerson(rawgId);
  } else if (anilistId) {
    fetchedData = await fetchAniListPerson(anilistId);
  }

  if (!fetchedData) return null;

  // 3. Upsert into DB
  let updatedDbPerson;
  if (dbPerson) {
    updatedDbPerson = await prisma.person.update({
      where: { id: dbPerson.id },
      data: {
        name: fetchedData.name,
        nativeName: fetchedData.nativeName,
        biography: fetchedData.bio,
        profileImage: fetchedData.profileImage,
        birthDate: fetchedData.birthDate,
        deathDate: fetchedData.deathDate,
        knownForDepartment: fetchedData.knownForDepartment,
        mergedCredits: fetchedData.credits as any,
        rawgId: fetchedData.rawgId ?? dbPerson.rawgId,
        mangadexId: fetchedData.mangadexId ?? dbPerson.mangadexId,
      }
    });
  } else {
    updatedDbPerson = await prisma.person.create({
      data: {
        tmdbId: fetchedData.tmdbId,
        anilistId: fetchedData.anilistId,
        igdbId: fetchedData.igdbId,
        malId: fetchedData.malId,
        rawgId: fetchedData.rawgId,
        mangadexId: fetchedData.mangadexId,
        name: fetchedData.name,
        nativeName: fetchedData.nativeName,
        biography: fetchedData.bio,
        profileImage: fetchedData.profileImage,
        birthDate: fetchedData.birthDate,
        deathDate: fetchedData.deathDate,
        knownForDepartment: fetchedData.knownForDepartment,
        mergedCredits: fetchedData.credits as any,
      }
    });
  }

  fetchedData.id = updatedDbPerson.id;
  return fetchedData;
}

// --- Platform Fetchers ---

export async function fetchTMDbPerson(id: number): Promise<UnifiedProfile | null> {
  if (!TMDB_API_KEY) return null;
  const res = await timeProviderFetch({
    provider: 'tmdb',
    cacheId: `tmdb-person-${id}`,
    operation: 'tmdb.person',
    fetcher: () => fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=combined_credits`, { next: { revalidate: 3600 } })
  });

  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const cast: UnifiedCredit[] = [];
  const crew: UnifiedCredit[] = [];

  const rawCast = data.combined_credits?.cast || [];
  const rawCrew = data.combined_credits?.crew || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawCast.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawCrew.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

  const seenCast = new Set<string>();
  const seenCrew = new Set<string>();

  for (const item of rawCast) {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;

    const mediaId = `tmdb-${item.media_type}-${item.id}`;
    if (seenCast.has(mediaId)) continue;
    seenCast.add(mediaId);

    cast.push({
      mediaId,
      mediaType: item.media_type === 'tv' ? 'SHOW' : 'MOVIE',
      title: item.title || item.name || 'Unknown',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      releaseYear: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).substring(0, 4), 10) : null,
      role: item.character || 'Actor',
      isVoiceRole: item.character ? item.character.toLowerCase().includes('(voice)') : false,
      characterImage: null
    });
  }

  for (const item of rawCrew) {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;

    const mediaId = `tmdb-${item.media_type}-${item.id}`;
    const key = `${mediaId}-${item.job}`;
    if (seenCrew.has(key)) continue;
    seenCrew.add(key);

    crew.push({
      mediaId,
      mediaType: item.media_type === 'tv' ? 'SHOW' : 'MOVIE',
      title: item.title || item.name || 'Unknown',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      releaseYear: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).substring(0, 4), 10) : null,
      role: item.job || 'Crew',
      isVoiceRole: false,
      characterImage: null
    });
  }

  return {
    id: `tmdb-${id}`,
    tmdbId: id,
    anilistId: null,
    igdbId: null,
    malId: null,
    rawgId: null,
    name: data.name,
    nativeName: data.also_known_as && data.also_known_as.length > 0 ? data.also_known_as[0] : null,
    bio: data.biography || null,
    profileImage: data.profile_path ? `https://image.tmdb.org/t/p/w500${data.profile_path}` : null,
    birthDate: data.birthday || null,
    deathDate: data.deathday || null,
    knownForDepartment: data.known_for_department || null,
    credits: {
      cast,
      crew
    }
  };
}

export async function fetchMangaDexPerson(authorId: string): Promise<UnifiedProfile | null> {
  const authorRes = await timeProviderFetch({
    provider: 'mangadex',
    cacheId: `mangadex-author-${authorId}`,
    operation: 'mangadex.author',
    fetcher: () => fetch(`https://api.mangadex.org/author/${authorId}`, { next: { revalidate: 3600 } })
  });

  if (!authorRes.ok) return null;
  const authorDetailsJson = await authorRes.json();
  const authorData = authorDetailsJson.data;
  if (!authorData) return null;

  // Fetch manga authored or drawn by this creator in parallel (MangaDex uses AND if both query params are passed together)
  const [authorMangaRes, artistMangaRes] = await Promise.all([
    timeProviderFetch({
      provider: 'mangadex',
      cacheId: `mangadex-author-manga-${authorId}`,
      operation: 'mangadex.author_manga',
      fetcher: () => fetch(`https://api.mangadex.org/manga?authors[]=${authorId}&includes[]=cover_art&order[relevance]=desc&limit=100`, { next: { revalidate: 3600 } })
    }),
    timeProviderFetch({
      provider: 'mangadex',
      cacheId: `mangadex-artist-manga-${authorId}`,
      operation: 'mangadex.artist_manga',
      fetcher: () => fetch(`https://api.mangadex.org/manga?artists[]=${authorId}&includes[]=cover_art&order[relevance]=desc&limit=100`, { next: { revalidate: 3600 } })
    }),
  ]);

  const crew: UnifiedCredit[] = [];
  const seenMedia = new Set<string>();

  const authorWorksJson = authorMangaRes.ok ? await authorMangaRes.json() : { data: [] };
  const artistWorksJson = artistMangaRes.ok ? await artistMangaRes.json() : { data: [] };
  const mangaList = [...(authorWorksJson.data || []), ...(artistWorksJson.data || [])];

  for (const manga of mangaList) {
    const mediaId = `mangadex-${manga.id}`;
    if (seenMedia.has(mediaId)) continue;
    seenMedia.add(mediaId);

    const titles = manga.attributes?.title || {};
    const title = titles.en || titles['ja-ro'] || Object.values(titles)[0] || 'Unknown Title';

    const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
    const fileName = coverRel?.attributes?.fileName;
    const poster = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg` : null;

    const year = manga.attributes?.year || (manga.attributes?.createdAt ? parseInt(manga.attributes.createdAt.substring(0, 4), 10) : null);

    crew.push({
      mediaId,
      mediaType: 'MANGA',
      title,
      poster,
      releaseYear: year || null,
      role: 'Story & Art',
      isVoiceRole: false,
      characterImage: null
    });
  }

  // Sort crew by releaseYear descending
  crew.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));

  const bioObj = authorData.attributes?.biography;
  let bio: string | null = null;
  if (bioObj) {
    if (typeof bioObj === 'string') {
      bio = bioObj;
    } else if (typeof bioObj === 'object') {
      bio = bioObj.en || (Object.values(bioObj)[0] as string) || null;
    }
  }

  return {
    id: `mangadex-${authorId}`,
    tmdbId: null,
    anilistId: null,
    igdbId: null,
    malId: null,
    rawgId: null,
    mangadexId: authorId,
    name: authorData.attributes?.name || 'Unknown',
    nativeName: null,
    bio,
    profileImage: authorData.attributes?.imageUrl || null,
    birthDate: null,
    deathDate: null,
    knownForDepartment: 'Manga Creation',
    credits: {
      cast: [],
      crew
    }
  };
}

export async function fetchAniListPerson(id: number): Promise<UnifiedProfile | null> {
  const query = `
    query ($id: Int) {
      Staff(id: $id) {
        id
        name {
          full
          native
        }
        image {
          large
        }
        description
        dateOfBirth {
          year
          month
          day
        }
        dateOfDeath {
          year
          month
          day
        }
        primaryOccupations
        characterMedia(page: 1, perPage: 50, sort: [POPULARITY_DESC]) {
          pageInfo {
            hasNextPage
          }
          edges {
            characterRole
            characters {
              name { full }
              image { large }
            }
            node {
              id
              type
              format
              title { english romaji }
              coverImage { large }
              startDate { year }
            }
          }
        }
        staffMedia(page: 1, perPage: 50, sort: [POPULARITY_DESC]) {
          pageInfo {
            hasNextPage
          }
          edges {
            staffRole
            node {
              id
              type
              format
              title { english romaji }
              coverImage { large }
              startDate { year }
            }
          }
        }
      }
    }
  `;

  const res = await timeProviderFetch({
    provider: 'anilist',
    cacheId: `anilist-person-${id}`,
    operation: 'anilist.person',
    fetcher: () => fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { id } }),
      next: { revalidate: 3600 }
    })
  });

  if (!res.ok) return null;
  const json = await res.json();
  const data = json.data?.Staff;
  if (!data) return null;

  const charEdges = [...(data.characterMedia?.edges || [])];
  let hasNextCharPage = data.characterMedia?.pageInfo?.hasNextPage || false;
  let charPage = 2;
  const maxPages = 2;

  while (hasNextCharPage && charPage <= maxPages) {
    const charQuery = `
      query ($id: Int, $page: Int) {
        Staff(id: $id) {
          characterMedia(page: $page, perPage: 50, sort: [POPULARITY_DESC]) {
            pageInfo {
              hasNextPage
            }
            edges {
              characterRole
              characters {
                name { full }
                image { large }
              }
              node {
                id
                type
                format
                title { english romaji }
                coverImage { large }
                startDate { year }
              }
            }
          }
        }
      }
    `;

    let pageRes;
    let retries = 3;
    while (retries > 0) {
      pageRes = await timeProviderFetch({
        provider: 'anilist',
        cacheId: `anilist-person-${id}-charpage-${charPage}`,
        operation: 'anilist.person.charpage',
        fetcher: () => fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ query: charQuery, variables: { id, page: charPage } }),
          next: { revalidate: 3600 }
        })
      });

      if (pageRes.status === 429) {
        const retryAfter = parseInt(pageRes.headers.get('Retry-After') || '5', 10);
        console.warn(`[AniList Sync] Hit rate limit (429) on character page ${charPage}. Retrying after ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries--;
      } else {
        break;
      }
    }

    if (pageRes && pageRes.ok) {
      const pageJson = await pageRes.json();
      if (pageJson.errors) {
        console.error(`[AniList Sync] Character page ${charPage} GraphQL errors:`, JSON.stringify(pageJson.errors, null, 2));
        break;
      }
      const pageEdges = pageJson.data?.Staff?.characterMedia?.edges || [];
      charEdges.push(...pageEdges);
      hasNextCharPage = pageJson.data?.Staff?.characterMedia?.pageInfo?.hasNextPage || false;
    } else {
      const status = pageRes ? pageRes.status : 'unknown';
      const statusText = pageRes ? pageRes.statusText : '';
      console.error(`[AniList Sync] Character page ${charPage} failed with status: ${status} (${statusText})`);
      break;
    }
    charPage++;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const staffEdges = [...(data.staffMedia?.edges || [])];
  let hasNextStaffPage = data.staffMedia?.pageInfo?.hasNextPage || false;
  let staffPage = 2;

  while (hasNextStaffPage && staffPage <= maxPages) {
    const staffQuery = `
      query ($id: Int, $page: Int) {
        Staff(id: $id) {
          staffMedia(page: $page, perPage: 50, sort: [POPULARITY_DESC]) {
            pageInfo {
              hasNextPage
            }
            edges {
              staffRole
              node {
                id
                type
                format
                title { english romaji }
                coverImage { large }
                startDate { year }
              }
            }
          }
        }
      }
    `;

    let pageRes;
    let retries = 3;
    while (retries > 0) {
      pageRes = await timeProviderFetch({
        provider: 'anilist',
        cacheId: `anilist-person-${id}-staffpage-${staffPage}`,
        operation: 'anilist.person.staffpage',
        fetcher: () => fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ query: staffQuery, variables: { id, page: staffPage } }),
          next: { revalidate: 3600 }
        })
      });

      if (pageRes.status === 429) {
        const retryAfter = parseInt(pageRes.headers.get('Retry-After') || '5', 10);
        console.warn(`[AniList Sync] Hit rate limit (429) on staff page ${staffPage}. Retrying after ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries--;
      } else {
        break;
      }
    }

    if (pageRes && pageRes.ok) {
      const pageJson = await pageRes.json();
      if (pageJson.errors) {
        console.error(`[AniList Sync] Staff page ${staffPage} GraphQL errors:`, JSON.stringify(pageJson.errors, null, 2));
        break;
      }
      const pageEdges = pageJson.data?.Staff?.staffMedia?.edges || [];
      staffEdges.push(...pageEdges);
      hasNextStaffPage = pageJson.data?.Staff?.staffMedia?.pageInfo?.hasNextPage || false;
    } else {
      const status = pageRes ? pageRes.status : 'unknown';
      const statusText = pageRes ? pageRes.statusText : '';
      console.error(`[AniList Sync] Staff page ${staffPage} failed with status: ${status} (${statusText})`);
      break;
    }
    staffPage++;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const cast: UnifiedCredit[] = [];
  const crew: UnifiedCredit[] = [];

  for (const edge of charEdges) {
    const node = edge.node;
    if (!node) continue;
    const isManga = node.type === 'MANGA';
    const mediaType = isManga ? 'MANGA' : 'ANIME';

    const char = edge.characters && edge.characters.length > 0 ? edge.characters[0] : null;

    cast.push({
      mediaId: `anilist-${node.id}`,
      mediaType,
      title: node.title?.english || node.title?.romaji || 'Unknown',
      poster: node.coverImage?.large || null,
      releaseYear: node.startDate?.year || null,
      role: char ? char.name?.full : 'Voice Actor',
      isVoiceRole: !isManga,
      characterImage: char ? char.image?.large : null
    });
  }

  for (const edge of staffEdges) {
    const node = edge.node;
    if (!node) continue;
    const isManga = node.type === 'MANGA';
    const mediaType = isManga ? 'MANGA' : 'ANIME';

    crew.push({
      mediaId: `anilist-${node.id}`,
      mediaType,
      title: node.title?.english || node.title?.romaji || 'Unknown',
      poster: node.coverImage?.large || null,
      releaseYear: node.startDate?.year || null,
      role: edge.staffRole || 'Staff',
      isVoiceRole: false,
      characterImage: null
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatAnilistDate = (d: any) => {
    if (!d || !d.year) return null;
    return `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}`;
  };

  return {
    id: `anilist-${id}`,
    tmdbId: null,
    anilistId: id,
    igdbId: null,
    malId: null,
    rawgId: null,
    name: data.name?.full || 'Unknown',
    nativeName: data.name?.native || null,
    bio: data.description || null,
    profileImage: data.image?.large || null,
    birthDate: formatAnilistDate(data.dateOfBirth),
    deathDate: formatAnilistDate(data.dateOfDeath),
    knownForDepartment: data.primaryOccupations && data.primaryOccupations.length > 0 ? data.primaryOccupations[0] : null,
    credits: {
      cast,
      crew
    }
  };
}

export async function fetchIGDBPerson(id: number): Promise<UnifiedProfile | null> {
  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) return null;

  const personQuery = `fields name, description, dob, mug_shot.image_id, credited_games.name, credited_games.cover.image_id, credited_games.first_release_date; where id = ${id};`;
  
  const res = await timeProviderFetch({
    provider: 'igdb',
    cacheId: `igdb-person-${id}`,
    operation: 'igdb.person',
    fetcher: () => fetch("https://api.igdb.com/v4/persons", {
      method: "POST",
      headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
      body: personQuery,
      next: { revalidate: 3600 }
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  
  const p = data[0];
  
  const crew: UnifiedCredit[] = [];
  const cast: UnifiedCredit[] = [];

  if (p.credited_games) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of p.credited_games) {
      crew.push({
        mediaId: `igdb-game-${g.id}`,
        mediaType: 'GAME',
        title: g.name,
        poster: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${g.cover.image_id}.jpg` : null,
        releaseYear: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
        role: 'Developer',
        isVoiceRole: false,
        characterImage: null
      });
    }
  }

  return {
    id: `igdb-${id}`,
    tmdbId: null,
    anilistId: null,
    igdbId: id,
    malId: null,
    rawgId: null,
    name: p.name,
    nativeName: null,
    bio: p.description || null,
    profileImage: p.mug_shot?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${p.mug_shot.image_id}.jpg` : null,
    birthDate: p.dob ? new Date(p.dob * 1000).toISOString().split('T')[0] : null,
    deathDate: null,
    knownForDepartment: 'Game Development',
    credits: {
      cast,
      crew
    }
  };
}

export async function fetchRAWGPerson(id: number): Promise<UnifiedProfile | null> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return null;

  const res = await timeProviderFetch({
    provider: 'rawg',
    cacheId: `rawg-person-${id}`,
    operation: 'rawg.person',
    fetcher: () => fetch(`https://api.rawg.io/api/creators/${id}?key=${apiKey}`, { next: { revalidate: 3600 } })
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data) return null;

  const crew: UnifiedCredit[] = [];
  const cast: UnifiedCredit[] = [];

  const formatPositions = (positions: any[]): string => {
    if (!positions || positions.length === 0) return 'Developer';
    return positions.map(p => {
      const name = p.name || '';
      return name.charAt(0).toUpperCase() + name.slice(1);
    }).join(', ');
  };
  const overallPositions = data.positions ? formatPositions(data.positions) : 'Developer';

  if (data.slug) {
    const gamesRes = await timeProviderFetch({
      provider: 'rawg',
      cacheId: `rawg-person-games-${data.slug}`,
      operation: 'rawg.person_games',
      fetcher: () => fetch(`https://api.rawg.io/api/games?key=${apiKey}&creators=${data.slug}&page_size=40`, { next: { revalidate: 3600 } })
    });

    if (gamesRes.ok) {
      const gamesData = await gamesRes.json();
      if (gamesData.results) {
        for (const g of gamesData.results) {
          crew.push({
            mediaId: `rawg-game-${g.id}`,
            mediaType: 'GAME',
            title: g.name,
            poster: g.background_image || null,
            releaseYear: g.released ? parseInt(g.released.substring(0, 4), 10) : null,
            role: `[RESOLVING_ROLE]:${overallPositions}`,
            isVoiceRole: false,
            characterImage: null
          });
        }
      }
    }
  }

  return {
    id: `rawg-${id}`,
    tmdbId: null,
    anilistId: null,
    igdbId: null,
    malId: null,
    rawgId: id,
    rawgSlug: data.slug || null,
    name: data.name,
    nativeName: null,
    bio: data.description || null,
    profileImage: data.image || null,
    birthDate: null,
    deathDate: null,
    knownForDepartment: 'Game Development',
    credits: {
      cast,
      crew
    }
  };
}

// Temporary stub to satisfy page.tsx compilation until Phase 3
export async function getPersonDetails(id: string): Promise<PersonProfile | null> {
  return null;
}
