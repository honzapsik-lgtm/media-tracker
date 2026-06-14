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
  
  const dbRootMedia = await prisma.media.upsert({
    where: { anilistId: rootAnilistId },
    update: { 
      title: rootTitle, 
      isMainStoryline: true, 
      releaseDate: rootReleaseDate,
      staffData: rootData.staff || {},
      castData: rootData.characters || {},
      studioData: rootData.studios || {},
    },
    create: {
      anilistId: rootAnilistId,
      title: rootTitle,
      type: MediaType.SHOW, 
      isMainStoryline: true,
      releaseDate: rootReleaseDate,
      staffData: rootData.staff || {},
      castData: rootData.characters || {},
      studioData: rootData.studios || {},
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
    const updatePayload = {
      staffData: nodeData.staff || {},
      castData: nodeData.characters || {},
      studioData: nodeData.studios || {},
    };
    
    await prisma.media.updateMany({ where: { anilistId: currentId }, data: updatePayload });
    await prisma.season.updateMany({ where: { anilistId: currentId }, data: updatePayload });

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

  // The absolute final step MUST be to call revalidatePath('/media/[id]') using the local DB ID.
  revalidatePath(`/media/${internalMediaId}`);
}
