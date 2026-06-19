import { prisma } from '@/lib/prisma';
import { UnifiedProfile, UnifiedCredit } from '@/types/person';
import { getIGDBToken } from '@/lib/games';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function processPersonSync(personId: string): Promise<void> {
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) return;

  let newTmdbId: number | null = null;
  let newIgdbId: number | null = null;

  // Try to find missing TMDb ID
  if (!person.tmdbId) {
    newTmdbId = await resolveIdentity(person, 'tmdb');
  }

  // Try to find missing IGDB ID
  if (!person.igdbId) {
    newIgdbId = await resolveIdentity(person, 'igdb');
  }

  if (newTmdbId || newIgdbId) {
    const updateData: any = {};
    if (newTmdbId) updateData.tmdbId = newTmdbId;
    if (newIgdbId) updateData.igdbId = newIgdbId;

    await prisma.person.update({
      where: { id: person.id },
      data: updateData
    });

    if (newTmdbId) await fetchAndMerge(person.id, 'tmdb', newTmdbId);
    if (newIgdbId) await fetchAndMerge(person.id, 'igdb', newIgdbId);
    
    await prisma.systemLog.create({
      data: {
        level: 'info',
        event: 'worker.job.sync_person',
        message: `Successfully linked person ${person.name} with TMDb: ${newTmdbId}, IGDB: ${newIgdbId}`,
        userId: person.id
      }
    });
  } else {
    await prisma.systemLog.create({
      data: {
        level: 'warn',
        event: 'worker.job.sync_person',
        message: `No cross-platform matches found for person ${person.name}`,
        userId: person.id
      }
    });
  }
}

async function resolveIdentity(person: any, targetPlatform: 'tmdb' | 'igdb'): Promise<number | null> {
  // Step 1: External ID Triangulation
  let matchedId = await tryExternalIdTriangulation(person, targetPlatform);
  if (matchedId) return matchedId;

  // Step 2: Shared Media Intersection
  matchedId = await trySharedMediaIntersection(person, targetPlatform);
  if (matchedId) return matchedId;

  // Step 3: Normalized String + Birthdate
  matchedId = await tryNormalizedStringAndBirthdate(person, targetPlatform);
  if (matchedId) return matchedId;

  return null;
}

// ==========================================
// 3-Step Identity Resolution Pipeline
// ==========================================

// Step 1: External ID Triangulation
async function tryExternalIdTriangulation(person: any, targetPlatform: 'tmdb' | 'igdb'): Promise<number | null> {
  return null;
}

// Step 2: Shared Media Intersection
async function trySharedMediaIntersection(person: any, targetPlatform: 'tmdb' | 'igdb'): Promise<number | null> {
  if (targetPlatform === 'tmdb' && person.anilistId) {
    const credits = person.mergedCredits as { cast: UnifiedCredit[], crew: UnifiedCredit[] };
    if (!credits) return null;

    for (const c of credits.cast) {
      if (c.mediaType === 'ANIME' && c.mediaId) {
        const anilistMediaId = parseInt(c.mediaId, 10);
        if (!anilistMediaId) continue;

        const media = await prisma.media.findUnique({ where: { anilistId: anilistMediaId } });
        if (media && media.tmdbId) {
          const tmdbShowRes = await fetch(`https://api.themoviedb.org/3/tv/${media.tmdbId}/credits?api_key=${TMDB_API_KEY}`);
          if (tmdbShowRes.ok) {
            const tmdbCredits = await tmdbShowRes.json();
            for (const actor of tmdbCredits.cast || []) {
              if (normalizeName(actor.name) === normalizeName(person.name)) {
                return actor.id;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

// Step 3: Normalized String + Birthdate
async function tryNormalizedStringAndBirthdate(person: any, targetPlatform: 'tmdb' | 'igdb'): Promise<number | null> {
  const normalizedTargetName = normalizeName(person.name);
  if (!normalizedTargetName) return null;

  if (targetPlatform === 'tmdb') {
    const res = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(person.name)}&api_key=${TMDB_API_KEY}`);
    if (res.ok) {
      const data = await res.json();
      for (const result of data.results || []) {
        if (normalizeName(result.name) === normalizedTargetName) {
          if (person.birthDate) {
            const personDetailsRes = await fetch(`https://api.themoviedb.org/3/person/${result.id}?api_key=${TMDB_API_KEY}`);
            if (personDetailsRes.ok) {
              const personDetails = await personDetailsRes.json();
              if (personDetails.birthday === person.birthDate) {
                return result.id;
              }
            }
          }
        }
      }
    }
  } else if (targetPlatform === 'igdb') {
    const token = await getIGDBToken();
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!token || !clientId) return null;

    const res = await fetch("https://api.igdb.com/v4/persons", {
      method: "POST",
      headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
      body: `search "${person.name}"; fields name, dob; limit 50;`
    });
    if (res.ok) {
      const data = await res.json();
      for (const result of data) {
        if (normalizeName(result.name) === normalizedTargetName) {
          if (person.birthDate && result.dob) {
            const igdbDate = new Date(result.dob * 1000).toISOString().split('T')[0];
            if (igdbDate === person.birthDate) {
              return result.id;
            }
          }
        }
      }
    }
  }
  return null;
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

// ==========================================
// Deep-Merge Engine
// ==========================================
async function fetchAndMerge(personId: string, platform: 'tmdb' | 'igdb', platformId: number) {
  const { getUnifiedPersonProfile } = await import('./person');
  
  let newProfile: UnifiedProfile | null = null;
  if (platform === 'tmdb') newProfile = await getUnifiedPersonProfile(`tmdb-${platformId}`);
  if (platform === 'igdb') newProfile = await getUnifiedPersonProfile(`igdb-${platformId}`);

  if (!newProfile) return;

  const dbPerson = await prisma.person.findUnique({ where: { id: personId } });
  if (!dbPerson) return;

  const currentCredits = dbPerson.mergedCredits as unknown as { cast: UnifiedCredit[], crew: UnifiedCredit[] } || { cast: [], crew: [] };
  const incomingCredits = newProfile.credits;

  const mergedCast = deepMergeCredits(currentCredits.cast, incomingCredits.cast);
  const mergedCrew = deepMergeCredits(currentCredits.crew, incomingCredits.crew);

  await prisma.person.update({
    where: { id: personId },
    data: {
      mergedCredits: { cast: mergedCast, crew: mergedCrew } as any
    }
  });
}

function deepMergeCredits(existing: UnifiedCredit[], incoming: UnifiedCredit[]): UnifiedCredit[] {
  const result = [...existing];

  for (const newCredit of incoming) {
    const duplicate = result.find(c => 
      c.mediaType === newCredit.mediaType &&
      c.releaseYear === newCredit.releaseYear &&
      normalizeName(c.title) === normalizeName(newCredit.title)
    );

    if (!duplicate) {
      result.push(newCredit);
    }
  }

  return result;
}
