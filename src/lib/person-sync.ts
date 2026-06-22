import { prisma } from '@/lib/prisma';
import { UnifiedProfile, UnifiedCredit } from '@/types/person';
import { getIGDBToken } from '@/lib/games';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function processPersonSync(personId: string): Promise<void> {
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) return;

  const resolvedIds: { tmdbId?: number | null; igdbId?: number | null; anilistId?: number | null; rawgId?: number | null } = {};

  if (!person.tmdbId) {
    resolvedIds.tmdbId = await resolveIdentity(person, 'tmdb');
  }
  if (!person.igdbId) {
    resolvedIds.igdbId = await resolveIdentity(person, 'igdb');
  }
  if (!person.anilistId) {
    resolvedIds.anilistId = await resolveIdentity(person, 'anilist');
  }
  if (!person.rawgId) {
    resolvedIds.rawgId = await resolveIdentity(person, 'rawg');
  }

  const finalPersonId = await saveAndMergePersonIfDuplicate(person.id, resolvedIds);
  
  const updatedPerson = await prisma.person.findUnique({ where: { id: finalPersonId } });
  if (!updatedPerson) return;

  // Fetch and merge from ALL linked platforms to ensure a complete, unified profile
  if (updatedPerson.tmdbId) await fetchAndMerge(updatedPerson.id, 'tmdb', updatedPerson.tmdbId);
  if (updatedPerson.igdbId) await fetchAndMerge(updatedPerson.id, 'igdb', updatedPerson.igdbId);
  if (updatedPerson.anilistId) await fetchAndMerge(updatedPerson.id, 'anilist', updatedPerson.anilistId);
  if (updatedPerson.rawgId) await fetchAndMerge(updatedPerson.id, 'rawg', updatedPerson.rawgId);

  const resolvedAny = Object.values(resolvedIds).some(v => v !== undefined && v !== null);

  await prisma.systemLog.create({
    data: {
      level: 'info',
      event: 'worker.job.sync_person',
      message: `Successfully synced person ${updatedPerson.name}. Resolved New Links - TMDb: ${resolvedIds.tmdbId || 'N/A'}, IGDB: ${resolvedIds.igdbId || 'N/A'}, AniList: ${resolvedIds.anilistId || 'N/A'}, RAWG: ${resolvedIds.rawgId || 'N/A'}`,
      userId: finalPersonId
    }
  });
}

async function saveAndMergePersonIfDuplicate(
  personId: string,
  resolvedIds: { tmdbId?: number | null; igdbId?: number | null; anilistId?: number | null; rawgId?: number | null }
): Promise<string> {
  const conditions = [];
  if (resolvedIds.tmdbId) conditions.push({ tmdbId: resolvedIds.tmdbId });
  if (resolvedIds.igdbId) conditions.push({ igdbId: resolvedIds.igdbId });
  if (resolvedIds.anilistId) conditions.push({ anilistId: resolvedIds.anilistId });
  if (resolvedIds.rawgId) conditions.push({ rawgId: resolvedIds.rawgId });

  if (conditions.length === 0) return personId;

  const duplicates = await prisma.person.findMany({
    where: {
      OR: conditions,
      id: { not: personId }
    }
  });

  let primaryPerson = await prisma.person.findUniqueOrThrow({ where: { id: personId } });

  if (duplicates.length > 0) {
    const allPeople = [primaryPerson, ...duplicates];
    
    const mergedIds = {
      tmdbId: allPeople.reduce((acc, p) => acc || p.tmdbId, null as number | null),
      igdbId: allPeople.reduce((acc, p) => acc || p.igdbId, null as number | null),
      anilistId: allPeople.reduce((acc, p) => acc || p.anilistId, null as number | null),
      rawgId: allPeople.reduce((acc, p) => acc || p.rawgId, null as number | null),
      malId: allPeople.reduce((acc, p) => acc || p.malId, null as number | null),
    };

    const name = allPeople.find(p => p.name)?.name || primaryPerson.name;
    const nativeName = allPeople.find(p => p.nativeName)?.nativeName || primaryPerson.nativeName;
    const biography = allPeople.find(p => p.biography)?.biography || primaryPerson.biography;
    const profileImage = allPeople.find(p => p.profileImage)?.profileImage || primaryPerson.profileImage;
    const birthDate = allPeople.find(p => p.birthDate)?.birthDate || primaryPerson.birthDate;
    const deathDate = allPeople.find(p => p.deathDate)?.deathDate || primaryPerson.deathDate;
    const knownForDepartment = allPeople.find(p => p.knownForDepartment)?.knownForDepartment || primaryPerson.knownForDepartment;

    let mergedCast: UnifiedCredit[] = [];
    let mergedCrew: UnifiedCredit[] = [];

    for (const p of allPeople) {
      const credits = p.mergedCredits as unknown as { cast: UnifiedCredit[], crew: UnifiedCredit[] } || { cast: [], crew: [] };
      if (credits.cast) mergedCast = deepMergeCredits(mergedCast, credits.cast);
      if (credits.crew) mergedCrew = deepMergeCredits(mergedCrew, credits.crew);
    }

    primaryPerson = await prisma.person.update({
      where: { id: personId },
      data: {
        tmdbId: mergedIds.tmdbId,
        igdbId: mergedIds.igdbId,
        anilistId: mergedIds.anilistId,
        rawgId: mergedIds.rawgId,
        malId: mergedIds.malId,
        name,
        nativeName,
        biography,
        profileImage,
        birthDate,
        deathDate,
        knownForDepartment,
        mergedCredits: { cast: mergedCast, crew: mergedCrew } as any
      }
    });

    for (const dup of duplicates) {
      await prisma.person.delete({ where: { id: dup.id } });
    }
  } else {
    const updateData: any = {};
    if (resolvedIds.tmdbId !== undefined) updateData.tmdbId = resolvedIds.tmdbId;
    if (resolvedIds.igdbId !== undefined) updateData.igdbId = resolvedIds.igdbId;
    if (resolvedIds.anilistId !== undefined) updateData.anilistId = resolvedIds.anilistId;
    if (resolvedIds.rawgId !== undefined) updateData.rawgId = resolvedIds.rawgId;

    primaryPerson = await prisma.person.update({
      where: { id: personId },
      data: updateData
    });
  }

  return primaryPerson.id;
}

async function resolveIdentity(person: any, targetPlatform: 'tmdb' | 'igdb' | 'anilist' | 'rawg'): Promise<number | null> {
  let matchedId = await tryExternalIdTriangulation(person, targetPlatform);
  if (matchedId) return matchedId;

  matchedId = await trySharedMediaIntersection(person, targetPlatform);
  if (matchedId) return matchedId;

  matchedId = await tryNormalizedStringAndBirthdate(person, targetPlatform);
  if (matchedId) return matchedId;

  return null;
}

async function tryExternalIdTriangulation(person: any, targetPlatform: 'tmdb' | 'igdb' | 'anilist' | 'rawg'): Promise<number | null> {
  const normalizedTargetName = normalizeName(person.name);
  if (!normalizedTargetName) return null;

  if (targetPlatform === 'igdb' && person.tmdbId) {
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/person/${person.tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
      if (tmdbRes.ok) {
        const extIds = await tmdbRes.json();
        const imdbId = extIds.imdb_id;
        const wikidataId = extIds.wikidata_id;

        if (imdbId || wikidataId) {
          const token = await getIGDBToken();
          const clientId = process.env.TWITCH_CLIENT_ID;
          if (token && clientId) {
            const igdbRes = await fetch("https://api.igdb.com/v4/persons", {
              method: "POST",
              headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
              body: `search "${person.name}"; fields id, name, websites.url; limit 10;`
            });
            if (igdbRes.ok) {
              const data = await igdbRes.json();
              for (const result of data) {
                if (normalizeName(result.name) === normalizedTargetName && result.websites) {
                  for (const w of result.websites) {
                    if (imdbId && w.url.includes(imdbId)) return result.id;
                    if (wikidataId && w.url.includes(wikidataId)) return result.id;
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Error in tryExternalIdTriangulation (igdb)", e);
    }
  }

  if (targetPlatform === 'tmdb' && person.igdbId) {
    try {
      const token = await getIGDBToken();
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (token && clientId) {
        const igdbRes = await fetch("https://api.igdb.com/v4/persons", {
          method: "POST",
          headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
          body: `fields id, name, websites.url; where id = ${person.igdbId};`
        });
        if (igdbRes.ok) {
          const data = await igdbRes.json();
          if (data && data.length > 0 && data[0].websites) {
            let imdbId = null;
            let wikidataId = null;

            for (const w of data[0].websites) {
              const imdbMatch = w.url.match(/imdb\.com\/name\/(nm\d+)/i);
              if (imdbMatch) imdbId = imdbMatch[1];

              const wikidataMatch = w.url.match(/wikidata\.org\/wiki\/(Q\d+)/i);
              if (wikidataMatch) wikidataId = wikidataMatch[1];
            }

            if (imdbId) {
              const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
              if (findRes.ok) {
                const findData = await findRes.json();
                if (findData.person_results && findData.person_results.length > 0) {
                  return findData.person_results[0].id;
                }
              }
            }

            if (wikidataId) {
              const findRes = await fetch(`https://api.themoviedb.org/3/find/${wikidataId}?api_key=${TMDB_API_KEY}&external_source=wikidata_id`);
              if (findRes.ok) {
                const findData = await findRes.json();
                if (findData.person_results && findData.person_results.length > 0) {
                  return findData.person_results[0].id;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Error in tryExternalIdTriangulation (tmdb)", e);
    }
  }

  return null;
}

async function trySharedMediaIntersection(person: any, targetPlatform: 'tmdb' | 'igdb' | 'anilist' | 'rawg'): Promise<number | null> {
  const normalizedTargetName = normalizeName(person.name);
  if (!normalizedTargetName) return null;

  const credits = person.mergedCredits as { cast: UnifiedCredit[], crew: UnifiedCredit[] } || { cast: [], crew: [] };
  const allCredits = [...(credits.cast || []), ...(credits.crew || [])];

  if (targetPlatform === 'tmdb') {
    for (const c of allCredits) {
      if (c.mediaType === 'ANIME' && c.mediaId) {
        const anilistMediaId = parseInt(c.mediaId, 10);
        if (!anilistMediaId) continue;

        const media = await prisma.media.findUnique({ where: { anilistId: anilistMediaId } });
        if (media && media.tmdbId) {
          try {
            const tmdbRes = await fetch(`https://api.themoviedb.org/3/tv/${media.tmdbId}/credits?api_key=${TMDB_API_KEY}`);
            if (tmdbRes.ok) {
              const tmdbCredits = await tmdbRes.json();
              for (const member of [...(tmdbCredits.cast || []), ...(tmdbCredits.crew || [])]) {
                if (normalizeName(member.name) === normalizedTargetName) {
                  return member.id;
                }
              }
            }
          } catch (e) {
            console.error("[Sync] Error in trySharedMediaIntersection (tmdb-tv)", e);
          }

          try {
            const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${media.tmdbId}/credits?api_key=${TMDB_API_KEY}`);
            if (tmdbRes.ok) {
              const tmdbCredits = await tmdbRes.json();
              for (const member of [...(tmdbCredits.cast || []), ...(tmdbCredits.crew || [])]) {
                if (normalizeName(member.name) === normalizedTargetName) {
                  return member.id;
                }
              }
            }
          } catch (e) {
            console.error("[Sync] Error in trySharedMediaIntersection (tmdb-movie)", e);
          }
        }
      }
    }
  }

  if (targetPlatform === 'anilist') {
    for (const c of allCredits) {
      if ((c.mediaType === 'SHOW' || c.mediaType === 'MOVIE') && c.mediaId) {
        const tmdbIdMatch = c.mediaId.match(/tmdb-(?:tv|movie)-(\d+)/i);
        if (!tmdbIdMatch) continue;
        const tmdbId = parseInt(tmdbIdMatch[1], 10);

        const media = await prisma.media.findUnique({ where: { tmdbId } });
        if (media && media.anilistId) {
          try {
            const { getAnilistDetails } = await import('./anilist');
            const details = await getAnilistDetails(media.anilistId);
            if (details && details.staff?.edges) {
              for (const edge of details.staff.edges) {
                if (edge.node && normalizeName(edge.node.name?.full) === normalizedTargetName) {
                  return edge.node.id;
                }
              }
            }
            if (details && details.characters?.edges) {
              for (const edge of details.characters.edges) {
                if (edge.voiceActors) {
                  for (const va of edge.voiceActors) {
                    if (normalizeName(va.name?.full) === normalizedTargetName) {
                      return va.id;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error("[Sync] Error in trySharedMediaIntersection (anilist)", e);
          }
        }
      }
    }
  }

  if (targetPlatform === 'igdb') {
    for (const c of allCredits) {
      if (c.mediaType === 'GAME' && c.mediaId) {
        const gameIdMatch = c.mediaId.match(/(?:igdb|rawg)-game-(\d+)/i);
        if (!gameIdMatch) continue;
        
        let media = null;
        if (c.mediaId.startsWith('igdb-game-')) {
          media = await prisma.media.findUnique({ where: { igdbId: parseInt(gameIdMatch[1], 10) } });
        }
        
        if (media && media.igdbId) {
          try {
            const token = await getIGDBToken();
            const clientId = process.env.TWITCH_CLIENT_ID;
            if (token && clientId) {
              const res = await fetch("https://api.igdb.com/v4/persons", {
                method: "POST",
                headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
                body: `fields id, name; where credited_games = (${media.igdbId}); limit 100;`
              });
              if (res.ok) {
                const data = await res.json();
                for (const p of data) {
                  if (normalizeName(p.name) === normalizedTargetName) {
                    return p.id;
                  }
                }
              }
            }
          } catch (e) {
            console.error("[Sync] Error in trySharedMediaIntersection (igdb)", e);
          }
        }
      }
    }
  }

  return null;
}

function verifyCreditOverlap(personCredits: string[], candidateCredits: string[]): boolean {
  if (personCredits.length === 0 || candidateCredits.length === 0) return false;
  
  const normPerson = new Set(personCredits.map(t => normalizeName(t)));
  for (const c of candidateCredits) {
    if (normPerson.has(normalizeName(c))) {
      return true;
    }
  }
  return false;
}

async function tryNormalizedStringAndBirthdate(person: any, targetPlatform: 'tmdb' | 'igdb' | 'anilist' | 'rawg'): Promise<number | null> {
  const normalizedTargetName = normalizeName(person.name);
  if (!normalizedTargetName) return null;

  const personCredits = person.mergedCredits as { cast: UnifiedCredit[], crew: UnifiedCredit[] } || { cast: [], crew: [] };
  const personTitles = [
    ...(personCredits.cast || []).map(c => c.title),
    ...(personCredits.crew || []).map(c => c.title)
  ].filter(Boolean);

  if (targetPlatform === 'tmdb') {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(person.name)}&api_key=${TMDB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        for (const result of data.results || []) {
          if (normalizeName(result.name) === normalizedTargetName) {
            const personDetailsRes = await fetch(`https://api.themoviedb.org/3/person/${result.id}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits`);
            if (personDetailsRes.ok) {
              const details = await personDetailsRes.json();
              if (person.birthDate && details.birthday === person.birthDate) {
                return result.id;
              }
              
              const candidateTitles = [
                ...(details.combined_credits?.cast || []).map((c: any) => c.title || c.name),
                ...(details.combined_credits?.crew || []).map((c: any) => c.title || c.name)
              ].filter(Boolean);
              
              if (verifyCreditOverlap(personTitles, candidateTitles)) {
                return result.id;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Error in tryNormalizedStringAndBirthdate (tmdb)", e);
    }
  }

  if (targetPlatform === 'igdb') {
    try {
      const token = await getIGDBToken();
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (token && clientId) {
        const res = await fetch("https://api.igdb.com/v4/persons", {
          method: "POST",
          headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
          body: `search "${person.name}"; fields id, name, dob, credited_games.name; limit 10;`
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
              
              if (result.credited_games) {
                const candidateTitles = result.credited_games.map((g: any) => g.name).filter(Boolean);
                if (verifyCreditOverlap(personTitles, candidateTitles)) {
                  return result.id;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Error in tryNormalizedStringAndBirthdate (igdb)", e);
    }
  }

  if (targetPlatform === 'anilist') {
    try {
      const query = `
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            staff(search: $search) {
              id
              name { full }
              dateOfBirth { year month day }
              staffMedia(perPage: 25) { edges { node { title { english romaji } } } }
              characterMedia(perPage: 25) { edges { node { title { english romaji } } } }
            }
          }
        }
      `;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables: { search: person.name } })
      });
      if (res.ok) {
        const json = await res.json();
        const staffList = json.data?.Page?.staff || [];
        for (const staff of staffList) {
          if (normalizeName(staff.name?.full) === normalizedTargetName) {
            const d = staff.dateOfBirth;
            if (person.birthDate && d && d.year) {
              const staffDate = `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}`;
              if (staffDate === person.birthDate) {
                return staff.id;
              }
            }

            const candidateTitles = [
              ...(staff.staffMedia?.edges || []).map((e: any) => e.node?.title?.english || e.node?.title?.romaji),
              ...(staff.characterMedia?.edges || []).map((e: any) => e.node?.title?.english || e.node?.title?.romaji)
            ].filter(Boolean);

            if (verifyCreditOverlap(personTitles, candidateTitles)) {
              return staff.id;
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Error in tryNormalizedStringAndBirthdate (anilist)", e);
    }
  }

  if (targetPlatform === 'rawg') {
    try {
      const apiKey = process.env.RAWG_API_KEY;
      if (apiKey) {
        const res = await fetch(`https://api.rawg.io/api/creators?key=${apiKey}&search=${encodeURIComponent(person.name)}`);
        if (res.ok) {
          const data = await res.json();
          for (const result of data.results || []) {
            if (normalizeName(result.name) === normalizedTargetName) {
              if (result.slug) {
                const gamesRes = await fetch(`https://api.rawg.io/api/games?key=${apiKey}&creators=${result.slug}&page_size=20`);
                if (gamesRes.ok) {
                  const gamesData = await gamesRes.json();
                  const candidateTitles = (gamesData.results || []).map((g: any) => g.name).filter(Boolean);
                  if (verifyCreditOverlap(personTitles, candidateTitles)) {
                    return result.id;
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Error in tryNormalizedStringAndBirthdate (rawg)", e);
    }
  }

  return null;
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

async function fetchAndMerge(personId: string, platform: 'tmdb' | 'igdb' | 'anilist' | 'rawg', platformId: number) {
  const { fetchTMDbPerson, fetchIGDBPerson, fetchAniListPerson, fetchRAWGPerson } = await import('./person');
  
  let newProfile: UnifiedProfile | null = null;
  if (platform === 'tmdb') newProfile = await fetchTMDbPerson(platformId);
  if (platform === 'igdb') newProfile = await fetchIGDBPerson(platformId);
  if (platform === 'anilist') newProfile = await fetchAniListPerson(platformId);
  if (platform === 'rawg') newProfile = await fetchRAWGPerson(platformId);

  if (!newProfile) return;

  const dbPerson = await prisma.person.findUnique({ where: { id: personId } });
  if (!dbPerson) return;

  const currentCredits = dbPerson.mergedCredits as unknown as { cast: UnifiedCredit[], crew: UnifiedCredit[] } || { cast: [], crew: [] };
  
  // Filter out any existing credits from the platform we are syncing to avoid duplicates and clean up stale/duplicate data
  const prefix = `${platform}-`;
  const cleanExistingCast = (currentCredits.cast || []).filter(c => !c.mediaId?.startsWith(prefix));
  const cleanExistingCrew = (currentCredits.crew || []).filter(c => !c.mediaId?.startsWith(prefix));

  const incomingCredits = newProfile.credits;

  const mergedCast = deepMergeCredits(cleanExistingCast, incomingCredits.cast || []);
  const mergedCrew = deepMergeCredits(cleanExistingCrew, incomingCredits.crew || []);

  await prisma.person.update({
    where: { id: personId },
    data: {
      mergedCredits: { cast: mergedCast, crew: mergedCrew } as any
    }
  });

  if (platform === 'rawg') {
    const creatorSlug = newProfile.rawgSlug || dbPerson.name.toLowerCase().replace(/\s+/g, '-');
    const crewWithResolvedRoles = await resolveExactRAWGRoles(mergedCrew, creatorSlug, platformId);

    await prisma.person.update({
      where: { id: personId },
      data: {
        mergedCredits: { cast: mergedCast, crew: crewWithResolvedRoles } as any
      }
    });
  }
}

async function resolveExactRAWGRoles(
  crewCredits: UnifiedCredit[],
  creatorSlug: string,
  creatorId: number
): Promise<UnifiedCredit[]> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    return crewCredits.map(c => {
      if (c.role && c.role.startsWith('[RESOLVING_ROLE]:')) {
        c.role = c.role.replace('[RESOLVING_ROLE]:', '');
      }
      return c;
    });
  }

  const updatedCredits = [...crewCredits];
  const gamesToSync = updatedCredits.filter(c => c.mediaId?.startsWith('rawg-game-') && c.role?.startsWith('[RESOLVING_ROLE]:'));

  const batchSize = 5;
  for (let i = 0; i < gamesToSync.length; i += batchSize) {
    const batch = gamesToSync.slice(i, i + batchSize);
    await Promise.all(batch.map(async (credit) => {
      try {
        const gameIdStr = credit.mediaId!.replace('rawg-game-', '');
        const gameId = parseInt(gameIdStr, 10);
        if (isNaN(gameId)) return;

        const devRes = await fetch(`https://api.rawg.io/api/games/${gameId}/development-team?key=${apiKey}`);
        if (devRes.ok) {
          const devData = await devRes.json();
          const member = (devData.results || []).find((m: any) => 
            m.id === creatorId || 
            m.slug === creatorSlug || 
            m.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === creatorSlug.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          if (member && member.positions && member.positions.length > 0) {
            const roles = member.positions.map((p: any) => {
              const name = p.name || '';
              return name.charAt(0).toUpperCase() + name.slice(1);
            }).join(', ');
            credit.role = roles;
            return;
          }
        }
        credit.role = credit.role.replace('[RESOLVING_ROLE]:', '');
      } catch (e) {
        console.error(`[Sync] Failed to resolve exact role for game credit ${credit.mediaId}`, e);
        if (credit.role && credit.role.startsWith('[RESOLVING_ROLE]:')) {
          credit.role = credit.role.replace('[RESOLVING_ROLE]:', '');
        }
      }
    }));
  }

  return updatedCredits;
}

function isSameMedia(c1: UnifiedCredit, c2: UnifiedCredit): boolean {
  if (normalizeName(c1.title) !== normalizeName(c2.title)) return false;

  const y1 = c1.releaseYear;
  const y2 = c2.releaseYear;
  if (y1 !== null && y2 !== null && Math.abs(y1 - y2) > 1) return false;

  const isType1AnimeOrShowMovie = ['ANIME', 'SHOW', 'MOVIE'].includes(c1.mediaType);
  const isType2AnimeOrShowMovie = ['ANIME', 'SHOW', 'MOVIE'].includes(c2.mediaType);

  if (isType1AnimeOrShowMovie && isType2AnimeOrShowMovie) {
    const hasAnime = c1.mediaType === 'ANIME' || c2.mediaType === 'ANIME';
    if (hasAnime) {
      // Cross-platform anime/show/movie matching bypasses the isVoiceRole check
      // because TMDb credits for anime might not be labeled as voice roles
      return true;
    }
  }

  // Otherwise, strictly check isVoiceRole
  if (c1.isVoiceRole !== c2.isVoiceRole) return false;

  if (isType1AnimeOrShowMovie && isType2AnimeOrShowMovie) {
    return true;
  }

  return c1.mediaType === c2.mediaType;
}

function mergeRoles(roleA: string, roleB: string): string {
  const clean = (r: string) => r.replace(/\s*\(voice\)$/i, '').trim();
  const partsA = (roleA || '').split(',').map(s => clean(s)).filter(Boolean);
  const partsB = (roleB || '').split(',').map(s => clean(s)).filter(Boolean);
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const part of [...partsA, ...partsB]) {
    const norm = part.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      merged.push(part);
    }
  }

  return merged.join(', ');
}

function deepMergeCredits(existing: UnifiedCredit[], incoming: UnifiedCredit[]): UnifiedCredit[] {
  const result: UnifiedCredit[] = [];

  const findDuplicate = (credit: UnifiedCredit) => {
    return result.find(c => isSameMedia(c, credit));
  };

  for (const extCredit of existing) {
    const duplicate = findDuplicate(extCredit);
    if (duplicate) {
      duplicate.role = mergeRoles(duplicate.role, extCredit.role);
      
      const extIsAnilist = extCredit.mediaId?.startsWith('anilist-');
      const dupIsAnilist = duplicate.mediaId?.startsWith('anilist-');
      if (extIsAnilist && !dupIsAnilist) {
        duplicate.mediaId = extCredit.mediaId;
        duplicate.mediaType = extCredit.mediaType;
        duplicate.poster = extCredit.poster;
        duplicate.releaseYear = extCredit.releaseYear;
        duplicate.characterImage = extCredit.characterImage;
        duplicate.isVoiceRole = extCredit.isVoiceRole;
      }
    } else {
      result.push({ ...extCredit });
    }
  }

  for (const newCredit of incoming) {
    const duplicate = findDuplicate(newCredit);
    if (duplicate) {
      duplicate.role = mergeRoles(duplicate.role, newCredit.role);
      
      const newIsAnilist = newCredit.mediaId?.startsWith('anilist-');
      const dupIsAnilist = duplicate.mediaId?.startsWith('anilist-');
      if (newIsAnilist && !dupIsAnilist) {
        duplicate.mediaId = newCredit.mediaId;
        duplicate.mediaType = newCredit.mediaType;
        duplicate.poster = newCredit.poster;
        duplicate.releaseYear = newCredit.releaseYear;
        duplicate.characterImage = newCredit.characterImage;
        duplicate.isVoiceRole = newCredit.isVoiceRole;
      }
    } else {
      result.push({ ...newCredit });
    }
  }

  return result;
}

