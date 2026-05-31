"use client";

import { useState, useEffect } from "react";
import { getSeasonEpisodes } from "@/app/actions";
import RatingSlider from "@/components/RatingSlider"; // NEW: Import your slider

interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
}

interface SeasonExplorerProps {
  tvId: string;
  seasons: Season[];
}

interface EpisodeSummary {
  id: number;
  name: string;
  episode_number: number;
  overview: string;
  image: string | null;
  air_date: string;
  runtime: number;
}

export default function SeasonExplorer({ tvId, seasons }: SeasonExplorerProps) {
  const validSeasons = seasons.filter(s => s.season_number > 0);
  
  const [selectedSeason, setSelectedSeason] = useState<number>(
    validSeasons.length > 0 ? validSeasons[0].season_number : 1
  );
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // NEW: Track which episode's rating slider is currently open
  const [activeEpisodeRater, setActiveEpisodeRater] = useState<number | null>(null);

  useEffect(() => {
    async function fetchEpisodes() {
      setIsLoading(true);
      setActiveEpisodeRater(null); // Close any open raters when switching seasons
      const data = await getSeasonEpisodes(tvId, selectedSeason);
      setEpisodes(data);
      setIsLoading(false);
    }
    fetchEpisodes();
  }, [tvId, selectedSeason]);

  if (validSeasons.length === 0) return null;

  // Generate the unique ID for this specific season (e.g., tmdb-tv-1234-s1)
  const seasonMediaId = `tmdb-tv-${tvId}-s${selectedSeason}`;

  return (
    <div className="mt-16 border-t border-gray-800 pt-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <h2 className="text-3xl font-bold">Seasons & Episodes</h2>
        
        <select 
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(Number(e.target.value))}
          className="bg-gray-900 border border-gray-700 text-white font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-4 py-2.5 outline-none cursor-pointer"
        >
          {validSeasons.map((season) => (
            <option key={season.id} value={season.season_number}>
              {season.name} ({season.episode_count} Episodes)
            </option>
          ))}
        </select>
      </div>

      {/* NEW: The Dedicated Season Rating Box */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 shadow-xl">
        <h3 className="text-xl font-bold mb-4 text-blue-400">Rate Season {selectedSeason} Overall</h3>
        <RatingSlider
          mediaId={seasonMediaId}
          mediaType="show"
          mediaTitle={`Season ${selectedSeason}`}
          mediaImage={null}
        />
      </div>

      {/* Episode List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {episodes.map((ep) => (
            <div key={ep.id} className="bg-gray-900/50 rounded-xl border border-gray-800 flex flex-col overflow-hidden hover:bg-gray-900 transition-colors">
              
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-64 h-40 shrink-0 bg-gray-800 relative">
                  {ep.image ? (
                    <img src={ep.image} alt={ep.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 font-bold">No Image</div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-white font-black px-2 py-1 rounded text-sm border border-white/10">
                    S{selectedSeason} E{ep.episode_number}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-100">{ep.name}</h3>
                    <div className="flex gap-2 text-xs font-semibold text-gray-400">
                      {ep.air_date && <span>{ep.air_date}</span>}
                      {ep.runtime && <span>• {ep.runtime} min</span>}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-4">
                    {ep.overview || "No description available for this episode."}
                  </p>
                  
                  {/* NEW: Toggle Button for the Episode Rater */}
                  <button 
                    onClick={() => setActiveEpisodeRater(activeEpisodeRater === ep.id ? null : ep.id)}
                    className="w-fit text-sm font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-lg border border-gray-700 transition-colors"
                  >
                    {activeEpisodeRater === ep.id ? "Cancel Rating" : "Rate Episode"}
                  </button>
                </div>
              </div>

              {/* NEW: The Dropdown Episode Rater */}
              {activeEpisodeRater === ep.id && (
                <div className="p-6 bg-gray-950 border-t border-gray-800 animate-in slide-in-from-top-2 duration-200">
                  <RatingSlider 
                    mediaId={`${seasonMediaId}-e${ep.episode_number}`} 
                    mediaType="show"
                    mediaTitle={ep.name}
                    mediaImage={ep.image}
                  />
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
