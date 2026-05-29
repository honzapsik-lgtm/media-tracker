"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function DiscoverFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Helper function to update the URL parameters seamlessly
  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    return params.toString();
  };

  const handleFilterChange = (key: string, value: string) => {
    router.push(pathname + "?" + createQueryString(key, value));
  };

  // Read current URL states
  const type = searchParams.get("type") || "movie";
  const genre = searchParams.get("genre") || "";
  const year = searchParams.get("year") || "";
  const sort = searchParams.get("sort") || "popular";

  return (
    <div className="flex flex-wrap gap-4 mb-8 bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-lg">
      <select 
        value={type} 
        onChange={(e) => handleFilterChange("type", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer"
      >
        <option value="movie">Movies</option>
        <option value="show">TV Shows</option>
        <option value="game">Games</option>
        <option value="manga">Manga</option>
      </select>

      <select 
        value={genre} 
        onChange={(e) => handleFilterChange("genre", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer"
      >
        <option value="">All Genres</option>
        <option value="action">Action</option>
        <option value="scifi">Sci-Fi</option>
        <option value="drama">Drama</option>
        <option value="comedy">Comedy</option>
      </select>

      <select 
        value={year} 
        onChange={(e) => handleFilterChange("year", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer"
      >
        <option value="">Any Year</option>
        <option value="2026">2026</option>
        <option value="2025">2025</option>
        <option value="2024">2024</option>
        <option value="2023">2023</option>
      </select>

      <select 
        value={sort} 
        onChange={(e) => handleFilterChange("sort", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer ml-auto"
      >
        <option value="popular">Most Popular</option>
        <option value="top_rated">Highest Rated</option>
        <option value="newest">Newest First</option>
      </select>
    </div>
  );
}