export type UnifiedCredit = {
  mediaId: string | null;
  mediaType: 'MOVIE' | 'SHOW' | 'ANIME' | 'MANGA' | 'GAME';
  title: string;
  poster: string | null;
  releaseYear: number | null;
  role: string;
  isVoiceRole: boolean;
  characterImage?: string | null;
};

export type UnifiedProfile = {
  id: string;
  tmdbId: number | null;
  anilistId: number | null;
  igdbId: number | null;
  malId: number | null;
  rawgId: number | null;
  rawgSlug?: string;
  mangadexId?: string | null;
  name: string;
  nativeName: string | null;
  bio: string | null;
  profileImage: string | null;
  birthDate: string | null;
  deathDate: string | null;
  knownForDepartment: string | null;
  credits: {
    cast: UnifiedCredit[];
    crew: UnifiedCredit[];
  };
};
