import { prisma } from "@/lib/prisma";
import { fetchAnilistNodeEdges, resolveAniListType } from "@/lib/anilist";
import { MediaType } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

  if (dbRootMedia.type !== MediaType.MANGA) {
    await prisma.media.update({
      where: { id: dbRootMedia.id },
      data: { franchiseSyncedAt: new Date() }
    });
    return;
  }

  // Step 2: Sweep forward using BFS for related Manga
  const queue = [rootAnilistId];
  const visitedForward = new Set<number>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visitedForward.has(currentId)) continue;
    visitedForward.add(currentId);

    const nodeData = await fetchAnilistNodeEdges(currentId);
    if (!nodeData) continue;

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
    
    await prisma.media.updateMany({ where: { anilistId: currentId }, data: mediaUpdatePayload });

    const edges = nodeData.relations?.edges || [];
    for (const edge of edges) {
      const relation = edge.relationType;
      const targetNode = edge.node;
      if (!targetNode) continue;
      
      const targetId = targetNode.id;
      if (visitedForward.has(targetId)) continue;
      
      const targetStructuralType = resolveAniListType(targetNode.format || '', targetNode.episodes, targetNode.duration);
      const isTargetManga = targetStructuralType === 'MANGA';
      
      let targetReleaseDate = null;
      if (targetNode.startDate?.year) {
        targetReleaseDate = `${targetNode.startDate.year}-${String(targetNode.startDate.month || 1).padStart(2, '0')}-${String(targetNode.startDate.day || 1).padStart(2, '0')}`;
      }

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
    }
  }

  // Step 3: Mark the manga franchise as completely synced!
  await prisma.media.update({
    where: { id: dbRootMedia.id },
    data: { franchiseSyncedAt: new Date() }
  });

  try {
    revalidatePath(`/media/${internalMediaId}`);
  } catch (error) {
    console.warn(`[AniList Sync] Could not revalidate /media/${internalMediaId}:`, error);
  }
}
