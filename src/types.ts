export interface MediaItem {
  id: string; // Ensure this is mostly used as a string
  title: string;
  type: string;
  image: string | null;
  releaseDate: string | null;
  communityScore?: number | null;
  listRank?: number | null;
  totalRatings?: number | null;
  originalLanguage?: string;
  genreIds?: number[];
  origin?: string;
}

export interface MediaCredit {
  id: string | number;
  name: string;
  role: string;
  image: string | null;
  isCompany?: boolean;
}

export interface PersonProfile {
  id: string;
  name: string;
  bio: string | null;
  image: string | null;
  birthDate: string | null;
  deathDate: string | null;
  credits: MediaItem[];
}

export interface GameCompany {
  id: string; // formatted as igdb-[id]
  name: string;
  isDeveloper: boolean;
  isPublisher: boolean;
}

export interface GameCharacter {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

export interface GameCrewMember {
  id: string; // formatted as rawg-[id]
  name: string;
  role: string;
  imageUrl: string | null;
}