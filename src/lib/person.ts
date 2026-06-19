import { UnifiedProfile, UnifiedCredit } from '@/types/person';
import { PersonProfile } from '@/types';
import { prisma } from '@/lib/prisma';
import { timeProviderFetch } from '@/lib/api-cache';
import { getIGDBToken } from '@/lib/games';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export function parsePersonSlug(slug: string): [string, number] | null {
  const providerMatch = slug.match(/^(tmdb|anilist|igdb|mal)(?:-[a-z]+)?-(\d+)$/i);
  if (providerMatch) {
    return [providerMatch[1].toLowerCase(), parseInt(providerMatch[2], 10)];
  }
  if (/^\d+$/.test(slug)) {
    return ['tmdb', parseInt(slug, 10)];
  }
  return null;
}

export async function getUnifiedPersonProfile(slug: string): Promise<UnifiedProfile | null> {
  const parsed = parsePersonSlug(slug);
  if (!parsed) return null;

  const [provider, numericId] = parsed;
  
  let tmdbId: number | null = provider === 'tmdb' ? numericId : null;
  let anilistId: number | null = provider === 'anilist' ? numericId : null;
  let igdbId: number | null = provider === 'igdb' ? numericId : null;

  if (!tmdbId && !anilistId && !igdbId) return null;

  // 1. Check DB first
  const dbPerson = await prisma.person.findFirst({
    where: {
      OR: [
        ...(tmdbId ? [{ tmdbId }] : []),
        ...(anilistId ? [{ anilistId }] : []),
        ...(igdbId ? [{ igdbId }] : []),
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

  // 2. Fetch fresh data
  let fetchedData: UnifiedProfile | null = null;
  if (tmdbId) {
    fetchedData = await fetchTMDbPerson(tmdbId);
  } else if (anilistId) {
    fetchedData = await fetchAniListPerson(anilistId);
  } else if (igdbId) {
    fetchedData = await fetchIGDBPerson(igdbId);
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
      }
    });
  } else {
    updatedDbPerson = await prisma.person.create({
      data: {
        tmdbId: fetchedData.tmdbId,
        anilistId: fetchedData.anilistId,
        igdbId: fetchedData.igdbId,
        malId: fetchedData.malId,
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

async function fetchTMDbPerson(id: number): Promise<UnifiedProfile | null> {
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

async function fetchAniListPerson(id: number): Promise<UnifiedProfile | null> {
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
        characterMedia(sort: [POPULARITY_DESC]) {
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
        staffMedia(sort: [POPULARITY_DESC]) {
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

  const cast: UnifiedCredit[] = [];
  const crew: UnifiedCredit[] = [];

  const charEdges = data.characterMedia?.edges || [];
  const staffEdges = data.staffMedia?.edges || [];

  for (const edge of charEdges) {
    const node = edge.node;
    if (!node) continue;
    const isManga = node.type === 'MANGA';
    const mediaType = isManga ? 'MANGA' : 'ANIME';

    const char = edge.characters && edge.characters.length > 0 ? edge.characters[0] : null;

    cast.push({
      mediaId: String(node.id),
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
      mediaId: String(node.id),
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

async function fetchIGDBPerson(id: number): Promise<UnifiedProfile | null> {
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

// Temporary stub to satisfy page.tsx compilation until Phase 3
export async function getPersonDetails(id: string): Promise<PersonProfile | null> {
  return null;
}
