/* eslint-disable @typescript-eslint/no-explicit-any */
import { MediaItem } from '@/types';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

// We strongly type the response so Cursor gives us perfect autocomplete later
export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
}

export async function getTrendingMovies(): Promise<MediaItem[]> {
  if (!TMDB_API_KEY) return [];

  const res = await fetch(
    `${BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}&language=en-US`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) throw new Error('Failed to fetch trending movies');
  const data = await res.json();

  // NORMALIZE the trending data to match the MediaItem interface
  return data.results.map((movie: any) => ({
    id: `tmdb-movie-${movie.id}`, // THE FIX: This now matches the new routing logic
    title: movie.title,
    type: 'movie',
    image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    releaseDate: movie.release_date || 'N/A'
  }));
}

export async function searchTMDb(query: string): Promise<MediaItem[]> {
  if (!TMDB_API_KEY) throw new Error("TMDb API Key is missing");

  const encodedQuery = encodeURIComponent(query);
  const res = await fetch(
    `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodedQuery}&language=en-US&page=1`,
    { cache: 'no-store' }
  );

  if (!res.ok) throw new Error('Failed to search TMDb');
  const data = await res.json();
  
  // Filter out 'person' (actors) so we only get movies and tv shows
  const mediaOnly = data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');

  return mediaOnly.map((item: any) => ({
    // CRUCIAL: We inject the media_type into the ID so the details page knows which endpoint to hit
    id: `tmdb-${item.media_type}-${item.id}`, 
    title: item.title || item.name, // TMDb uses 'title' for movies, 'name' for TV
    type: item.media_type === 'tv' ? 'show' : 'movie',
    image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    releaseDate: item.release_date || item.first_air_date || 'N/A'
  }));
}

export async function getTMDbDetails(id: string, type: 'movie' | 'tv') {
  if (!TMDB_API_KEY) throw new Error("TMDb API Key is missing");

  const res = await fetch(
    `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return null;
  const data = await res.json();

  const trailer = data.videos?.results?.find(
    (vid: any) => vid.site === 'YouTube' && vid.type === 'Trailer'
  );

  // WE KEEP EVERYONE NOW (capping at 50 so the browser doesn't lag out on uncredited extras)
  const fullCast = data.credits?.cast?.slice(0, 50).map((actor: any) => ({
    id: actor.id,
    name: actor.name,
    character: actor.character,
    image: actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : null,
  })) || [];

  // THE NEW CREW SEARCH LOGIC:
  const crew = data.credits?.crew || [];
  const director = crew.find((c: any) => c.job === 'Director')?.name || null;
  const writer = crew.find((c: any) => c.job === 'Screenplay' || c.job === 'Writer')?.name || null;
  const music = crew.find((c: any) => c.job === 'Original Music Composer' || c.job === 'Music')?.name || null;
  const creator = data.created_by && data.created_by.length > 0 ? data.created_by.map((c: any) => c.name).join(', ') : null;  
  return {
    id: `tmdb-${type}-${data.id}`,
    title: data.title || data.name,
    type: type === 'tv' ? 'show' : 'movie',
    image: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
    description: data.overview,
    releaseDate: data.release_date || data.first_air_date,
    globalScore: data.vote_average ? Math.round(data.vote_average * 10) : 0,
    runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null),
    genres: data.genres?.map((g: any) => g.name) || [],
    trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
    cast: fullCast,
    seasons: data.seasons || null,
    
    creator,
    director,
    writer,
    music
  };
}
