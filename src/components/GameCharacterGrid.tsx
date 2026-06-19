import React from 'react';
import { GameCharacter } from '@/types';

interface GameCharacterGridProps {
  characters: GameCharacter[];
}

export default function GameCharacterGrid({ characters }: GameCharacterGridProps) {
  if (!characters || characters.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Characters</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {characters.map((char) => (
          <div key={char.id} className="flex bg-gray-900/60 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors gap-4">
            {char.imageUrl ? (
              <img
                src={char.imageUrl}
                alt={char.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-800"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-850 border border-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                {char.name[0]}
              </div>
            )}
            <div className="flex flex-col min-w-0 justify-center">
              <span className="font-bold text-white text-sm truncate">{char.name}</span>
              {char.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
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
