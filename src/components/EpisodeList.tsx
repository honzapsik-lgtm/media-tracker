"use client";

import { useState } from "react";
import Link from "next/link";

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  overview?: string;
  image?: string | null;
  air_date?: string;
  runtime?: number;
}

interface EpisodeListProps {
  mediaId: string;
  seasonNumber: string | number;
  episodes: Episode[];
}

export default function EpisodeList({ mediaId, seasonNumber, episodes }: EpisodeListProps) {
  const [currentChunk, setCurrentChunk] = useState(0);

  if (!episodes || episodes.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
        <p className="text-gray-400">No episodes found for this season.</p>
      </div>
    );
  }

  const EPISODES_PER_PAGE = 50;
  const totalChunks = Math.ceil(episodes.length / EPISODES_PER_PAGE);
  const visibleEpisodes = episodes.slice(currentChunk * EPISODES_PER_PAGE, (currentChunk + 1) * EPISODES_PER_PAGE);

  return (
    <div>
      {totalChunks > 1 && (
        <div className="mb-6 flex justify-end">
          <select 
            className="bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-4 py-2 font-bold focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            value={currentChunk}
            onChange={(e) => setCurrentChunk(Number(e.target.value))}
          >
            {Array.from({ length: totalChunks }).map((_, i) => {
              const start = i * EPISODES_PER_PAGE + 1;
              const end = Math.min((i + 1) * EPISODES_PER_PAGE, episodes.length);
              return (
                <option key={i} value={i}>
                  Episodes {start} - {end}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleEpisodes.map((ep) => (
          <Link
            key={ep.id}
            href={`/media/${mediaId}/season/${seasonNumber}/episode/${ep.episode_number}`}
            className="bg-gray-900/40 rounded-lg border border-gray-800/60 hover:border-blue-500 hover:bg-gray-800/80 transition-colors flex items-center justify-between p-3 group shadow-sm"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-gray-500 font-black text-sm shrink-0 w-12 text-center group-hover:text-blue-500 transition-colors">
                EP {ep.episode_number}
              </span>
              <p className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors truncate">
                {ep.name}
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-4">
              {ep.air_date && (
                <span className="text-xs text-gray-500 font-medium hidden sm:block">
                  {ep.air_date}
                </span>
              )}
              {ep.runtime ? (
                <span className="text-xs font-bold text-gray-600 bg-gray-950 px-2 py-1 rounded border border-gray-800 shadow-inner">
                  {ep.runtime}m
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
