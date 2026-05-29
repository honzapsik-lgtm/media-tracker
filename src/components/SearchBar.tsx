"use client"; // This tells Next.js this component runs in the browser

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    // Push the user to a new search page with their query in the URL
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto mb-10">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a movie, game, or book..."
          className="w-full px-6 py-4 bg-gray-800 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg placeholder-gray-400"
        />
        <button 
          type="submit"
          className="absolute right-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}