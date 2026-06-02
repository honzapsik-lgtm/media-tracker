/* eslint-disable @typescript-eslint/no-explicit-any */
import { MediaItem } from '../types';
import { readApiCache, writeApiCache } from '@/lib/api-cache';
import { prisma } from '@/lib/prisma';
const SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60;

// 1. Lightning Fast Search Fetcher
export async function searchBooks(query: string): Promise<MediaItem[]> {
  try {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const cacheId = `jikan-search-${encodeURIComponent(normalizedQuery)}`;
    const cached = await readApiCache<MediaItem[]>(cacheId);
    if (cached) return cached;

    const encodedQuery = encodeURIComponent(normalizedQuery);
    
    const res = await fetch(
      `https://api.jikan.moe/v4/manga?q=${encodedQuery}&limit=10&order_by=popularity&sort=asc`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return [];

    const { data } = await res.json();
    if (!data) return [];

    const results = data.map((item: any) => ({
      id: `manga-${item.mal_id}`,
      // We prioritize the English localized title if it exists, otherwise fallback to Romaji
      title: item.title_english || item.title,
      type: 'manga',
      image: item.images?.webp?.image_url || item.images?.jpg?.image_url || null,
      releaseDate: item.published?.prop?.from?.year?.toString() || 'N/A'
    }));

    await writeApiCache(cacheId, 'jikan', results, SEARCH_CACHE_TTL_SECONDS);

    return results;
  } catch (error) {
    console.error("Manga API Fetch failed:", error);
    return [];
  }
}

// 2. Details Fetcher
export async function getBookDetails(id: string) {
  try {
    const cacheId = `manga-${id}`;
    const cached = await prisma.apiCache.findUnique({ where: { id: cacheId } });
    if (cached && cached.expires_at > new Date()) {
      return cached.data as any;
    }

    const res = await fetch(
      `https://api.jikan.moe/v4/manga/${id}`,
      { next: { revalidate: 3600 } }
    );

    // Safety Net 1: Check if the response is OK
    if (!res.ok) {
      console.warn(`Manga API failed with status: ${res.status}`);
      return null;
    }
    
    const payload = await res.json();
    const data = payload.data;

    // Safety Net 2: Ensure the data object actually exists before mapping
    if (!data) return null;

    const result = {
      id: cacheId,
      title: data.title_english || data.title,
      type: 'manga',
      image: data.images?.webp?.large_image_url || data.images?.jpg?.large_image_url || null,
      backdrop: null, 
      description: data.synopsis ? data.synopsis.replace('[Written by MAL Rewrite]', '').trim() : 'No description available.',
      releaseDate: data.published?.string || 'N/A',
      globalScore: data.score ? Math.round(data.score * 10) : 0, 
      
      // THE FIX: Add the missing properties
      runtime: null, 
      genres: data.genres?.map((g: any) => g.name) || [],
      trailerUrl: data.trailer?.embed_url || null, // Jikan actually provides anime/manga promo trailers!
      cast: [],
      seasons: null,
      director: null,
      writer: data.authors && data.authors.length > 0 ? data.authors[0].name : null,
      music: null,
      creator: null
    };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.apiCache.upsert({
      where: { id: cacheId },
      update: { data: result as any, expires_at: expiresAt },
      create: { id: cacheId, provider: 'jikan', data: result as any, expires_at: expiresAt }
    });

    return result;
  } catch (error) {
    // Safety Net 3: Catch any random network parsing errors
    console.error("Failed to fetch manga details:", error);
    return null;
  }
}
