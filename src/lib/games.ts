import { MediaItem } from '../types';

export async function searchGames(query: string): Promise<MediaItem[]> {
  const RAWG_API_KEY = process.env.RAWG_API_KEY;
  if (!RAWG_API_KEY) return []; // Silently fail if no key yet

  const encodedQuery = encodeURIComponent(query);
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodedQuery}&page_size=10`,
    { cache: 'no-store' }
  );

  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map((game: any) => ({
    id: `rawg-game-${game.id}`,
    title: game.name,
    type: 'game',
    image: game.background_image || null,
    releaseDate: game.released || 'N/A'
  }));
}

export async function getGameDetails(id: string) {
  const RAWG_API_KEY = process.env.RAWG_API_KEY;
  if (!RAWG_API_KEY) throw new Error("RAWG API Key is missing");

  const res = await fetch(
    `https://api.rawg.io/api/games/${id}?key=${RAWG_API_KEY}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return null;
  const data = await res.json();

  // RAWG provides HTML in their description, so we strip it out for clean text
  const cleanDescription = data.description_raw || data.description.replace(/<[^>]*>?/gm, '');

  return {
    id: `rawg-game-${data.id}`,
    title: data.name,
    type: 'game',
    image: data.background_image || null,
    backdrop: data.background_image_additional || data.background_image || null,
    description: cleanDescription,
    releaseDate: data.released || 'N/A',
    globalScore: data.metacritic ? data.metacritic : 0,
    
    // THE FIX: Add the missing properties so TS matches TMDb
    runtime: data.playtime || null, // RAWG actually provides average playtime in hours!
    genres: data.genres?.map((g: any) => g.name) || [],
    trailerUrl: null, // We will leave this null for games for now
    cast: [],
    seasons: null,
    director: null,
    writer: null,
    music: null,
    creator: null
  };
}