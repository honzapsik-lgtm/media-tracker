export interface CanonSpecialRule {
  targetSeason: number;
  specialEpisodes: number[]; // Episode numbers in Season 0
}

export interface CanonMovieItem {
  id: string; // e.g. "tmdb-movie-810693"
  tmdbId: number;
  title: string;
  orderAfterSeason: number; // e.g. 0 for prequel before S1, 1 for after S1, etc.
  releaseDate?: string;
}

// Shows where Season 0 specials are actually canonical season finales
export const CANON_SPECIAL_RULES: Record<string, CanonSpecialRule> = {
  // Attack on Titan: The Final Chapters Special 1 & 2 (Season 0, Ep 36 & 37) finish Season 4
  '1429': {
    targetSeason: 4,
    specialEpisodes: [36, 37]
  }
};

// Shows where canonical movies continue the main story and belong in the Narrative Timeline
export const CANON_FRANCHISE_MOVIES: Record<string, CanonMovieItem[]> = {
  // Jujutsu Kaisen -> Jujutsu Kaisen 0 (Prequel movie)
  '95479': [
    {
      id: 'tmdb-movie-810693',
      tmdbId: 810693,
      title: 'Jujutsu Kaisen 0',
      orderAfterSeason: 0 // Canon prequel before Season 1
    }
  ],
  // Demon Slayer -> Infinity Castle movie trilogy (starts after Season 5 Hashira Training)
  '85937': [
    {
      id: 'tmdb-movie-1311031',
      tmdbId: 1311031,
      title: 'Demon Slayer: Kimetsu no Yaiba Infinity Castle',
      orderAfterSeason: 5
    }
  ]
};

/**
 * Adjusts TMDb seasons array so that seasons with canon specials reflect the true episode count,
 * and Season 0 specials reflect the remaining OVAs.
 */
export function getAdjustedSeasons(tmdbId: string | number, seasons: any[] | null | undefined): any[] {
  if (!seasons || !Array.isArray(seasons)) return [];
  const idStr = String(tmdbId);
  const rule = CANON_SPECIAL_RULES[idStr];

  return seasons.map(s => {
    if (rule && s.season_number === rule.targetSeason) {
      return {
        ...s,
        episode_count: (s.episode_count || 0) + rule.specialEpisodes.length
      };
    }
    if (rule && s.season_number === 0) {
      return {
        ...s,
        episode_count: Math.max(0, (s.episode_count || 0) - rule.specialEpisodes.length),
        name: s.name === 'Specials' ? 'Specials & OVAs' : s.name
      };
    }
    return s;
  });
}

/**
 * Returns episode numbers from Season 0 that should be appended to this season.
 */
export function getCanonFinaleEpisodeNumbers(tmdbId: string | number, seasonNumber: number): number[] {
  const rule = CANON_SPECIAL_RULES[String(tmdbId)];
  if (rule && rule.targetSeason === seasonNumber) {
    return rule.specialEpisodes;
  }
  return [];
}

/**
 * Returns episode numbers from Season 0 that were integrated into regular seasons and should be excluded from Season 0 OVAs.
 */
export function getExcludedSeason0EpisodeNumbers(tmdbId: string | number): number[] {
  const rule = CANON_SPECIAL_RULES[String(tmdbId)];
  return rule ? rule.specialEpisodes : [];
}

/**
 * Returns canon continuation movies for a show's Narrative Timeline.
 */
export function getCanonMoviesForShow(tmdbId: string | number): CanonMovieItem[] {
  return CANON_FRANCHISE_MOVIES[String(tmdbId)] || [];
}
