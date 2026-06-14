/* eslint-disable @typescript-eslint/no-explicit-any */
import { PersonProfile, MediaItem } from '@/types';
import { prisma } from '@/lib/prisma';
import { timeProviderFetch } from '@/lib/api-cache';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

const PERSON_CACHE_TTL_DAYS = 7;

export async function getPersonDetails(id: string): Promise<PersonProfile | null> {
  const cached = await prisma.apiCache.findUnique({ where: { id } });
  if (cached && cached.expires_at > new Date()) {
    return cached.data as unknown as PersonProfile;
  }

  let result: PersonProfile | null = null;
  let provider = '';

  if (id.startsWith('tmdb-person-')) {
    result = await fetchTMDbPerson(id);
    provider = 'tmdb';
  } else if (id.startsWith('rawg-creator-')) {
    result = await fetchRAWGPerson(id);
    provider = 'rawg';
  }

  if (result) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PERSON_CACHE_TTL_DAYS);

    await prisma.apiCache.upsert({
      where: { id },
      update: { data: result as any, expires_at: expiresAt },
      create: { id, provider, data: result as any, expires_at: expiresAt },
    });
  }

  return result;
}

async function fetchTMDbPerson(id: string): Promise<PersonProfile | null> {
  if (!TMDB_API_KEY) return null;
  const nativeId = id.replace('tmdb-person-', '');

  const res = await timeProviderFetch({
    provider: 'tmdb',
    cacheId: id,
    operation: 'tmdb.person',
    fetcher: () => fetch(
      `https://api.themoviedb.org/3/person/${nativeId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=combined_credits`,
      { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const credits: MediaItem[] = [];
  const rawCredits = [...(data.combined_credits?.cast || []), ...(data.combined_credits?.crew || [])];
  
  // Deduplicate by media ID
  const seen = new Set<string>();
  
  // Sort by popularity and take top 50
  rawCredits.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

  for (const item of rawCredits) {
    if (credits.length >= 50) break;
    const mediaId = `tmdb-${item.media_type}-${item.id}`;
    if (!seen.has(mediaId) && (item.media_type === 'movie' || item.media_type === 'tv')) {
      seen.add(mediaId);
      credits.push({
        id: mediaId,
        title: item.title || item.name,
        type: item.media_type === 'tv' ? 'show' : 'movie',
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        releaseDate: item.release_date || item.first_air_date || 'N/A'
      });
    }
  }

  return {
    id,
    name: data.name,
    bio: data.biography || null,
    image: data.profile_path ? `https://image.tmdb.org/t/p/w500${data.profile_path}` : null,
    birthDate: data.birthday || null,
    deathDate: data.deathday || null,
    credits,
  };
}

async function fetchRAWGPerson(id: string): Promise<PersonProfile | null> {
  if (!RAWG_API_KEY) return null;
  const nativeId = id.replace('rawg-creator-', '');

  const res = await timeProviderFetch({
    provider: 'rawg',
    cacheId: id,
    operation: 'rawg.creator',
    fetcher: () => fetch(
      `https://api.rawg.io/api/creators/${nativeId}?key=${RAWG_API_KEY}`,
      { next: { revalidate: 3600 } }
    ),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const credits: MediaItem[] = [];
  
  if (data.games) {
    for (const game of data.games.slice(0, 50)) {
      credits.push({
        id: `rawg-game-${game.id}`,
        title: game.name,
        type: 'game',
        image: null, 
        releaseDate: 'N/A'
      });
    }
  }

  const cleanDescription = data.description ? data.description.replace(/<[^>]*>?/gm, '') : null;

  return {
    id,
    name: data.name,
    bio: cleanDescription,
    image: data.image || data.image_background || null,
    birthDate: null,
    deathDate: null,
    credits,
  };
}

