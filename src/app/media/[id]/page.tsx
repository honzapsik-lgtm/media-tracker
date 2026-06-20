import ExpandableCast from "@/components/ExpandableCast";
import { getTMDbDetails } from "@/lib/tmdb";
import { getGameDetails, getGameCrew } from "@/lib/games";

import RatingSlider from "@/components/RatingSlider";
import TextReviewEditor from "@/components/TextReviewEditor";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ExpandableText from "@/components/ExpandableText";
import WatchlistButton from "@/components/WatchlistButton";
import SyncLoader from "@/components/SyncLoader";
import ExpandableAniListCast from "@/components/ExpandableAniListCast";
import { StaffGrid } from '@/components/StaffGrid';
import WatchProviders from "@/components/WatchProviders";
import AnimeThemes from "@/components/AnimeThemes";
import { prisma } from "@/lib/prisma";
import { CRITERIA_CONFIG } from "@/lib/constants";
import { getMasterCrew, getMasterStudios, getMasterCast } from "@/lib/credits-parser";
import {
  calculateCriteriaAverages,
  getDeepCriteriaRows,
  getListRank,
  getListRankMap,
  getMediaStats,
  getMediaStatsMap,
  upsertBaseMedia,
} from "@/lib/media-db";
import { getAnilistDetails } from "@/lib/anilist";
import GameCharacterGrid from "@/components/GameCharacterGrid";
import MangaChapters from "@/components/MangaChapters";
import MangaChaptersLoader from "@/components/MangaChaptersLoader";
import MangaMetadataPills from "@/components/MangaMetadataPills";



const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; 
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; 
};

function getStoreIcon(site: string) {
  const norm = site.toLowerCase();
  if (norm.includes('steam')) {
    return (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .007c-6.617 0-12 5.372-12 11.97a11.885 11.885 0 0 0 6.69 10.61l.076-.297a3.868 3.868 0 0 1-1.396-.75l-3.32-1.78a.332.332 0 0 1-.168-.288v-.025a.33.33 0 0 1 .158-.291l4.095-2.215a3.99 3.99 0 0 1 1.705-2.02l2.368-5.368a4 4 0 1 1 5.96 4.96l-3.32 3.32a3.99 3.99 0 0 1-1.92.84l-1.69 5.56a.33.33 0 0 1-.328.232c-.085 0-.17-.035-.23-.095l-1.1-2.51a3.97 3.97 0 0 1-.756-1.348l-3.7-1.98z" />
      </svg>
    );
  }
  if (norm.includes('playstation')) {
    return (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.75 3.5c-3.1 0-5.75 2.1-5.75 4.8 0 .8.2 1.5.7 2.1l1.7-1.3c-.3-.3-.4-.6-.4-.8 0-1.5 1.7-2.6 3.75-2.6 1.8 0 3.3.9 3.7 2.2l1.6-.7c-.8-2.2-3.1-3.7-5.3-3.7zm-2.4 7.6c-1.3.4-2.1 1.2-2.1 2.2 0 1.6 2 2.8 4.5 2.8 1.9 0 3.6-.8 4.2-2l-1.6-.8c-.4.7-1.4 1.2-2.6 1.2-1.6 0-2.8-.7-2.8-1.7 0-.4.2-.7.6-.9l-.9-.8z" />
      </svg>
    );
  }
  if (norm.includes('xbox')) {
    return (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-3.87 0-7-3.13-7-7 0-.74.12-1.45.33-2.12L10 16.5v-3.32l-2.46-2.46c.86-.72 1.95-1.15 3.14-1.21V5.5c2.3.11 4.29 1.45 5.16 3.35L14 11.23V14.5l4.67-4.67c.21.67.33 1.38.33 2.12 0 3.87-3.13 7-7 7z" />
      </svg>
    );
  }
  if (norm.includes('nintendo')) {
    return (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 2a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6h2V2H8zm0 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8-7.5h-2v20h2a6 6 0 0 0 6-6V8a6 6 0 0 0-6-6zm-2 9a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
      </svg>
    );
  }
  // Generic Gamepad
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="3"></rect>
      <path d="M12 12h.01M15 10h.01M8 12H6v-2h2v2zm0 0v2H6v-2h2z"></path>
    </svg>
  );
}

interface TmdbSeasonSummary { id: number; name: string; season_number: number; episode_count: number; }

function getKnownEpisodeCount(node: any, episodeData?: unknown): number | "Unknown" {
  if (typeof node?.episodes === "number" && node.episodes > 0) return node.episodes;
  if (typeof node?.nextAiringEpisode?.episode === "number" && node.nextAiringEpisode.episode > 1) {
    return node.nextAiringEpisode.episode - 1;
  }
  if (Array.isArray(episodeData) && episodeData.length > 0) return episodeData.length;
  if (Array.isArray(node?.streamingEpisodes) && node.streamingEpisodes.length > 0) return node.streamingEpisodes.length;
  return "Unknown";
}

export default async function MediaDetailsPage({ params }: { params: Promise<{ id: string }>; }) {
  const resolvedParams = await params;
  let mediaId = resolvedParams.id;
  
  const parts = mediaId.split('-');
  
  // Intercept and redirect direct links to seasons and episodes (e.g. from profile)
  if (parts.length > 3 && parts[0] === "tmdb" && parts[1] === "tv") {
    if (parts.length === 4 && parts[3].startsWith("s")) {
      redirect(`/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${parts[3].substring(1)}`);
    } else if (parts.length === 5 && parts[3].startsWith("s") && parts[4].startsWith("e")) {
      redirect(`/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${parts[3].substring(1)}/episode/${parts[4].substring(1)}`);
    }
  }

  const provider = parts[0]; 
  
  let mediaDetails = null;
  let rawData: any = null;
  let primaryStaff: any[] = [];
  let secondaryStaff: any[] = [];
  
  if (provider === 'tmdb') {
    const tmdbType = parts[1] as 'movie' | 'tv'; 
    const externalId = parts[2];
    mediaDetails = await getTMDbDetails(externalId, tmdbType);
  } else if (provider === 'rawg' || provider === 'igdb') {
    mediaDetails = await getGameDetails(parts[2]);
    if (mediaDetails) {
      let releaseYear: number | undefined;
      if (mediaDetails.releaseDate && mediaDetails.releaseDate !== 'N/A') {
        const parsedYear = parseInt(mediaDetails.releaseDate.split('-')[0], 10);
        if (!isNaN(parsedYear)) {
          releaseYear = parsedYear;
        }
      }
      const rawgCrew = await getGameCrew(mediaDetails.title, releaseYear);
      const mappedRawgCrew = rawgCrew.map((c: any) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        image: c.imageUrl,
        isCompany: false
      }));
      primaryStaff = mappedRawgCrew.filter((c: any) =>
        ['director', 'writer', 'composer'].some(role =>
          c.role.toLowerCase().includes(role)
        )
      );
      secondaryStaff = mappedRawgCrew.filter((c: any) =>
        ['design'].some(role =>
          c.role.toLowerCase().includes(role)
        )
      );
    }
  } else if (provider === 'anilist') {
    const extractedId = parseInt(parts[1]);
    rawData = await getAnilistDetails(extractedId);
    if (!rawData) return notFound();
    
    // Guarantee Master Object exists and enqueue the franchise worker
    const dbMedia = await upsertBaseMedia(rawData);
    
    // Redirect cleanly to the internal CUID!
    redirect(`/media/${dbMedia.id}`);
  } else {
    // Internal Database CUID Resolver
    const localMedia = await prisma.media.findUnique({ 
      where: { id: mediaId },
      include: { 
        seasons: true, 
        inverseRelated: true,
        relatedMedia: {
          include: { seasons: true, inverseRelated: true }
        }
      }
    });
    if (!localMedia || !localMedia.anilistId) return notFound();
    
    rawData = await getAnilistDetails(localMedia.anilistId);
    if (!rawData) return notFound();
    
    // Aggregation Logic: Collect blobs from root, canon seasons, and canon movies
    const aggregatedStaff = [localMedia.staffData || rawData.staff];
    const aggregatedCast = [localMedia.castData];
    const aggregatedStudio = [localMedia.studioData];

    if (localMedia.seasons) {
      for (const s of localMedia.seasons) {
        if (s.staffData) aggregatedStaff.push(s.staffData);
        if (s.castData) aggregatedCast.push(s.castData);
        if (s.studioData) aggregatedStudio.push(s.studioData);
      }
    }
    if (localMedia.inverseRelated) {
      for (const rel of localMedia.inverseRelated) {
        if (rel.isMainStoryline) {
          if (rel.staffData) aggregatedStaff.push(rel.staffData);
          if (rel.castData) aggregatedCast.push(rel.castData);
          if (rel.studioData) aggregatedStudio.push(rel.studioData);
        }
      }
    }

    mediaDetails = {
      id: localMedia.id,
      title: localMedia.title || rawData.title?.english || rawData.title?.romaji || "Unknown Title",
      type: localMedia.type.toLowerCase(),
      image: rawData.coverImage?.extraLarge || rawData.coverImage?.large || null,
      backdrop: rawData.bannerImage || null,
      description: rawData.description,
      releaseDate: localMedia.releaseDate || (rawData.startDate?.year ? `${rawData.startDate.year}-${String(rawData.startDate.month || 1).padStart(2, '0')}-${String(rawData.startDate.day || 1).padStart(2, '0')}` : null),
      globalScore: rawData.averageScore ? rawData.averageScore : 0,
      runtime: rawData.duration,
      genres: [],
      trailerUrl: rawData.trailer?.site === "youtube" ? `https://www.youtube.com/embed/${rawData.trailer.id}` : null,
      streamingLinks: (() => {
        const seen = new Set();
        return (rawData.externalLinks || [])
          .filter((link: any) => link.type === "STREAMING")
          .filter((link: any) => {
            if (!link.site) return false;
            if (seen.has(link.site)) return false;
            seen.add(link.site);
            return true;
          });
      })(),
      cast: [],
      seasons: null,
      credits: getMasterCrew(aggregatedStaff),
      castData: getMasterCast(aggregatedCast),
      studioData: getMasterStudios(aggregatedStudio),
      localDbMedia: localMedia,
      chapters: rawData.chapters || null,
      volumes: rawData.volumes || null,
      status: rawData.status || null,
      mangadexId: localMedia.mangadexId || rawData.mangadexId || null
    };
  }

  if (!mediaDetails) return notFound();

  if (provider === 'rawg' || provider === 'igdb') {
    // Already populated from getGameCrew
  } else if (Array.isArray(mediaDetails.credits)) {
    primaryStaff = mediaDetails.credits.filter((c: any) => ['Director', 'Writer', 'Creator', 'Original Creator', 'Series Composition', 'Developer'].includes(c.role));
    secondaryStaff = mediaDetails.credits.filter((c: any) => !['Director', 'Writer', 'Creator', 'Original Creator', 'Series Composition', 'Developer'].includes(c.role));
  } else {
    primaryStaff = mediaDetails.credits?.primary || [];
    secondaryStaff = mediaDetails.credits?.secondary || [];
  }

  const mediaTypeKey = (mediaDetails.type as "game" | "movie" | "show" | "manga") || "movie";

  const [stats, placementRank, globalData, reviews] = await Promise.all([
    getMediaStats(mediaId),
    getListRank(mediaId),
    getDeepCriteriaRows(mediaId),
    prisma.userRating.findMany({
      where: { media_id: mediaId, review_text: { not: null } },
      select: { score: true, review_text: true, username: true, avatar_url: true, created_at: true },
      orderBy: { created_at: "desc" },
    })
  ]);

  const localDbMedia = mediaDetails.localDbMedia;

  const globalCriteriaAverages = calculateCriteriaAverages(globalData);

  const franchiseRoot = localDbMedia?.relatedMedia || localDbMedia;
  let anilistSeasonNodes: any[] = [];
  if (franchiseRoot && franchiseRoot.anilistId) {
    const rawSeasons = franchiseRoot.seasons || [];
    const seasonAnilistIds = rawSeasons.map((s: any) => s.anilistId).filter(Boolean) as number[];
    if (seasonAnilistIds.length > 0) {
      const { fetchAnilistNodes } = await import('@/lib/anilist');
      anilistSeasonNodes = await fetchAnilistNodes(seasonAnilistIds);
    }
  }

  const seasonStatsMap: Record<string, number> = {};
  const seasonRankMap: Record<string, number> = {};
  
  if (mediaTypeKey === "show" && mediaDetails.seasons) {
    const seasonIds = (mediaDetails.seasons as TmdbSeasonSummary[]).map((s) => `${mediaId}-s${s.season_number}`);
    const [sStats, sRanks] = await Promise.all([
      getMediaStatsMap(seasonIds),
      getListRankMap(seasonIds),
    ]);
    Object.assign(seasonStatsMap, sStats);
    Object.assign(seasonRankMap, sRanks);
  }

  const getPlatformName = (type: string) => {
    if (type === 'movie' || type === 'show') return 'TMDb Score';
    if (type === 'game') return 'Metacritic';
    if (type === 'manga') return 'MyAnimeList';
    return 'Global Score';
  };

  const activeCriteriaConfig = CRITERIA_CONFIG[mediaTypeKey] || [];

  let timelineItems: any[] = [];
  let spinoffItems: any[] = [];
  const isSyncing = !!(franchiseRoot && franchiseRoot.anilistId && !franchiseRoot.franchiseSyncedAt);
  const isCanonMovie = !!localDbMedia?.relatedMediaId && mediaTypeKey === "movie";
  
  if (franchiseRoot) {
    if (mediaTypeKey === 'manga') {
      const mangaNodes: any[] = [];
      if (franchiseRoot.type === 'MANGA') {
        mangaNodes.push(franchiseRoot);
      }
      const relatedSpinoffs = franchiseRoot.inverseRelated?.filter((m: any) => m.type === 'MANGA') || [];
      mangaNodes.push(...relatedSpinoffs);
      
      const otherMangaNodes = mangaNodes.filter((m: any) => m.id !== localDbMedia.id);
      
      spinoffItems = otherMangaNodes.map((m: any) => {
        const directRelation = rawData?.relations?.edges?.find((edge: any) => edge.node.id === m.anilistId);
        
        let label = "Related";
        if (directRelation) {
          const relType = directRelation.relationType;
          if (relType === 'PREQUEL') label = "Prequel";
          else if (relType === 'SEQUEL') label = "Sequel";
          else if (relType === 'SPIN_OFF') label = "Spin-off";
          else if (relType === 'SIDE_STORY') label = "Side Story";
          else if (relType === 'ALTERNATIVE') label = "Alternative";
          else if (relType === 'SUMMARY') label = "Summary";
          else if (relType === 'PARENT') label = "Parent";
          else label = relType.replace('_', ' ').toLowerCase();
        } else if (m.id === franchiseRoot.id) {
          label = "Parent";
        }
        
        return {
          ...m,
          relationLabel: label
        };
      });
    } else {
      const rawSeasons = franchiseRoot.seasons || [];
      const rawCanonMovies = franchiseRoot.inverseRelated?.filter((m: any) => m.isMainStoryline === true && m.type === 'MOVIE') || [];
      
      // For timeline parsing, we want the title of the franchise root
      const timelineRootTitle = franchiseRoot.title || mediaDetails.title;
      
      timelineItems = [
        {
          id: franchiseRoot.id,
          title: timelineRootTitle,
          episode_count: getKnownEpisodeCount(rawData, franchiseRoot.episodeData),
          _sortTime: franchiseRoot.releaseDate ? new Date(franchiseRoot.releaseDate).getTime() : 0,
          link: `/media/${franchiseRoot.id}/season/${franchiseRoot.anilistId}`,
          isMovie: false,
          statId: `${franchiseRoot.id}-s${franchiseRoot.anilistId}`,
        },
        ...rawSeasons.map((s: any, idx: number) => {
          let nodeTitle = `Season ${idx + 2}`;
          let nodeEpisodes: number | string = 'Unknown';
          
          const fetchedNode = anilistSeasonNodes.find((n: any) => n.id === s.anilistId);
          if (fetchedNode && (fetchedNode.title?.english || fetchedNode.title?.romaji)) {
            nodeTitle = fetchedNode.title.english || fetchedNode.title.romaji;
            nodeEpisodes = getKnownEpisodeCount(fetchedNode, s.episodeData);
          } else if (Array.isArray(s.episodeData) && s.episodeData.length > 0) {
            nodeEpisodes = s.episodeData.length;
          }

          return {
            id: s.id,
            title: nodeTitle,
            episode_count: nodeEpisodes,
            _sortTime: s.releaseDate ? new Date(s.releaseDate).getTime() : Infinity,
            link: `/media/${franchiseRoot.id}/season/${s.anilistId || idx + 1}`,
            isMovie: false,
            statId: `${franchiseRoot.id}-s${s.anilistId || idx + 1}`,
          };
        }),
        ...rawCanonMovies.map((m: any) => ({
          id: m.id,
          title: m.title || `Canon Movie`,
          episode_count: 'Feature',
          _sortTime: m.releaseDate ? new Date(m.releaseDate).getTime() : Infinity,
          link: `/media/${m.id}`,
          isMovie: true,
          statId: m.id,
        }))
      ];

      timelineItems.sort((a, b) => a._sortTime - b._sortTime);
      spinoffItems = franchiseRoot.inverseRelated?.filter((m: any) => m.isMainStoryline === false) || [];
    }
  } else if (mediaDetails.type === "show" && mediaDetails.seasons) {
    timelineItems = (mediaDetails.seasons as any[]).filter((s) => s.season_number > 0).map((s) => ({
      id: s.id.toString(),
      title: s.name,
      episode_count: s.episode_count,
      _sortTime: Infinity,
      link: `/media/${mediaId}/season/${s.season_number}`,
      isMovie: false,
      statId: `${mediaId}-s${s.season_number}`,
    }));
  }

  let totalEpisodes = 0;
  let totalMovies = 0;
  let totalRelated = 0;

  if (mediaDetails.type === "show") {
    if (provider === "tmdb" && mediaDetails.seasons) {
      totalEpisodes = (mediaDetails.seasons as any[]).filter(s => s.season_number > 0).reduce((sum, s) => sum + (s.episode_count || 0), 0);
    } else if (timelineItems.length > 0) {
      totalEpisodes = timelineItems.filter(i => !i.isMovie).reduce((sum, item) => sum + (typeof item.episode_count === 'number' ? item.episode_count : 0), 0);
      totalMovies = timelineItems.filter(i => i.isMovie).length;
      totalRelated = spinoffItems.length;
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24">
      {mediaDetails.backdrop && (
        <>
          <div className="absolute top-0 left-0 w-full h-[60vh] opacity-20 bg-cover bg-center" style={{ backgroundImage: `url(${mediaDetails.backdrop})` }} />
          <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-t from-gray-950 to-transparent" />
        </>
      )}
      
      <div className="max-w-7xl mx-auto px-8 pt-24 relative z-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-8 inline-block font-semibold">← Back to Search</Link>
        
        <div className="flex flex-col md:flex-row gap-10 mb-16">
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 space-y-6">
            {mediaDetails.image ? (
              <img src={mediaDetails.image} alt={mediaDetails.title} className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-gray-800" />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">No Image</div>
            )}
            <RatingSlider mediaId={mediaId} mediaType={mediaTypeKey} mediaTitle={mediaDetails.title} mediaImage={mediaDetails.image} mediaReleaseDate={mediaDetails.releaseDate} />

            {/* WHERE TO WATCH */}
            {mediaDetails.streamingLinks && mediaDetails.streamingLinks.length > 0 && (
              <div className="mt-4 bg-gray-950/50 p-5 rounded-2xl border border-gray-800 shadow-xl">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">
                  {mediaTypeKey === 'manga' ? 'Where to Read' : 'Where to Watch'}
                </h3>
                <div className="flex flex-col gap-3">
                  {mediaDetails.streamingLinks.map((link: any) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 p-3 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors">
                      {link.icon ? <img src={link.icon} className="w-6 h-6 object-contain" /> : <div className="w-6 h-6 bg-gray-800 rounded-full"></div>}
                      <span className="font-bold text-gray-200 text-sm" style={{ color: link.color || '#fff' }}>{link.site}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* WHERE TO PLAY */}
            {mediaTypeKey === 'game' && mediaDetails.playLinks && mediaDetails.playLinks.length > 0 && (
              <div className="mt-4 bg-gray-950/50 p-5 rounded-2xl border border-gray-800 shadow-xl">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Where to Play</h3>
                <div className="flex flex-col gap-3">
                  {mediaDetails.playLinks.map((link: any) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 p-3 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors">
                      {getStoreIcon(link.site)}
                      <span className="font-bold text-gray-200 text-sm" style={{ color: link.color || '#fff' }}>{link.site}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h1 className="text-4xl sm:text-5xl font-black text-white">
                {mediaDetails.title}
              </h1>
              
              <WatchlistButton 
                mediaId={mediaDetails.id} 
                title={mediaDetails.title} 
                image={mediaDetails.image} 
                type={mediaDetails.type} 
              />
            </div>

            <WatchProviders watchData={localDbMedia?.watchData} />
            {(mediaDetails.type === 'movie' || mediaDetails.type === 'anime') && (
              <AnimeThemes themeData={localDbMedia?.themeData} />
            )}

            {/* NEW METADATA ROW */}
            <div className="flex flex-wrap items-center gap-3 mt-3 mb-4">
              {mediaDetails.releaseDate && (
                <span className="text-gray-300 font-bold text-sm">
                  {mediaDetails.releaseDate.split('-')[0]}
                </span>
              )}
              
              {isSyncing && mediaTypeKey !== "manga" ? (
                <>
                  <span className="text-gray-600 hidden sm:inline">•</span>
                  <div className="flex gap-2">
                    <div className="h-6 w-24 bg-gray-800 rounded-full animate-pulse"></div>
                    <div className="h-6 w-20 bg-gray-800 rounded-full animate-pulse"></div>
                    <div className="h-6 w-24 bg-gray-800 rounded-full animate-pulse"></div>
                  </div>
                </>
              ) : (
                <>
                  {mediaDetails.type === "show" && totalEpisodes > 0 && (
                    <>
                      <span className="text-gray-600 hidden sm:inline">•</span>
                      <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                        {totalEpisodes} episodes
                      </span>
                    </>
                  )}

                  {totalMovies > 0 && (
                    <>
                      <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                        {totalMovies} {totalMovies === 1 ? 'movie' : 'movies'}
                      </span>
                    </>
                  )}

                  {totalRelated > 0 && (
                    <>
                      <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                        {totalRelated} related
                      </span>
                    </>
                  )}

                  {mediaTypeKey === "manga" && (
                    <MangaMetadataPills
                      mangadexId={mediaDetails.mangadexId}
                      initialChapters={mediaDetails.chapters}
                      initialVolumes={mediaDetails.volumes}
                      status={mediaDetails.status}
                    />
                  )}
                </>
              )}

              {mediaDetails.runtime && (
                <>
                  <span className="text-gray-600 hidden sm:inline">•</span>
                  <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                    {mediaDetails.type === "show" ? `Avg ep ${mediaDetails.runtime} min` : `${mediaDetails.runtime} min`}
                  </span>
                </>
              )}
            </div>

            {/* DEVELOPERS & PUBLISHERS FOR GAMES */}
            {mediaTypeKey === 'game' && mediaDetails.companies && (
              <>
                {mediaDetails.companies.filter((c: any) => c.isDeveloper).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[10px] text-blue-500 uppercase tracking-widest font-black self-center mr-2">Developer</span>
                    {mediaDetails.companies.filter((c: any) => c.isDeveloper).map((dev: any, idx: number, arr: any[]) => (
                      <span key={dev.id} className="flex gap-2 items-center">
                        <Link href={`/company/${dev.id}`} className="text-sm font-bold text-gray-200 hover:text-blue-400 transition-colors">
                          {dev.name}
                        </Link>
                        {idx < arr.length - 1 && <span className="text-gray-600 text-xs font-black">•</span>}
                      </span>
                    ))}
                  </div>
                )}
                {mediaDetails.companies.filter((c: any) => c.isPublisher).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[10px] text-blue-500 uppercase tracking-widest font-black self-center mr-2">Publisher</span>
                    {mediaDetails.companies.filter((c: any) => c.isPublisher).map((pub: any, idx: number, arr: any[]) => (
                      <span key={pub.id} className="flex gap-2 items-center">
                        <Link href={`/company/${pub.id}`} className="text-sm font-bold text-gray-200 hover:text-blue-400 transition-colors">
                          {pub.name}
                        </Link>
                        {idx < arr.length - 1 && <span className="text-gray-600 text-xs font-black">•</span>}
                      </span>
                    ))}
                  </div>
                )}
                {mediaDetails.engines && mediaDetails.engines.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[10px] text-blue-500 uppercase tracking-widest font-black self-center mr-2">Engine</span>
                    {mediaDetails.engines.map((eng: string, idx: number, arr: string[]) => (
                      <span key={eng} className="flex gap-2 items-center">
                        <span className="text-sm font-bold text-gray-200">{eng}</span>
                        {idx < arr.length - 1 && <span className="text-gray-600 text-xs font-black">•</span>}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* STUDIOS ROW */}
            {mediaDetails.studioData && mediaDetails.studioData.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[10px] text-blue-500 uppercase tracking-widest font-black self-center mr-2">Studio</span>
                {mediaDetails.studioData.map((s: any, i: number, arr: any[]) => (
                  <span key={s.id || s} className="flex gap-2 items-center">
                    {s.id ? (
                      <Link href={`/company/${s.id.toString().includes('-') ? s.id : `anilist-${s.id}`}`} className="text-sm font-bold text-gray-200 hover:text-blue-400 transition-colors">
                        {s.name || s}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-gray-200">{s.name || s}</span>
                    )}
                    {i < arr.length - 1 && <span className="text-gray-600 text-xs font-black">•</span>}
                  </span>
                ))}
              </div>
            )}

            {/* DYNAMIC CREW GRID */}
            {isSyncing && mediaTypeKey !== "manga" ? (
              <div className="flex flex-wrap gap-x-10 gap-y-6 py-5 border-y border-gray-800/60 mb-6 mt-8">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="h-3 w-16 bg-gray-800 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-gray-800 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : (
              <StaffGrid 
                primaryStaff={primaryStaff} 
                secondaryStaff={secondaryStaff} 
              />
            )}
            <ExpandableText text={mediaDetails.description} maxLength={300} />
            
            <div className="flex flex-wrap gap-8 border-y border-gray-800 py-6 mb-8 mt-8 bg-gray-950/50 rounded-xl px-6">
              <div className="shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Community Score</p>
                <p className={`text-4xl font-extrabold ${getScoreColor(stats?.community_average)}`}>
                  {stats?.community_average ? `${stats.community_average}%` : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{stats?.total_ratings || 0} ratings</p>
              </div>
              <div className="w-px bg-gray-800 hidden sm:block"></div>

              <div className="shrink-0">
                <p className="text-xs text-blue-500 uppercase tracking-widest font-bold mb-1">List Rank</p>
                <p className="text-4xl font-extrabold text-white">
                  {placementRank ? `#${placementRank}` : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-1 uppercase">Global {mediaTypeKey}</p>
              </div>
              
              {activeCriteriaConfig.length > 0 && Object.keys(globalCriteriaAverages).length > 0 && (
                <>
                  <div className="w-px bg-gray-800 hidden lg:block"></div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Global Deep Review</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {activeCriteriaConfig.map((item) => {
                        const score = globalCriteriaAverages[item.key];
                        if (score === undefined) return null;
                        return (
                          <div key={item.key} className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 font-medium">{item.label}</span>
                            <span className={`font-black ${getScoreColor(score)}`}>{score}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* TIMELINE SECTION */}
            {!isCanonMovie && (
              <div className="mt-12 space-y-12">
                {mediaTypeKey === 'manga' ? (
                  <div className="mt-12">
                    <h2 className="text-3xl font-bold mb-8">Chapters</h2>
                    {mediaDetails.mangadexId ? (
                      <MangaChapters mangadexId={mediaDetails.mangadexId} totalChapters={mediaDetails.chapters} />
                    ) : isSyncing ? (
                      <MangaChaptersLoader mediaId={localDbMedia.id} />
                    ) : (
                      <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                        <p className="text-gray-400">No English chapters found for this manga on MangaDex.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  (timelineItems.length > 0 || isSyncing) && (
                    <div>
                      <h2 className="text-3xl font-bold mb-8">Narrative Timeline</h2>
                      {isSyncing ? (
                        <SyncLoader mediaId={localDbMedia.id} />
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {timelineItems.map((item) => {
                          const cScore = seasonStatsMap[item.statId];
                          const gRank = seasonRankMap[item.statId];

                          return (
                            <Link key={item.id} href={item.link} className="bg-gray-900 p-5 rounded-xl border border-gray-800 hover:border-blue-500 hover:bg-gray-800/80 transition-colors text-center block relative overflow-hidden group">
                              <div className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded border ${cScore ? (cScore >= 75 ? 'bg-green-900/40 text-green-400 border-green-800/50' : cScore >= 50 ? 'bg-blue-900/40 text-blue-400 border-blue-800/50' : 'bg-gray-800 text-gray-400 border-gray-700') : 'bg-gray-950 text-gray-600 border-gray-800'}`}>
                                ★ {cScore || 'N/A'}
                              </div>
                              <div className={`absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded border ${gRank ? 'bg-blue-900/80 text-blue-400 border-blue-500' : 'bg-gray-900/80 text-gray-500 border-gray-700'}`}>
                                {gRank ? `#${gRank}` : '# -'}
                              </div>
                              <p className="font-bold text-lg mt-3">{item.title}</p>
                              <p className="text-sm text-gray-400 mt-1">{item.episode_count === 'Feature' ? 'Canon Movie' : `${item.episode_count} Episodes`}</p>
                            </Link>
                          );
                        })}
                        </div>
                      )}
                    </div>
                  )
                )}

                  {mediaTypeKey === 'manga' ? (
                    isSyncing ? (
                      <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-400">Related</h2>
                        <SyncLoader 
                          mediaId={localDbMedia.id}
                          title="Syncing Related Media..."
                          description="We are currently building the franchise tree for this manga to show all related prequels, sequels, and spin-offs. They will appear here automatically in just a moment!"
                        />
                      </div>
                    ) : spinoffItems.length > 0 ? (
                      <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-400">Related</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {spinoffItems.map((m: any) => (
                            <Link key={m.id} href={`/media/${m.id}`} className={`bg-gray-950 p-4 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors block text-center relative pt-8`}>
                              {m.relationLabel && (
                                <div className="absolute top-2 left-2 bg-black/55 border border-gray-800/80 text-gray-400 px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold">
                                  {m.relationLabel}
                                </div>
                              )}
                              <p className="font-bold text-sm text-gray-300 line-clamp-2">{m.title || 'Unknown'}</p>
                              <p className="text-xs text-gray-500 mt-2 uppercase font-black">{m.type}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null
                  ) : (
                    !isSyncing && spinoffItems.length > 0 && (
                      <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-400">Related</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {spinoffItems.map((m: any) => (
                            <Link key={m.id} href={`/media/${m.id}`} className="bg-gray-950 p-4 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors block text-center">
                              <p className="font-bold text-sm text-gray-300 line-clamp-2">{m.title || 'Unknown'}</p>
                              <p className="text-xs text-gray-500 mt-2 uppercase font-black">{m.type}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>
        </div>

        {/* RESTORED CAST AND TRAILER SECTION */}
        <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-gray-800">
          {mediaTypeKey === 'game' ? (
            <div className="lg:col-span-2">
              <GameCharacterGrid characters={mediaDetails.characters || []} />
            </div>
          ) : isSyncing && mediaTypeKey !== "manga" ? (
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6 mt-2">Cast</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="flex bg-gray-900 rounded-xl overflow-hidden border border-gray-800 h-24 animate-pulse">
                    <div className="w-16 bg-gray-800"></div>
                    <div className="flex-1 p-3"></div>
                    <div className="w-16 bg-gray-800"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : mediaDetails.castData?.edges?.length > 0 ? (
            <ExpandableAniListCast castData={mediaDetails.castData} mediaType={mediaTypeKey} />
          ) : mediaDetails.cast?.length > 0 ? (
            <ExpandableCast cast={mediaDetails.cast.map((c: any) => ({ ...c, id: `tmdb-${c.id}`, role: c.character }))} />
          ) : null}
          {mediaDetails.trailerUrl && (
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold mb-6">Trailer</h2>
              <div className="w-full aspect-video rounded-xl overflow-hidden shadow-xl shadow-black/50 border border-gray-800">
                <iframe src={mediaDetails.trailerUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
              </div>
            </div>
          )}
        </div>

        {/* RESTORED REVIEWS SECTION */}
        <div className="mt-16 pt-12 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-8">Community Reviews</h2>
          <TextReviewEditor mediaId={mediaId} mediaTitle={mediaDetails.title} mediaImage={mediaDetails.image} />
          
          {!reviews || reviews.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed"><p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p></div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {reviews.map((review: any, index: number) => (
                <div key={index} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                  {review.avatar_url ? ( <img src={review.avatar_url} alt={review.username ?? "Reviewer"} className="w-10 h-10 rounded-full border border-gray-700 object-cover" /> ) : ( <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-500 flex items-center justify-center font-bold text-sm">{review.username?.charAt(0).toUpperCase() || '?'}</div> )}
                      <div><p className="font-bold text-gray-200">{review.username}</p><p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                    </div>
                    <div className={`px-3 py-1 rounded-lg border font-black ${review.score >= 95 ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.3)]' : review.score >= 75 ? 'bg-green-900 border-green-500 text-green-400' : review.score >= 50 ? 'bg-blue-900 border-blue-500 text-blue-400' : review.score >= 25 ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-950 border-gray-800 text-gray-600'}`}>
                      {review.score}%
                    </div>
                  </div>
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap flex-1">&ldquo;{review.review_text}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
