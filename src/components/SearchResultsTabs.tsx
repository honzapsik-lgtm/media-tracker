"use client";

import { useState } from "react";
import Link from "next/link";
import { MediaItem } from "@/types";

interface SearchResultsTabsProps {
  results: MediaItem[];
}

type Tab = 'all' | 'movies' | 'shows' | 'games' | 'manga';

export default function SearchResultsTabs({ results }: SearchResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // Filter the results instantly on the client side based on the active tab
  const filteredResults = results.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'movies') return item.type === 'movie';
    if (activeTab === 'shows') return item.type === 'show';
    if (activeTab === 'games') return item.type === 'game';
    if (activeTab === 'manga') return item.type === 'manga';
    return true;
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All Results' },
    { id: 'movies', label: 'Movies' },
    { id: 'shows', label: 'TV Shows' },
    { id: 'games', label: 'Games' },
    { id: 'manga', label: 'Manga' },
  ];

  return (
    <div>
      {/* The Tabs UI */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-800 pb-4">
        {tabs.map((tab) => {
          // Count how many items belong to this tab
          const count = tab.id === 'all' 
            ? results.length 
            : results.filter(r => tab.id === 'movies' ? r.type === 'movie' 
                               : tab.id === 'shows' ? r.type === 'show' 
                               : tab.id === 'games' ? r.type === 'game' 
                               : r.type === 'manga').length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2
                ${activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'
                }`}
            >
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-800' : 'bg-gray-800'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* The Results Grid */}
      {filteredResults.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No results found in this category.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {/* THE FIX: Added 'index' to the map function and the key */}
          {filteredResults.map((item, index) => (
            <Link 
              href={`/media/${item.id}`} 
              key={`${item.id}-${index}`} 
              className="block hover:scale-105 transition-transform duration-300"
            >
              <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg h-full relative border border-gray-800">
                <div className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-bold uppercase rounded-md shadow bg-black/70 backdrop-blur-sm text-white border border-white/20">
                  {item.type}
                </div>

                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-auto object-cover aspect-[2/3]"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-semibold text-lg truncate" title={item.title}>
                    {item.title}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}