"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const GENRE_MAP: Record<string, { value: string; label: string }[]> = {
  movie: [
    { value: "action", label: "Action" }, { value: "adventure", label: "Adventure" },
    { value: "animation", label: "Animation" }, { value: "comedy", label: "Comedy" },
    { value: "crime", label: "Crime" }, { value: "documentary", label: "Documentary" },
    { value: "drama", label: "Drama" }, { value: "family", label: "Family" },
    { value: "fantasy", label: "Fantasy" }, { value: "horror", label: "Horror" },
    { value: "mystery", label: "Mystery" }, { value: "romance", label: "Romance" },
    { value: "scifi", label: "Sci-Fi" }, { value: "thriller", label: "Thriller" }
  ],
  show: [
    { value: "action", label: "Action & Adventure" }, { value: "animation", label: "Animation" },
    { value: "comedy", label: "Comedy" }, { value: "crime", label: "Crime" },
    { value: "documentary", label: "Documentary" }, { value: "drama", label: "Drama" },
    { value: "family", label: "Family" }, { value: "mystery", label: "Mystery" },
    { value: "scifi", label: "Sci-Fi & Fantasy" }
  ],
  game: [
    { value: "action", label: "Action" }, { value: "adventure", label: "Adventure" },
    { value: "rpg", label: "RPG" }, { value: "shooter", label: "Shooter" },
    { value: "strategy", label: "Strategy" }, { value: "simulation", label: "Simulation" },
    { value: "puzzle", label: "Puzzle" }, { value: "racing", label: "Racing" },
    { value: "sports", label: "Sports" }, { value: "fighting", label: "Fighting" }
  ],
  manga: [
    { value: "action", label: "Action" }, { value: "adventure", label: "Adventure" },
    { value: "comedy", label: "Comedy" }, { value: "drama", label: "Drama" },
    { value: "fantasy", label: "Fantasy" }, { value: "horror", label: "Horror" },
    { value: "mystery", label: "Mystery" }, { value: "romance", label: "Romance" },
    { value: "scifi", label: "Sci-Fi" }, { value: "slice", label: "Slice of Life" },
    { value: "sports", label: "Sports" }, { value: "supernatural", label: "Supernatural" }
  ]
};

export default function DiscoverFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") || "movie";
  const genre = searchParams.get("genre") || "";
  const year = searchParams.get("year") || "";
  const sort = searchParams.get("sort") || "popular";

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    if (name === "type") {
      params.delete("genre");
    }

    return params.toString();
  };

  const handleFilterChange = (key: string, value: string) => {
    router.push(pathname + "?" + createQueryString(key, value));
  };

  const handleClearFilters = () => {
    router.push(`${pathname}?type=${type}`);
  };

  // Upgraded: Covers 1890 to present year
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1890 + 1 }, (_, i) => currentYear - i);

  const availableGenres = GENRE_MAP[type] || GENRE_MAP.movie;
  const activeFilterCount = (genre ? 1 : 0) + (year ? 1 : 0) + (sort !== "popular" ? 1 : 0);

  return (
    <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-8 bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl items-center relative">
      
      <select 
        value={type} 
        onChange={(e) => handleFilterChange("type", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-black rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none cursor-pointer hover:border-gray-500 transition-colors"
      >
        <option value="movie">Movies</option>
        <option value="show">TV Shows</option>
        <option value="game">Games</option>
        <option value="manga">Manga</option>
      </select>

      <div className="w-px h-8 bg-gray-800 hidden md:block"></div>

      <select 
        value={genre} 
        onChange={(e) => handleFilterChange("genre", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none cursor-pointer hover:border-gray-500 transition-colors"
      >
        <option value="">All Genres</option>
        {availableGenres.map((g) => (
          <option key={g.value} value={g.value}>{g.label}</option>
        ))}
      </select>

      <select 
        value={year} 
        onChange={(e) => handleFilterChange("year", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none cursor-pointer hover:border-gray-500 transition-colors max-h-60 overflow-y-auto"
      >
        <option value="">Any Year</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select 
        value={sort} 
        onChange={(e) => handleFilterChange("sort", e.target.value)}
        className="bg-gray-950 border border-gray-700 text-white text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none cursor-pointer hover:border-gray-500 transition-colors md:ml-auto"
      >
        <option value="popular">Most Popular</option>
        <option value="top_rated">Highest Rated</option>
        <option value="newest">Newest First</option>
      </select>

      {activeFilterCount > 0 && (
        <button 
          onClick={handleClearFilters}
          className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-sm font-bold rounded-lg px-4 py-3 transition-colors ml-2"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}