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