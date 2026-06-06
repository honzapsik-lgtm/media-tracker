"use client";

import { useState, useEffect } from "react";

interface LiveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaType: string;
  onSelect: (item: any) => void;
}

export default function LiveSearchModal({ isOpen, onClose, mediaType, onSelect }: LiveSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length >= 2) {
        fetchResults(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, isOpen]);

  const fetchResults = async (q: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        // Filter by mediaType
        const filtered = data.filter((item: any) => item.type === mediaType);
        setResults(filtered);
      }
    } catch (err) {
      console.error("Search error", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative">
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-white focus:outline-none focus:ring-0 text-lg placeholder-gray-500"
            placeholder={`Search for a ${mediaType}...`}
            autoFocus
          />
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Searching...</div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-1">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800 transition-colors text-left group"
                >
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-12 h-16 object-cover rounded bg-gray-800" />
                  ) : (
                    <div className="w-12 h-16 bg-gray-800 rounded flex items-center justify-center text-gray-600 text-xs">No Img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-200 group-hover:text-blue-400 truncate">{item.title}</h4>
                    <span className="text-xs text-gray-500">{item.releaseDate || 'Unknown Date'}</span>
                  </div>
                  <div className="text-blue-500 opacity-0 group-hover:opacity-100 pr-2 transition-opacity">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="p-8 text-center text-gray-500">No {mediaType}s found matching "{query}"</div>
          ) : (
            <div className="p-8 text-center text-gray-600 italic text-sm">Type at least 2 characters to search</div>
          )}
        </div>
      </div>
    </div>
  );
}
