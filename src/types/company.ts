export interface UnifiedCompanyMedia {
  mediaId: string;
  mediaType: 'MOVIE' | 'SHOW' | 'ANIME' | 'MANGA' | 'GAME';
  title: string;
  poster: string | null;
  releaseYear: number | null;
}

export interface UnifiedCompanyProfile {
  id: string; // e.g. igdb-184, anilist-43, tmdb-123, tmdbnet-456
  name: string;
  description: string | null;
  logo: string | null;
  country: string | null;
  portfolio: {
    developedGames: UnifiedCompanyMedia[];
    publishedGames: UnifiedCompanyMedia[];
    animationStudioFor: UnifiedCompanyMedia[];
    producedAnime: UnifiedCompanyMedia[];
    publishedManga: UnifiedCompanyMedia[];
    producedFilmTv: UnifiedCompanyMedia[];
    broadcastedOn: UnifiedCompanyMedia[];
  };
}
