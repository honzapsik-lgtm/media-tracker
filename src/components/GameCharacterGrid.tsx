"use client";

import React, { useState } from 'react';
import { GameCharacter } from '@/types';

interface GameCharacterGridProps {
  characters: GameCharacter[];
}

export default function GameCharacterGrid({ characters }: GameCharacterGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!characters || characters.length === 0) return null;

  const defaultVisibleCount = 6;
  const visibleCharacters = isExpanded ? characters : characters.slice(0, defaultVisibleCount);

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold">Characters</h2>
        {characters.length > defaultVisibleCount && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-900/50 cursor-pointer"
          >
            {isExpanded ? "Show Less" : `View All ${characters.length}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleCharacters.map((char) => (
          <div 
            key={char.id} 
            className="flex items-center bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group gap-3"
          >
            {char.imageUrl ? (
              <img
                src={char.imageUrl}
                alt={char.name}
                className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                {char.name[0] || 'N/A'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                {char.name}
              </p>
              {char.description && (
                <p className="text-xs text-gray-500 truncate" title={char.description}>
                  {char.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
