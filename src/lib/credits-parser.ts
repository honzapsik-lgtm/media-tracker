function getGodTierRole(role: string): string | null {
  if (!role) return null;
  const lowerRole = role.toLowerCase().trim();

  // Directors (Strict match to prevent leaking CG/Unit/Assistant/Art/Sound directors)
  if (/^(director|series director|chief director)$/i.test(lowerRole)) {
    return 'Director';
  }

  // Original Creator
  if (/^(original creator|original story|original concept|creator|original plan)$/i.test(lowerRole) || lowerRole.includes('story & art')) {
    return 'Original Creator';
  }

  // Series Composition
  if (/^(series composition|head writer)$/i.test(lowerRole)) {
    return 'Series Composition';
  }

  // Character Design (Strict match to prevent leaking Sub/Assistant Character Design)
  if (/^(character design|original character design)$/i.test(lowerRole)) {
    return 'Character Design';
  }

  // Composer
  if (/^(music|composer|soundtrack)$/i.test(lowerRole)) {
    return 'Composer';
  }

  return null;
}

export function getMasterCrew(staffJsons: any | any[]) {
  const blobs = Array.isArray(staffJsons) ? staffJsons : [staffJsons];
  const architects = [];
  const secondary = [];

  for (const staffJson of blobs) {
    if (!staffJson) continue;
    const edges = Array.isArray(staffJson) ? staffJson : staffJson.edges;
    if (!edges || !Array.isArray(edges)) continue;

    for (const edge of edges) {
      const role = edge.role || '';
      if (/\((English|Spanish|Italian|German|French|Portuguese)/i.test(role) || /\bADR\b/i.test(role)) {
        continue;
      }

      let cleanRole = role;

      const hasEpisode = /\beps?\b/i.test(cleanRole);
      const hasSeasonWide = /\b(OP|ED|Theme|Insert)\d*\b/i.test(cleanRole);

      // TIER 1: Reject any purely episode-specific brackets
      if (hasEpisode && !hasSeasonWide) {
        continue;
      }

      if (hasEpisode && hasSeasonWide) {
        // Strips ', ep 1' or 'ep 1-4,' out of the parentheses safely
        cleanRole = cleanRole.replace(/(?:,\s*)?\beps?\b[^,)]+(?:,\s*)?/gi, '').replace(/\(\s*\)/g, '').trim();
      }

      const godTierRole = getGodTierRole(cleanRole);

      if (godTierRole) {
        architects.push({
          id: edge.node.id,
          name: edge.node.name?.full || 'Unknown',
          image: edge.node.image?.large || null,
          role: godTierRole
        });
      } else {
        secondary.push({
          id: edge.node.id,
          name: edge.node.name?.full || 'Unknown',
          image: edge.node.image?.large || null,
          role: cleanRole
        });
      }
    }
  }

  // Deduplicate by ID and role just in case
  const unique = [];
  const seen = new Set();
  for (const a of architects) {
    const key = `${a.id}-${a.role}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }

  const uniqueSecondary = [];
  const seenSecondary = new Set();
  for (const a of secondary) {
    const key = `${a.id}-${a.role}`;
    if (!seenSecondary.has(key)) {
      seenSecondary.add(key);
      uniqueSecondary.push(a);
    }
  }

  return { primary: unique, secondary: uniqueSecondary };
}

export function getSeasonCrew(staffJsons: any | any[]) {
  const blobs = Array.isArray(staffJsons) ? staffJsons : [staffJsons];
  const godTier: any[] = [];
  const other: any[] = [];
  
  for (const staffJson of blobs) {
    if (!staffJson) continue;
    const edges = Array.isArray(staffJson) ? staffJson : staffJson.edges;
    if (!edges || !Array.isArray(edges)) continue;

    for (const edge of edges) {
      const role = edge.role || '';
      if (/\((English|Spanish|Italian|German|French|Portuguese)/i.test(role) || /\bADR\b/i.test(role)) {
        continue;
      }

      let cleanRole = role;

      const hasEpisode = /\beps?\b/i.test(cleanRole);
      const hasSeasonWide = /\b(OP|ED|Theme|Insert)\d*\b/i.test(cleanRole);

      // TIER 2: Reject any purely episode-specific brackets
      if (hasEpisode && !hasSeasonWide) {
        continue;
      }

      if (hasEpisode && hasSeasonWide) {
        // Strips ', ep 1' or 'ep 1-4,' out of the parentheses safely
        cleanRole = cleanRole.replace(/(?:,\s*)?\beps?\b[^,)]+(?:,\s*)?/gi, '').replace(/\(\s*\)/g, '').trim();
      }

      const godTierRole = getGodTierRole(cleanRole);

      const parsedCredit = {
        id: edge.node.id,
        name: edge.node.name?.full || 'Unknown',
        image: edge.node.image?.large || null,
        role: godTierRole ? godTierRole : cleanRole
      };

      if (godTierRole) {
        godTier.push(parsedCredit);
      } else {
        other.push(parsedCredit);
      }
    }
  }

  // Deduplicate separately to maintain array bifurcation order
  const uniqueGodTier = [];
  const seenGod = new Set();
  for (const a of godTier) {
    const key = `${a.id}-${a.role}`;
    if (!seenGod.has(key)) {
      seenGod.add(key);
      uniqueGodTier.push(a);
    }
  }

  const uniqueOther = [];
  const seenOther = new Set();
  for (const a of other) {
    const key = `${a.id}-${a.role}`;
    if (!seenOther.has(key)) {
      seenOther.add(key);
      uniqueOther.push(a);
    }
  }

  return { primary: uniqueGodTier, secondary: uniqueOther };
}

export function getMasterStudios(studioJsons: any | any[]) {
  const blobs = Array.isArray(studioJsons) ? studioJsons : [studioJsons];
  const studios = [];

  for (const studioJson of blobs) {
    if (!studioJson) continue;
    const edges = Array.isArray(studioJson) ? studioJson : studioJson.edges;
    if (!edges || !Array.isArray(edges)) continue;

    for (const edge of edges) {
      if (edge.isMain && edge.node) {
        studios.push({
          id: edge.node.id,
          name: edge.node.name
        });
      }
    }
  }

  // Deduplicate by ID
  const unique = [];
  const seen = new Set();
  for (const s of studios) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      unique.push(s);
    }
  }

  return unique;
}

export function getMasterCast(castJsons: any | any[]) {
  const blobs = Array.isArray(castJsons) ? castJsons : [castJsons];
  const uniqueEdges = [];
  const seenCharacters = new Set();

  for (const castJson of blobs) {
    if (!castJson) continue;
    const edges = Array.isArray(castJson) ? castJson : castJson.edges;
    if (!edges || !Array.isArray(edges)) continue;

    for (const edge of edges) {
      const charId = edge.node?.id;
      if (charId && !seenCharacters.has(charId)) {
        seenCharacters.add(charId);
        uniqueEdges.push(edge);
      }
    }
  }

  return { edges: uniqueEdges };
}

export function getEpisodeCrew(staffJson: any, targetEpisodeNumber: number) {
  if (!staffJson) return { primary: [], secondary: [] };
  const edges = Array.isArray(staffJson) ? staffJson : staffJson.edges;
  if (!edges || !Array.isArray(edges)) return { primary: [], secondary: [] };

  const primary = [];
  const secondary = [];

  for (const edge of edges) {
    const role = edge.role || '';
    
    // Ignore dubs
    if (role.includes('(English)') || role.includes('(Spanish)') || role.includes('ADR')) {
      continue;
    }

    // TIER 3: MUST contain bracketed episodes cleanly
    const epRegex = /\([^)]*\beps?\b[^)]*\)/i;
    const innerEpRegex = /\beps?\b[\s]*([\d\-,\s]+)/i;
    const hasBracket = epRegex.test(role);
    
    if (hasBracket) {
      const epMatch = role.match(innerEpRegex);
      if (!epMatch) continue;
      
      const epStr = epMatch[1];
      const epParts = epStr.split(',').map((s: string) => s.trim());
      
      let matchesEpisode = false;
      for (const part of epParts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          if (targetEpisodeNumber >= start && targetEpisodeNumber <= end) {
            matchesEpisode = true;
            break;
          }
        } else {
          const ep = Number(part);
          if (ep === targetEpisodeNumber) {
            matchesEpisode = true;
            break;
          }
        }
      }
      
      if (matchesEpisode) {
        // STRIP the brackets cleanly from the role
        const cleanRole = role.replace(epRegex, '').replace(/\s{2,}/g, ' ').trim();
        const lowerClean = cleanRole.toLowerCase();
        
        const isPrimary = lowerClean.includes('director') || lowerClean.includes('storyboard') || lowerClean.includes('script');
        
        const parsedCredit = {
          id: edge.node.id,
          name: edge.node.name?.full || 'Unknown',
          image: edge.node.image?.large || null,
          role: cleanRole
        };
        
        if (isPrimary) {
          primary.push(parsedCredit);
        } else {
          secondary.push(parsedCredit);
        }
      }
    }
  }

  const uniquePrimary = [];
  const seenPrimary = new Set();
  for (const a of primary) {
    const key = `${a.id}-${a.role}`;
    if (!seenPrimary.has(key)) {
      seenPrimary.add(key);
      uniquePrimary.push(a);
    }
  }

  const uniqueSecondary = [];
  const seenSecondary = new Set();
  for (const a of secondary) {
    const key = `${a.id}-${a.role}`;
    if (!seenSecondary.has(key)) {
      seenSecondary.add(key);
      uniqueSecondary.push(a);
    }
  }

  return { primary: uniquePrimary, secondary: uniqueSecondary };
}

export function normalizeTMDbRole(role: string): string {
  if (!role) return 'Unknown';
  const lower = role.toLowerCase().trim();
  
  if (lower === 'director of photography') return 'Cinematographer';
  if (lower === 'original music composer') return 'Composer';
  if (lower === 'screenplay') return 'Writer';
  if (lower === 'novel' || lower === 'comic book' || lower === 'author') return 'Original Creator';
  
  // Try to match AniList's god tier exactly
  const godTier = getGodTierRole(role);
  if (godTier) return godTier;

  return role;
}
