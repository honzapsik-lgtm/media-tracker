export interface MediaItem {
  id: string; // Ensure this is mostly used as a string
  title: string;
  type: string;
  image: string | null;
  releaseDate: string | null;
  communityScore?: number | null;
  listRank?: number | null;
  totalRatings?: number | null;
}

export interface MediaCredit {
  id: string;
  name: string;
  role: string;
  image: string | null;
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