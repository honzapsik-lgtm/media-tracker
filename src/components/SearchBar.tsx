"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MediaItem {
  id: string;
  title: string;
  type: string;
  image: string | null;
  releaseDate: string;
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error("Search fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleResultClick = () => {
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full max-w-sm hidden sm:block z-50" ref={dropdownRef}>
      <form onSubmit={handleSearch} className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="Search..."
          className="w-full px-4 py-2 pl-10 bg-gray-900 border border-gray-700 text-white rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 transition-all"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
             <div className="w-4 h-4 rounded-full border-2 border-gray-600 border-t-blue-500 animate-spin"></div>
          </div>
        )}
      </form>

      {/* Dropdown Menu */}
      {isOpen && query.trim() && (
        <div className="absolute top-full mt-2 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden divide-y divide-gray-800">
          {isLoading && results.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Searching...</div>
          ) : results.length > 0 ? (
            <div className="max-h-[70vh] overflow-y-auto scrollbar-none">
              {results.map((item) => (
                <Link
                  key={item.id}
                  href={`/media/${item.id}`}
                  onClick={handleResultClick}
                  className="flex items-center gap-3 p-3 hover:bg-gray-800 transition-colors group"
                >
                  <div className="w-10 h-14 bg-gray-800 rounded overflow-hidden shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 text-center">No Img</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-200 group-hover:text-blue-400 truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                        {item.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.releaseDate ? item.releaseDate.split("-")[0] : "N/A"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              <div className="p-2 border-t border-gray-800 bg-gray-950/50 text-center">
                <button 
                  onClick={handleSearch}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors w-full p-2"
                >
                  View all results
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-400">No results found for &ldquo;{query}&rdquo;</div>
          )}
        </div>
      )}
    </div>
  );
}