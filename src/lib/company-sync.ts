import { prisma } from '@/lib/prisma';
import { getIGDBToken } from '@/lib/games';
import { UnifiedCompanyProfile } from '@/types/company';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function processCompanySync(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return;

  const resolvedIds: { tmdbId?: number | null; anilistId?: number | null; igdbId?: number | null; tmdbNetworkId?: number | null } = {};

  if (!company.tmdbId && !company.tmdbNetworkId) {
    const tmdbRes = await resolveCompanyIdentity(company, 'tmdb');
    if (tmdbRes) {
      if (tmdbRes.type === 'network') resolvedIds.tmdbNetworkId = tmdbRes.id;
      else resolvedIds.tmdbId = tmdbRes.id;
    }
  }
  if (!company.anilistId) {
    const anilistId = await resolveCompanyIdentity(company, 'anilist');
    if (anilistId) resolvedIds.anilistId = anilistId.id;
  }
  if (!company.igdbId) {
    const igdbId = await resolveCompanyIdentity(company, 'igdb');
    if (igdbId) resolvedIds.igdbId = igdbId.id;
  }

  const finalCompanyId = await saveAndMergeCompanyIfDuplicate(company.id, resolvedIds);

  const updatedCompany = await prisma.company.findUnique({ where: { id: finalCompanyId } });
  if (!updatedCompany) return;

  // Fetch and merge from ALL linked platforms to ensure complete portfolio alignment
  if (updatedCompany.tmdbId) await fetchAndMergeCompany(updatedCompany.id, 'tmdb', updatedCompany.tmdbId);
  if (updatedCompany.tmdbNetworkId) await fetchAndMergeCompany(updatedCompany.id, 'tmdbnet', updatedCompany.tmdbNetworkId);
  if (updatedCompany.anilistId) await fetchAndMergeCompany(updatedCompany.id, 'anilist', updatedCompany.anilistId);
  if (updatedCompany.igdbId) await fetchAndMergeCompany(updatedCompany.id, 'igdb', updatedCompany.igdbId);

  const resolvedAny = Object.values(resolvedIds).some(v => v !== undefined && v !== null);

  await prisma.systemLog.create({
    data: {
      level: 'info',
      event: 'worker.job.sync_company',
      message: `Successfully synced company ${updatedCompany.name}. Resolved New Links - TMDb: ${resolvedIds.tmdbId || 'N/A'}, TMDbNet: ${resolvedIds.tmdbNetworkId || 'N/A'}, AniList: ${resolvedIds.anilistId || 'N/A'}, IGDB: ${resolvedIds.igdbId || 'N/A'}`,
      userId: finalCompanyId
    }
  });
}

async function saveAndMergeCompanyIfDuplicate(
  companyId: string,
  resolvedIds: { tmdbId?: number | null; anilistId?: number | null; igdbId?: number | null; tmdbNetworkId?: number | null }
): Promise<string> {
  const conditions = [];
  if (resolvedIds.tmdbId) conditions.push({ tmdbId: resolvedIds.tmdbId });
  if (resolvedIds.anilistId) conditions.push({ anilistId: resolvedIds.anilistId });
  if (resolvedIds.igdbId) conditions.push({ igdbId: resolvedIds.igdbId });
  if (resolvedIds.tmdbNetworkId) conditions.push({ tmdbNetworkId: resolvedIds.tmdbNetworkId });

  if (conditions.length === 0) return companyId;

  const duplicates = await prisma.company.findMany({
    where: {
      OR: conditions,
      id: { not: companyId }
    }
  });

  let primaryCompany = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  if (duplicates.length > 0) {
    const allCompanies = [primaryCompany, ...duplicates];

    const mergedIds = {
      tmdbId: allCompanies.reduce((acc, c) => acc || c.tmdbId, null as number | null),
      anilistId: allCompanies.reduce((acc, c) => acc || c.anilistId, null as number | null),
      igdbId: allCompanies.reduce((acc, c) => acc || c.igdbId, null as number | null),
      tmdbNetworkId: allCompanies.reduce((acc, c) => acc || c.tmdbNetworkId, null as number | null),
    };

    const name = allCompanies.find(c => c.name)?.name || primaryCompany.name;
    const description = allCompanies.find(c => c.description)?.description || primaryCompany.description;
    const logoUrl = allCompanies.find(c => c.logoUrl)?.logoUrl || primaryCompany.logoUrl;
    const country = allCompanies.find(c => c.country)?.country || primaryCompany.country;

    let mergedPortfolio = emptyPortfolio();

    for (const c of allCompanies) {
      const portfolio = c.mergedWorks as any;
      if (portfolio) {
        mergedPortfolio = deepMergePortfolios(mergedPortfolio, portfolio);
      }
    }

    primaryCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        tmdbId: mergedIds.tmdbId,
        anilistId: mergedIds.anilistId,
        igdbId: mergedIds.igdbId,
        tmdbNetworkId: mergedIds.tmdbNetworkId,
        name,
        description,
        logoUrl,
        country,
        mergedWorks: mergedPortfolio as any
      }
    });

    for (const dup of duplicates) {
      await prisma.company.delete({ where: { id: dup.id } });
    }
  } else {
    const updateData: any = {};
    if (resolvedIds.tmdbId !== undefined) updateData.tmdbId = resolvedIds.tmdbId;
    if (resolvedIds.anilistId !== undefined) updateData.anilistId = resolvedIds.anilistId;
    if (resolvedIds.igdbId !== undefined) updateData.igdbId = resolvedIds.igdbId;
    if (resolvedIds.tmdbNetworkId !== undefined) updateData.tmdbNetworkId = resolvedIds.tmdbNetworkId;

    primaryCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });
  }

  return primaryCompany.id;
}

async function resolveCompanyIdentity(
  company: any,
  targetPlatform: 'tmdb' | 'anilist' | 'igdb'
): Promise<{ id: number; type: 'company' | 'network' | 'studio' } | null> {
  let matched = await tryCompanySharedMediaIntersection(company, targetPlatform);
  if (matched) return matched;

  matched = await tryCompanyNameSearchAndMerge(company, targetPlatform);
  if (matched) return matched;

  return null;
}

async function tryCompanySharedMediaIntersection(
  company: any,
  targetPlatform: 'tmdb' | 'anilist' | 'igdb'
): Promise<{ id: number; type: 'company' | 'network' | 'studio' } | null> {
  const normalizedTargetName = normalizeCompanyName(company.name);
  if (!normalizedTargetName) return null;

  const portfolio = company.mergedWorks as any || emptyPortfolio();
  const allWorks = [
    ...(portfolio.developedGames || []),
    ...(portfolio.publishedGames || []),
    ...(portfolio.animationStudioFor || []),
    ...(portfolio.producedAnime || []),
    ...(portfolio.publishedManga || []),
    ...(portfolio.producedFilmTv || []),
    ...(portfolio.broadcastedOn || []),
  ];

  if (targetPlatform === 'tmdb') {
    for (const work of allWorks) {
      if (work.mediaType === 'ANIME' && work.mediaId) {
        const anilistMediaId = parseInt(work.mediaId, 10);
        if (!anilistMediaId) continue;

        const media = await prisma.media.findUnique({ where: { anilistId: anilistMediaId } });
        if (media && media.tmdbId) {
          try {
            const res = await fetch(`https://api.themoviedb.org/3/tv/${media.tmdbId}?api_key=${TMDB_API_KEY}`);
            if (res.ok) {
              const details = await res.json();
              for (const c of details.production_companies || []) {
                if (normalizeCompanyName(c.name) === normalizedTargetName) {
                  return { id: c.id, type: 'company' };
                }
              }
              for (const n of details.networks || []) {
                if (normalizeCompanyName(n.name) === normalizedTargetName) {
                  return { id: n.id, type: 'network' };
                }
              }
            }
          } catch (e) {
            console.error("[Sync] Company shared media intersection error (tmdb)", e);
          }
        }
      }
    }
  }

  if (targetPlatform === 'anilist') {
    for (const work of allWorks) {
      if ((work.mediaType === 'SHOW' || work.mediaType === 'MOVIE') && work.mediaId) {
        const tmdbIdMatch = work.mediaId.match(/tmdb-(?:tv|movie)-(\d+)/i);
        if (!tmdbIdMatch) continue;
        const tmdbId = parseInt(tmdbIdMatch[1], 10);

        const media = await prisma.media.findUnique({ where: { tmdbId } });
        if (media && media.anilistId) {
          try {
            const { getAnilistDetails } = await import('./anilist');
            const details = await getAnilistDetails(media.anilistId);
            if (details && details.studios?.edges) {
              for (const edge of details.studios.edges) {
                if (edge.node && normalizeCompanyName(edge.node.name) === normalizedTargetName) {
                  return { id: edge.node.id, type: 'studio' };
                }
              }
            }
          } catch (e) {
            console.error("[Sync] Company shared media intersection error (anilist)", e);
          }
        }
      }
    }
  }

  return null;
}

function verifyCompanyWorkOverlap(portfolioWorks: string[], candidateWorks: string[]): boolean {
  if (portfolioWorks.length === 0 || candidateWorks.length === 0) return false;
  const normWorks = new Set(portfolioWorks.map(w => normalizeCompanyName(w)));
  for (const c of candidateWorks) {
    if (normWorks.has(normalizeCompanyName(c))) {
      return true;
    }
  }
  return false;
}

async function tryCompanyNameSearchAndMerge(
  company: any,
  targetPlatform: 'tmdb' | 'anilist' | 'igdb'
): Promise<{ id: number; type: 'company' | 'network' | 'studio' } | null> {
  const normalizedTargetName = normalizeCompanyName(company.name);
  if (!normalizedTargetName) return null;

  const portfolio = company.mergedWorks as any || emptyPortfolio();
  const portfolioTitles = [
    ...(portfolio.developedGames || []),
    ...(portfolio.publishedGames || []),
    ...(portfolio.animationStudioFor || []),
    ...(portfolio.producedAnime || []),
    ...(portfolio.publishedManga || []),
    ...(portfolio.producedFilmTv || []),
    ...(portfolio.broadcastedOn || []),
  ].map(w => w.title).filter(Boolean);

  if (targetPlatform === 'tmdb') {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/company?query=${encodeURIComponent(company.name)}&api_key=${TMDB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        for (const result of data.results || []) {
          if (normalizeCompanyName(result.name) === normalizedTargetName) {
            const moviesRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_companies=${result.id}&sort_by=popularity.desc`);
            if (moviesRes.ok) {
              const moviesData = await moviesRes.json();
              const candidateTitles = (moviesData.results || []).map((m: any) => m.title).filter(Boolean);
              if (verifyCompanyWorkOverlap(portfolioTitles, candidateTitles)) {
                return { id: result.id, type: 'company' };
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Company name search error (tmdb)", e);
    }
  }

  if (targetPlatform === 'anilist') {
    try {
      const query = `
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            studios(search: $search) {
              id
              name
              media(perPage: 25) { edges { node { title { english romaji } } } }
            }
          }
        }
      `;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables: { search: company.name } })
      });
      if (res.ok) {
        const json = await res.json();
        const studios = json.data?.Page?.studios || [];
        for (const studio of studios) {
          if (normalizeCompanyName(studio.name) === normalizedTargetName) {
            const candidateTitles = (studio.media?.edges || []).map((e: any) => e.node?.title?.english || e.node?.title?.romaji).filter(Boolean);
            if (verifyCompanyWorkOverlap(portfolioTitles, candidateTitles)) {
              return { id: studio.id, type: 'studio' };
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Company name search error (anilist)", e);
    }
  }

  if (targetPlatform === 'igdb') {
    try {
      const token = await getIGDBToken();
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (token && clientId) {
        const res = await fetch("https://api.igdb.com/v4/companies", {
          method: "POST",
          headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
          body: `search "${company.name}"; fields id, name, developed.name, published.name; limit 10;`
        });
        if (res.ok) {
          const data = await res.json();
          for (const result of data) {
            if (normalizeCompanyName(result.name) === normalizedTargetName) {
              const candidateTitles = [
                ...(result.developed || []).map((g: any) => g.name),
                ...(result.published || []).map((g: any) => g.name)
              ].filter(Boolean);

              if (verifyCompanyWorkOverlap(portfolioTitles, candidateTitles)) {
                return { id: result.id, type: 'company' };
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Sync] Company name search error (igdb)", e);
    }
  }

  return null;
}

function normalizeCompanyName(name: string): string {
  if (!name) return "";
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

function emptyPortfolio(): UnifiedCompanyProfile['portfolio'] {
  return {
    developedGames: [],
    publishedGames: [],
    animationStudioFor: [],
    producedAnime: [],
    publishedManga: [],
    producedFilmTv: [],
    broadcastedOn: []
  };
}

function deepMergePortfolios(a: any, b: any) {
  const mergeList = (listA: any[] = [], listB: any[] = []) => {
    const res = [...listA];
    for (const item of listB) {
      if (!res.some(x => x.mediaId === item.mediaId || (x.mediaType === item.mediaType && normalizeCompanyName(x.title) === normalizeCompanyName(item.title)))) {
        res.push(item);
      }
    }
    return res;
  };

  return {
    developedGames: mergeList(a.developedGames, b.developedGames),
    publishedGames: mergeList(a.publishedGames, b.publishedGames),
    animationStudioFor: mergeList(a.animationStudioFor, b.animationStudioFor),
    producedAnime: mergeList(a.producedAnime, b.producedAnime),
    publishedManga: mergeList(a.publishedManga, b.publishedManga),
    producedFilmTv: mergeList(a.producedFilmTv, b.producedFilmTv),
    broadcastedOn: mergeList(a.broadcastedOn, b.broadcastedOn)
  };
}

async function fetchAndMergeCompany(companyId: string, platform: 'tmdb' | 'igdb' | 'anilist' | 'tmdbnet', platformId: number) {
  const { fetchTMDbCompany, fetchIGDBCompany, fetchAniListStudio, fetchTMDbNetwork } = await import('./company');

  let newProfile = null;
  if (platform === 'tmdb') newProfile = await fetchTMDbCompany(platformId);
  if (platform === 'igdb') newProfile = await fetchIGDBCompany(platformId);
  if (platform === 'anilist') newProfile = await fetchAniListStudio(platformId);
  if (platform === 'tmdbnet') newProfile = await fetchTMDbNetwork(platformId);

  if (!newProfile) return;

  const dbCompany = await prisma.company.findUnique({ where: { id: companyId } });
  if (!dbCompany) return;

  const currentWorks = dbCompany.mergedWorks as any || emptyPortfolio();
  const incomingWorks = newProfile.portfolio;

  const merged = deepMergePortfolios(currentWorks, incomingWorks);

  await prisma.company.update({
    where: { id: companyId },
    data: {
      mergedWorks: merged as any
    }
  });
}
