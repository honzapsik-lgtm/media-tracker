import { prisma } from "@/lib/prisma";
import { fetchAnilistNodeEdges, fetchAnilistNodes, resolveAniListType } from "@/lib/anilist";
import { MediaType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getMapping } from "./mal-sync";
import { getAnimeThemes } from "./jikan";
import { getTMDbSeasonData, getTMDbDetails, searchTMDb } from "./tmdb";

type EpisodeCursor = {
  tmdbSeasonIndex: number;
  episodeOffset: number;
};

function getEpisodeCount(node: any) {
  return node.episodes || (node.nextAiringEpisode ? node.nextAiringEpisode.episode - 1 : 0);
}

function getNodeTimestamp(node: any) {
  return node.startDate?.year
    ? new Date(node.startDate.year, (node.startDate.month || 1) - 1, node.startDate.day || 1).getTime()
    : Infinity;
}

async function resolvePrimaryTmdbId(rootTitle: string, mappedTmdbId: number | null) {
  if (mappedTmdbId) return mappedTmdbId;

  try {
    const titleVariants = Array.from(new Set([
      rootTitle,
      rootTitle.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim(),
      rootTitle.replace(/\s*-\s*TV\s*$/i, "").trim(),
    ].filter(Boolean)));

    for (const titleVariant of titleVariants) {
      const results = await searchTMDb(titleVariant);
      const normalizedVariant = titleVariant.toLowerCase();
      const show = results.find((item: any) => {
        const title = (item.title || "").toLowerCase();
        return item.type === "show"
          && title === normalizedVariant
          && item.originalLanguage === "ja"
          && item.genreIds?.includes(16);
      }) || results.find((item: any) =>
        item.type === "show"
        && item.originalLanguage === "ja"
        && item.genreIds?.includes(16)
      ) || results.find((item: any) => item.type === "show");

      if (show?.id) {
        const parts = show.id.split("-");
        return Number(parts.at(-1)) || null;
      }
    }

    return null;
  } catch (error) {
    console.error(`[TMDb Mapping] Could not resolve TMDb show for ${rootTitle}:`, error);
    return null;
  }
}

async function readTmdbSeasonEpisodes(
  tmdbShowId: number,
  tmdbSeasons: any[],
  seasonCache: Map<number, any[]>,
  cursor: EpisodeCursor,
  requestedCount: number
) {
  const episodes: any[] = [];

  while (episodes.length < requestedCount && cursor.tmdbSeasonIndex < tmdbSeasons.length) {
    const tmdbSeason = tmdbSeasons[cursor.tmdbSeasonIndex];
    let seasonEpisodes = seasonCache.get(tmdbSeason.season_number);

    if (!seasonEpisodes) {
      const loadedEpisodes = (await getTMDbSeasonData(tmdbShowId, tmdbSeason.season_number)) ?? [];
      seasonEpisodes = loadedEpisodes;
      seasonCache.set(tmdbSeason.season_number, loadedEpisodes);
    }

    const availableEpisodes = seasonEpisodes ?? [];
    const remaining = requestedCount - episodes.length;
    const slice = availableEpisodes.slice(cursor.episodeOffset, cursor.episodeOffset + remaining);
    episodes.push(...slice);
    cursor.episodeOffset += slice.length;

    if (cursor.episodeOffset >= availableEpisodes.length || slice.length === 0) {
      cursor.tmdbSeasonIndex++;
      cursor.episodeOffset = 0;
    }
  }

  return episodes.map((ep: any, idx: number) => ({
    ...ep,
    episode_number: idx + 1,
  }));
}

export async function processFranchiseTree(payload: { anilistId: number; internalMediaId: string }) {
  const { anilistId, internalMediaId } = payload;
  
  // Step 1: Traverse backward to find absolute root
  let currentRootAnilistId = anilistId;
  const visitedBackward = new Set<number>();
  
  while (true) {
    if (visitedBackward.has(currentRootAnilistId)) break; // Circular safety
    visitedBackward.add(currentRootAnilistId);
    
    const nodeData = await fetchAnilistNodeEdges(currentRootAnilistId);
    if (!nodeData) break;
    
    const edges = nodeData.relations?.edges || [];
    // Find parent or prequel, with Usurper Protection
    const parentEdge = edges.find((e: any) => {
      if (e.relationType === 'PREQUEL' || e.relationType === 'PARENT') {
        if (e.relationType === 'PARENT' && ['TV', 'TV_SHORT'].includes(nodeData.format || '')) return false;
        if (['TV', 'TV_SHORT'].includes(nodeData.format || '')) {
          if (!['TV', 'TV_SHORT'].includes(e.node?.format || '')) {
            return false;
          }
        }
        return true;
      }
      return false;
    });
    
    if (parentEdge && parentEdge.node) {
      currentRootAnilistId = parentEdge.node.id;
    } else {
      break; // No more parents, we found the root
    }
  }

  const rootAnilistId = currentRootAnilistId;
  const rootData = await fetchAnilistNodeEdges(rootAnilistId);
  if (!rootData) return;
  
  const rootTitle = rootData.title.english || rootData.title.romaji || `AniList ${rootAnilistId}`;
  
  // Format releaseDate as YYYY-MM-DD
  let rootReleaseDate = null;
  if (rootData.startDate?.year) {
    rootReleaseDate = `${rootData.startDate.year}-${String(rootData.startDate.month || 1).padStart(2, '0')}-${String(rootData.startDate.day || 1).padStart(2, '0')}`;
  }
  
  const structuralType = resolveAniListType(rootData.format || '', rootData.episodes, rootData.duration);
  let rootMediaType: MediaType = MediaType.OTHER;
  if (structuralType === 'SERIALIZED') rootMediaType = MediaType.SHOW;
  else if (structuralType === 'FEATURE') rootMediaType = MediaType.MOVIE;
  else if (structuralType === 'MANGA') rootMediaType = MediaType.MANGA;

  let rootMangadexId = rootData.mangadexId || null;
  if (rootMangadexId) {
    const existingWithMangaDex = await prisma.media.findFirst({
      where: {
        mangadexId: rootMangadexId,
        NOT: { anilistId: rootAnilistId }
      }
    });
    if (existingWithMangaDex) {
      rootMangadexId = null;
    }
  }

  const dbRootMedia = await prisma.media.upsert({
    where: { anilistId: rootAnilistId },
    update: { 
      title: rootTitle, 
      isMainStoryline: true, 
      releaseDate: rootReleaseDate,
      type: rootMediaType,
      staffData: rootData.staff || {},
      castData: rootData.characters || {},
      studioData: rootData.studios || {},
      mangadexId: rootMangadexId,
    },
    create: {
      anilistId: rootAnilistId,
      title: rootTitle,
      type: rootMediaType, 
      isMainStoryline: true,
      releaseDate: rootReleaseDate,
      staffData: rootData.staff || {},
      castData: rootData.characters || {},
      studioData: rootData.studios || {},
      mangadexId: rootMangadexId,
    }
  });
  // Step 2: Sweep forward using BFS
  const queue = [rootAnilistId];
  const visitedForward = new Set<number>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visitedForward.has(currentId)) continue;
    visitedForward.add(currentId);

    const nodeData = await fetchAnilistNodeEdges(currentId);
    if (!nodeData) continue;

    // Save the rich metadata for this node if it exists in either table
    let nodeMangadexId = nodeData.mangadexId || null;
    if (nodeMangadexId) {
      const existingWithMangaDex = await prisma.media.findFirst({
        where: {
          mangadexId: nodeMangadexId,
          NOT: { anilistId: currentId }
        }
      });
      if (existingWithMangaDex) {
        nodeMangadexId = null;
      }
    }

    const mediaUpdatePayload = {
      staffData: nodeData.staff || {},
      castData: nodeData.characters || {},
      studioData: nodeData.studios || {},
      mangadexId: nodeMangadexId,
    };
    
    const seasonUpdatePayload = {
      staffData: nodeData.staff || {},
      castData: nodeData.characters || {},
      studioData: nodeData.studios || {},
    };
    
    await prisma.media.updateMany({ where: { anilistId: currentId }, data: mediaUpdatePayload });
    await prisma.season.updateMany({ where: { anilistId: currentId }, data: seasonUpdatePayload });

    const edges = nodeData.relations?.edges || [];
    for (const edge of edges) {
      const relation = edge.relationType;
      const targetNode = edge.node;
      if (!targetNode) continue;
      
      const targetId = targetNode.id;
      // DO NOT skip if already visited here because we might need to process it. 
      // But we prevent infinite queue by checking before adding, or in the shift.
      if (visitedForward.has(targetId)) continue;
      
      // We will check if it's already in the queue to optimize, but visitedForward check is sufficient.
      
      const targetStructuralType = resolveAniListType(targetNode.format || '', targetNode.episodes, targetNode.duration);
      const isTargetManga = targetStructuralType === 'MANGA';
      // We strictly DO NOT follow 'CHARACTER' or 'OTHER' edges to prevent massive Kodansha/Isekai crossover graph explosions!
      const isSpinOffEdge = ['SPIN_OFF', 'SIDE_STORY', 'SUMMARY', 'ALTERNATIVE'].includes(relation);
      const isCanonMovie = targetStructuralType === 'FEATURE' && ['SEQUEL', 'PREQUEL'].includes(relation);
      const isSerializedBranch = ['SERIALIZED'].includes(targetStructuralType) && ['SEQUEL', 'PREQUEL'].includes(relation);
      
      const targetFormat = targetNode.format || '';
      const isSerializedSpinOff = targetStructuralType === 'SERIALIZED' && ['OVA', 'SPECIAL'].includes(targetFormat);
      
      let targetReleaseDate = null;
      if (targetNode.startDate?.year) {
        targetReleaseDate = `${targetNode.startDate.year}-${String(targetNode.startDate.month || 1).padStart(2, '0')}-${String(targetNode.startDate.day || 1).padStart(2, '0')}`;
      }

      if (dbRootMedia.type === MediaType.MANGA) {
        // Manga Specific Sync Logic: Upsert manga nodes as standalone Media, link to root, and add to queue
        if (isTargetManga && ['SEQUEL', 'PREQUEL', 'PARENT', 'SPIN_OFF', 'SIDE_STORY', 'ALTERNATIVE', 'SUMMARY'].includes(relation)) {
          await prisma.media.upsert({
            where: { anilistId: targetId },
            update: { 
              relatedMediaId: dbRootMedia.id,
              isMainStoryline: true,
              type: MediaType.MANGA,
              releaseDate: targetReleaseDate
            },
            create: {
              anilistId: targetId,
              title: targetNode.title.english || targetNode.title.romaji || `AniList ${targetId}`,
              type: MediaType.MANGA,
              relatedMediaId: dbRootMedia.id,
              isMainStoryline: true,
              releaseDate: targetReleaseDate
            }
          });
          queue.push(targetId);
        }
        continue;
      }

      if (isSpinOffEdge || isSerializedSpinOff) {
        // Prevent re-adding a Canon Season as a Spinoff if it was already processed as a SEQUEL/PREQUEL
        const existingSeason = await prisma.season.findUnique({ where: { anilistId: targetId } });
        if (existingSeason) continue;

        // Prevent downgrading a Canon Movie to a Spinoff
        const existingMedia = await prisma.media.findUnique({ where: { anilistId: targetId } });
        if (existingMedia && existingMedia.isMainStoryline) continue;

        let type: MediaType = MediaType.OTHER;
        if (targetStructuralType === 'FEATURE') type = MediaType.MOVIE;
        else if (targetStructuralType === 'MANGA') type = MediaType.MANGA;
        else if (targetStructuralType === 'SERIALIZED') type = MediaType.SHOW;
        
        await prisma.media.upsert({
          where: { anilistId: targetId },
          update: { 
            relatedMediaId: dbRootMedia.id,
            isMainStoryline: false,
            type,
            releaseDate: targetReleaseDate
          },
          create: {
            anilistId: targetId,
            title: targetNode.title.english || targetNode.title.romaji || `AniList ${targetId}`,
            type,
            relatedMediaId: dbRootMedia.id,
            isMainStoryline: false,
            releaseDate: targetReleaseDate
          }
        });
        // We DO NOT push targetId to the queue here! We don't want to crawl down spin-off trees.
      } else if (isCanonMovie) {
        await prisma.media.upsert({
          where: { anilistId: targetId },
          update: { 
            relatedMediaId: dbRootMedia.id,
            isMainStoryline: true,
            type: MediaType.MOVIE,
            releaseDate: targetReleaseDate
          },
          create: {
            anilistId: targetId,
            title: targetNode.title.english || targetNode.title.romaji || `AniList ${targetId}`,
            type: MediaType.MOVIE,
            relatedMediaId: dbRootMedia.id,
            isMainStoryline: true,
            releaseDate: targetReleaseDate
          }
        });
        queue.push(targetId);
      } else if (isSerializedBranch && relation === 'SEQUEL' && !isSerializedSpinOff) {
        await prisma.season.upsert({
          where: { anilistId: targetId },
          update: { mediaId: dbRootMedia.id, releaseDate: targetReleaseDate },
          create: {
            anilistId: targetId,
            mediaId: dbRootMedia.id,
            releaseDate: targetReleaseDate
          }
        });
        
        // Remove Media row if optimistically created by UI
        if (targetId !== rootAnilistId) {
          try {
             // We use deleteMany so it doesn't throw if not found
             await prisma.media.deleteMany({ where: { anilistId: targetId } });
          } catch(e) {}
        }
        
        queue.push(targetId);
      } else if (relation === 'SEQUEL' || relation === 'PREQUEL' || relation === 'PARENT') {
         // Follow other main timeline nodes
         queue.push(targetId);
      }
    }
  }

  // Step 3: Mark the franchise as completely synced!
  await prisma.media.update({
    where: { id: dbRootMedia.id },
    data: { franchiseSyncedAt: new Date() }
  });

  // Step 4: Execute Cross-Pollination Engine
  const seasons = await prisma.season.findMany({ where: { mediaId: dbRootMedia.id } });
  const allNodes = [
    { type: 'media', id: dbRootMedia.id, anilistId: dbRootMedia.anilistId },
    ...seasons.map(s => ({ type: 'season', id: s.id, anilistId: s.anilistId }))
  ];

  const anilistIdsToFetch = allNodes.map(n => n.anilistId).filter(Boolean) as number[];
  const anilistNodeData = await fetchAnilistNodes(anilistIdsToFetch);

  // Step 4.1: Pre-fetch mappings and determine primary TMDB ID
  const mappings = new Map();
  let primaryTmdbId: number | null = null;
  for (const node of allNodes) {
    if (!node.anilistId) continue;
    const mapping = await getMapping(node.anilistId);
    mappings.set(node.anilistId, mapping);
    if (!primaryTmdbId && mapping.tmdbId) {
      primaryTmdbId = mapping.tmdbId;
    }
  }
  primaryTmdbId = await resolvePrimaryTmdbId(rootTitle, primaryTmdbId);

  // Step 4.2: Map Episode Data using Offsets
  const nodeEpisodeDataMap = new Map(); // anilistId -> episodeData array
  if (primaryTmdbId && dbRootMedia.type !== MediaType.MOVIE && dbRootMedia.type !== MediaType.MANGA) {
    const tmdbShow = await getTMDbDetails(primaryTmdbId.toString(), 'tv');
    if (tmdbShow && tmdbShow.seasons) {
      const tvNodes = anilistNodeData.filter((n: any) => 
        ['TV', 'TV_SHORT', 'ONA'].includes(n.format)
      ).sort((a: any, b: any) => getNodeTimestamp(a) - getNodeTimestamp(b));

      const tmdbSeasons = tmdbShow.seasons
        .filter((s: any) => s.season_number > 0)
        .sort((a: any, b: any) => a.season_number - b.season_number);

      const cursor: EpisodeCursor = { tmdbSeasonIndex: 0, episodeOffset: 0 };
      const seasonCache = new Map<number, any[]>();

      for (const aNode of tvNodes) {
        if (cursor.tmdbSeasonIndex >= tmdbSeasons.length) break;

        const anilistEpisodeCount = getEpisodeCount(aNode);
        const mapping = mappings.get(aNode.id);

        if (mapping?.episodeStart && mapping.episodeStart > 1) {
          cursor.episodeOffset = mapping.episodeStart - 1;
        }

        if (anilistEpisodeCount > 0) {
          const mappedChunk = await readTmdbSeasonEpisodes(
            primaryTmdbId,
            tmdbSeasons,
            seasonCache,
            cursor,
            anilistEpisodeCount
          );

          if (mappedChunk.length > 0) {
            nodeEpisodeDataMap.set(aNode.id, mappedChunk);
          }
        }
      }
    }
  }

  // Step 4.3: Process each node and apply themes/episode data
  for (const node of allNodes) {
    if (!node.anilistId) continue;
    
    const mapping = mappings.get(node.anilistId);
    const aNode = anilistNodeData.find((n: any) => n.id === node.anilistId);
    const idMal = aNode?.idMal || mapping.malId || null;

    if (!mapping.tmdbId && !idMal) continue;

    let themes = null;
    if (idMal && dbRootMedia.type !== MediaType.MANGA && dbRootMedia.type !== MediaType.GAME) {
      try {
        themes = await getAnimeThemes(idMal);
      } catch (error) {
        console.error(`[Jikan] Error fetching themes for MAL ID ${idMal}:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const chunkedEpisodes = nodeEpisodeDataMap.get(node.anilistId);

    if (node.type === 'media') {
      const updateData: any = {};
      if (idMal) {
        const existing = await prisma.media.findFirst({
          where: { malId: idMal, NOT: { id: node.id } }
        });
        if (!existing) {
          updateData.malId = idMal;
        }
      }
      if (mapping.tmdbId || primaryTmdbId) {
        const val = mapping.tmdbId || primaryTmdbId;
        const existing = await prisma.media.findFirst({
          where: { tmdbId: val, NOT: { id: node.id } }
        });
        if (!existing) {
          updateData.tmdbId = val;
        }
      }
      if (themes) updateData.themeData = themes;
      if (chunkedEpisodes) updateData.episodeData = chunkedEpisodes;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.media.update({ where: { id: node.id }, data: updateData });
      }
    } else if (node.type === 'season') {
      const updateData: any = {};
      if (mapping.tmdbId) updateData.tmdbId = mapping.tmdbId;
      if (themes) updateData.themeData = themes;
      if (chunkedEpisodes) updateData.episodeData = chunkedEpisodes;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.season.update({ where: { id: node.id }, data: updateData });
      }
    }
  }

  try {
    revalidatePath(`/media/${internalMediaId}`);
  } catch (error) {
    console.warn(`[AniList Sync] Could not revalidate /media/${internalMediaId}:`, error);
  }
}
