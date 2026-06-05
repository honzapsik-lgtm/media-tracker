"use client";

import { useState } from "react";
import { MediaItem } from "@/types";
import MediaCardHorizontal from "./MediaCardHorizontal";

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
        <div className="space-y-2">
          {filteredResults.map((item, index) => (
            <MediaCardHorizontal key={`${item.id}-${index}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}