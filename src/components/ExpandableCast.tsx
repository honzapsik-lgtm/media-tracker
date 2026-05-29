"use client";

import { useState } from "react";

interface Actor {
  id: number;
  name: string;
  character: string;
  image: string | null;
}

export default function ExpandableCast({ cast }: { cast: Actor[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!cast || cast.length === 0) return null;

  // Show only 6 actors by default
  const visibleCast = isExpanded ? cast : cast.slice(0, 6);

  return (
    <div className="lg:col-span-2">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold">Full Cast</h2>
        {cast.length > 6 && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-900/50"
          >
            {isExpanded ? "Show Less" : `View All ${cast.length}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {visibleCast.map((actor) => (
          <div key={actor.id} className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 transition-colors">
            {actor.image ? (
              <img src={actor.image} alt={actor.name} className="w-14 h-14 rounded-full object-cover shadow-md border border-gray-700" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500">N/A</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-200 truncate">{actor.name}</p>
              <p className="text-xs text-gray-500 truncate">{actor.character}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}