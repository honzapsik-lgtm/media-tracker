import { UnifiedCompanyProfile, UnifiedCompanyMedia } from '@/types/company';
import { prisma } from '@/lib/prisma';
import { timeProviderFetch } from '@/lib/api-cache';
import { getIGDBToken } from '@/lib/games';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export function parseCompanySlug(slug: string): [string, number] | null {
  const providerMatch = slug.match(/^(tmdb|tmdbnet|anilist|igdb|mal)(?:-[a-z]+)?-(\d+)$/i);
  if (providerMatch) {
    return [providerMatch[1].toLowerCase(), parseInt(providerMatch[2], 10)];
  }
  return null;
}

export async function getUnifiedCompanyProfile(slug: string): Promise<UnifiedCompanyProfile | null> {
  const parsed = parseCompanySlug(slug);
  if (!parsed) return null;

  const [provider, numericId] = parsed;
  
  let tmdbId: number | null = provider === 'tmdb' ? numericId : null;
  let anilistId: number | null = provider === 'anilist' ? numericId : null;
  let igdbId: number | null = provider === 'igdb' ? numericId : null;
  let tmdbNetworkId: number | null = provider === 'tmdbnet' ? numericId : null;

  if (!tmdbId && !anilistId && !igdbId && !tmdbNetworkId) return null;

  // 1. Check DB first
  const dbCompany = await prisma.company.findFirst({
    where: {
      OR: [
        ...(tmdbId ? [{ tmdbId }] : []),
        ...(anilistId ? [{ anilistId }] : []),
        ...(igdbId ? [{ igdbId }] : []),
        ...(tmdbNetworkId ? [{ tmdbNetworkId }] : []),
      ]
    }
  });

  if (dbCompany && dbCompany.updatedAt) {
    const ageDays = (new Date().getTime() - dbCompany.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7 && dbCompany.mergedWorks) {
      return {
        id: dbCompany.id,
        name: dbCompany.name,
        country: dbCompany.country,
        description: dbCompany.description,
        logo: dbCompany.logoUrl,
        portfolio: dbCompany.mergedWorks as unknown as UnifiedCompanyProfile['portfolio'],
        tmdbId: dbCompany.tmdbId,
        anilistId: dbCompany.anilistId,
        igdbId: dbCompany.igdbId,
        tmdbNetworkId: dbCompany.tmdbNetworkId
      };
    }
  }

  // 2. Fetch fresh data
  let fetchedData: UnifiedCompanyProfile | null = null;
  if (tmdbId) {
    fetchedData = await fetchTMDbCompany(tmdbId);
  } else if (tmdbNetworkId) {
    fetchedData = await fetchTMDbNetwork(tmdbNetworkId);
  } else if (anilistId) {
    fetchedData = await fetchAniListStudio(anilistId);
  } else if (igdbId) {
    fetchedData = await fetchIGDBCompany(igdbId);
  }

  if (!fetchedData) return null;

  // 3. Upsert into DB
  let updatedDbCompany;
  if (dbCompany) {
    updatedDbCompany = await prisma.company.update({
      where: { id: dbCompany.id },
      data: {
        name: fetchedData.name,
        country: fetchedData.country,
        description: fetchedData.description,
        logoUrl: fetchedData.logo,
        mergedWorks: fetchedData.portfolio as any,
      }
    });
  } else {
    updatedDbCompany = await prisma.company.create({
      data: {
        tmdbId,
        tmdbNetworkId,
        anilistId,
        igdbId,
        name: fetchedData.name,
        country: fetchedData.country,
        description: fetchedData.description,
        logoUrl: fetchedData.logo,
        mergedWorks: fetchedData.portfolio as any,
      }
    });
  }

  fetchedData.id = updatedDbCompany.id;
  fetchedData.tmdbId = updatedDbCompany.tmdbId;
  fetchedData.anilistId = updatedDbCompany.anilistId;
  fetchedData.igdbId = updatedDbCompany.igdbId;
  fetchedData.tmdbNetworkId = updatedDbCompany.tmdbNetworkId;
  return fetchedData;
}

// --- Fetchers ---

const emptyPortfolio = {
  developedGames: [],
  publishedGames: [],
  animationStudioFor: [],
  producedAnime: [],
  publishedManga: [],
  producedFilmTv: [],
  broadcastedOn: []
};

export async function fetchIGDBCompany(id: number): Promise<UnifiedCompanyProfile | null> {
  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) return null;

  const companyQuery = `fields name, description, logo.image_id, country, developed.name, developed.cover.image_id, developed.first_release_date, published.name, published.cover.image_id, published.first_release_date; where id = ${id};`;
  
  const res = await timeProviderFetch({
    provider: 'igdb',
    cacheId: `igdb-company-${id}`,
    operation: 'igdb.company',
    fetcher: () => fetch("https://api.igdb.com/v4/companies", {
      method: "POST",
      headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
      body: companyQuery,
      next: { revalidate: 3600 }
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  
  const p = data[0];
  
  const developedGames: UnifiedCompanyMedia[] = [];
  const publishedGames: UnifiedCompanyMedia[] = [];

  if (p.developed) {
    for (const g of p.developed) {
      developedGames.push({
        mediaId: `igdb-game-${g.id}`,
        mediaType: 'GAME',
        title: g.name,
        poster: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${g.cover.image_id}.jpg` : null,
        releaseYear: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      });
    }
  }

  if (p.published) {
    for (const g of p.published) {
      publishedGames.push({
        mediaId: `igdb-game-${g.id}`,
        mediaType: 'GAME',
        title: g.name,
        poster: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${g.cover.image_id}.jpg` : null,
        releaseYear: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      });
    }
  }

  return {
    id: `igdb-${id}`,
    name: p.name,
    description: p.description || null,
    logo: p.logo?.image_id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${p.logo.image_id}.jpg` : null,
    country: p.country ? String(p.country) : null,
    portfolio: {
      ...emptyPortfolio,
      developedGames,
      publishedGames,
    }
  };
}

export async function fetchAniListStudio(id: number): Promise<UnifiedCompanyProfile | null> {
  const query = `
    query ($id: Int) {
      Studio(id: $id) {
        id
        name
        isAnimationStudio
        media(isMain: true, sort: POPULARITY_DESC, perPage: 50) {
          edges {
            node {
              id
              type
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
    cacheId: `anilist-studio-${id}`,
    operation: 'anilist.studio',
    fetcher: () => fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { id } }),
      next: { revalidate: 3600 }
    })
  });

  if (!res.ok) return null;
  const json = await res.json();
  const data = json.data?.Studio;
  if (!data) return null;

  const animationStudioFor: UnifiedCompanyMedia[] = [];
  const producedAnime: UnifiedCompanyMedia[] = [];
  const publishedManga: UnifiedCompanyMedia[] = [];

  const edges = data.media?.edges || [];

  for (const edge of edges) {
    const node = edge.node;
    if (!node) continue;
    const isManga = node.type === 'MANGA';
    
    const mediaObj: UnifiedCompanyMedia = {
      mediaId: `anilist-${node.id}`,
      mediaType: isManga ? 'MANGA' : 'ANIME',
      title: node.title?.english || node.title?.romaji || 'Unknown',
      poster: node.coverImage?.large || null,
      releaseYear: node.startDate?.year || null,
    };

    if (data.isAnimationStudio && !isManga) {
      animationStudioFor.push(mediaObj);
    } else if (!isManga) {
      producedAnime.push(mediaObj);
    } else {
      publishedManga.push(mediaObj);
    }
  }

  return {
    id: `anilist-${id}`,
    name: data.name,
    description: null,
    logo: null,
    country: 'JP',
    portfolio: {
      ...emptyPortfolio,
      animationStudioFor,
      producedAnime,
      publishedManga,
    }
  };
}

export async function fetchTMDbCompany(id: number): Promise<UnifiedCompanyProfile | null> {
  if (!TMDB_API_KEY) return null;

  const [companyRes, moviesRes, tvRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/company/${id}?api_key=${TMDB_API_KEY}`, { next: { revalidate: 3600 } }),
    fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_companies=${id}&sort_by=popularity.desc`, { next: { revalidate: 3600 } }),
    fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_companies=${id}&sort_by=popularity.desc`, { next: { revalidate: 3600 } })
  ]);

  if (!companyRes.ok) return null;
  const companyData = await companyRes.json();
  const moviesData = moviesRes.ok ? await moviesRes.json() : { results: [] };
  const tvData = tvRes.ok ? await tvRes.json() : { results: [] };

  const producedFilmTv: UnifiedCompanyMedia[] = [];

  for (const item of [...(moviesData.results || []), ...(tvData.results || [])].sort((a, b) => b.popularity - a.popularity)) {
    const isTv = !!item.first_air_date || item.name;
    producedFilmTv.push({
      mediaId: `tmdb-${isTv ? 'tv' : 'movie'}-${item.id}`,
      mediaType: isTv ? 'SHOW' : 'MOVIE',
      title: item.title || item.name || 'Unknown',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      releaseYear: (item.release_date || item.first_air_date) ? parseInt((item.release_date || item.first_air_date).substring(0, 4), 10) : null,
    });
  }

  return {
    id: `tmdb-${id}`,
    name: companyData.name,
    description: companyData.description || null,
    logo: companyData.logo_path ? `https://image.tmdb.org/t/p/w500${companyData.logo_path}` : null,
    country: companyData.origin_country || null,
    portfolio: {
      ...emptyPortfolio,
      producedFilmTv
    }
  };
}

export async function fetchTMDbNetwork(id: number): Promise<UnifiedCompanyProfile | null> {
  if (!TMDB_API_KEY) return null;

  const [networkRes, tvRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/network/${id}?api_key=${TMDB_API_KEY}`, { next: { revalidate: 3600 } }),
    fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_networks=${id}&sort_by=popularity.desc`, { next: { revalidate: 3600 } })
  ]);

  if (!networkRes.ok) return null;
  const networkData = await networkRes.json();
  const tvData = tvRes.ok ? await tvRes.json() : { results: [] };

  const broadcastedOn: UnifiedCompanyMedia[] = [];

  for (const item of tvData.results || []) {
    broadcastedOn.push({
      mediaId: `tmdb-tv-${item.id}`,
      mediaType: 'SHOW',
      title: item.name || 'Unknown',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      releaseYear: item.first_air_date ? parseInt(item.first_air_date.substring(0, 4), 10) : null,
    });
  }

  return {
    id: `tmdbnet-${id}`,
    name: networkData.name,
    description: null,
    logo: networkData.logo_path ? `https://image.tmdb.org/t/p/w500${networkData.logo_path}` : null,
    country: networkData.origin_country || null,
    portfolio: {
      ...emptyPortfolio,
      broadcastedOn
    }
  };
}
