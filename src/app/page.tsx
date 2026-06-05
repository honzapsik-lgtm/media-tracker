import { getTrendingMovies, getTrendingShows } from '@/lib/tmdb';
import { getTrendingGames } from '@/lib/games';
import { getTrendingManga } from '@/lib/books';
import { getListRankMap, getMediaStatsMap } from '@/lib/media-db';
import SearchBar from '@/components/SearchBar';
import MediaRow from '@/components/MediaRow';
import { Suspense } from 'react';

export default async function Home() {
  const [movies, shows, games, manga] = await Promise.all([
    getTrendingMovies(),
    getTrendingShows(),
    getTrendingGames(),
    getTrendingManga()
  ]);

  const allItems = [...movies, ...shows, ...games, ...manga];
  const mediaIds = allItems.map((item) => item.id);
  const [statsMap, rankMap] = await Promise.all([
    getMediaStatsMap(mediaIds),
    getListRankMap(mediaIds),
  ]);

  const applyStats = (items: typeof movies) => items.map(item => ({
    ...item,
    communityScore: statsMap[item.id] || null,
    listRank: rankMap[item.id] || null,
  }));

  const enhancedMovies = applyStats(movies);
  const enhancedShows = applyStats(shows);
  const enhancedGames = applyStats(games);
  const enhancedManga = applyStats(manga);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 pt-8">
          <h1 className="text-6xl font-extrabold leading-tight pb-2 mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 tracking-tight">
            Media Tracker Hub
          </h1>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto text-lg">
            Your centralized hub for tracking the latest and greatest across movies, TV shows, games, and manga.
          </p>
        </div>

        <MediaRow title="Trending Movies" items={enhancedMovies} />
        <MediaRow title="Trending TV Shows" items={enhancedShows} />
        <MediaRow title="Trending Games" items={enhancedGames} />
        <MediaRow title="Trending Manga" items={enhancedManga} />
      </div>
    </main>
  );
}
