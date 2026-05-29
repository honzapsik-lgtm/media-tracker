export interface MediaItem {
  id: string | number;
  title: string;
  type: "movie" | "game" | "manga" | "show";
  image: string | null;
  releaseDate: string | null;
}