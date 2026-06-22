"use client";

import { useEffect, useState } from "react";

interface WatchlistProgressTrackerProps {
  mediaId: string;
  mediaType: string;
  totalEpisodes?: number | null;
  totalChapters?: number | null;
  totalVolumes?: number | null;
}

interface WatchlistItem {
  id: string;
  status: string;
  added_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  episodesWatched: number;
  chaptersRead: number;
  volumesRead: number;
  hoursPlayed: number;
  platform: string | null;
  watchCount: number;
  is_rewatching: boolean;
  is_rereading: boolean;
}

export default function WatchlistProgressTracker({
  mediaId,
  mediaType,
  totalEpisodes = 0,
  totalChapters = 0,
  totalVolumes = 0,
}: WatchlistProgressTrackerProps) {
  const [item, setItem] = useState<WatchlistItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchWatchlistItem = async () => {
    try {
      const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`);
      if (!res.ok) {
        setItem(null);
        return;
      }
      const data = await res.json();
      if (data && data.status) {
        setItem(data as WatchlistItem);
      } else {
        setItem(null);
      }
    } catch (err) {
      console.error("Failed to fetch watchlist item details", err);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistItem();

    const handleWatchlistUpdate = () => {
      fetchWatchlistItem();
    };

    window.addEventListener("watchlist-updated", handleWatchlistUpdate);
    return () => {
      window.removeEventListener("watchlist-updated", handleWatchlistUpdate);
    };
  }, [mediaId]);

  const updateWatchlistFields = async (updates: Partial<WatchlistItem>) => {
    if (!item) return;
    setUpdating(true);

    try {
      const res = await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          type: mediaType,
          ...updates,
        }),
      });

      if (res.ok) {
        const updatedItem = await res.json();
        setItem(updatedItem as WatchlistItem);
        // Dispatch event so that WatchlistButton can update its status
        window.dispatchEvent(new Event("watchlist-updated"));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update progress.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 p-6 rounded-2xl border border-gray-800 bg-gray-950/30 animate-pulse">
        <div className="h-6 w-36 bg-gray-800 rounded-lg mb-4"></div>
        <div className="h-10 w-full bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  if (!item) return null;

  const type = mediaType.toLowerCase();
  const episodesLimit = totalEpisodes || 0;
  const chaptersLimit = totalChapters || 0;
  const volumesLimit = totalVolumes || 0;

  // Status mapping UI config
  const statuses = [
    { value: "PLANNING", label: type === "game" ? "Plan to Play" : type === "manga" ? "Plan to Read" : "Plan to Watch", color: "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20" },
    { value: "IN_PROGRESS", label: type === "game" ? "Playing" : type === "manga" ? "Reading" : "Watching", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" },
    { value: "COMPLETED", label: "Completed", color: "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20" },
    { value: "ON_HOLD", label: "On Hold", color: "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20" },
    { value: "DROPPED", label: "Dropped", color: "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20" },
  ];

  const handleStatusChange = (status: string) => {
    updateWatchlistFields({ status });
  };

  const incrementMetric = (key: keyof WatchlistItem, amount: number, min = 0) => {
    const currentVal = (item[key] as number) || 0;
    const newVal = Math.max(min, currentVal + amount);
    updateWatchlistFields({ [key]: newVal });
  };

  const handleHoursChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 0) {
      updateWatchlistFields({ hoursPlayed: val });
    }
  };

  return (
    <div className="mt-6 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {updating && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Status Selection Pill Group */}
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-3">Watchlist Status</span>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => {
              const isSelected = item.status === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 outline-none
                    ${isSelected 
                      ? `${s.color.split(" ")[0]} ${s.color.split(" ")[1]} border-current shadow-lg shadow-black/30 scale-105`
                      : "bg-gray-950/40 text-gray-400 border-gray-800 hover:text-white hover:border-gray-600"
                    }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tracker Progress Section */}
        <div className="border-t border-gray-800/60 pt-5">
          {/* SHOW / ANIME PROGRESS */}
          {(type === "show" || type === "anime") && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Episodes Tracked</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-white">{item.episodesWatched}</span>
                    <span className="text-gray-500 font-bold">/</span>
                    <span className="text-gray-400 font-bold">{episodesLimit || "?"}</span>
                    
                    {item.is_rewatching && (
                      <span className="ml-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                        Rewatching
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => incrementMetric("episodesWatched", -1)}
                    className="w-10 h-10 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-center text-white hover:bg-gray-800 font-black transition-colors"
                  >
                    -
                  </button>
                  <button
                    onClick={() => incrementMetric("episodesWatched", 1)}
                    className="w-16 h-10 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    +1
                  </button>
                </div>
              </div>

              {episodesLimit > 0 && (
                <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-850">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (item.episodesWatched / episodesLimit) * 100)}%` }}
                  ></div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_rewatching"
                  checked={item.is_rewatching}
                  onChange={(e) => updateWatchlistFields({ is_rewatching: e.target.checked })}
                  className="rounded border-gray-800 bg-gray-950 text-blue-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="is_rewatching" className="text-xs text-gray-400 font-medium select-none cursor-pointer">
                  Mark as rewatching franchise
                </label>
              </div>
            </div>
          )}

          {/* MANGA PROGRESS */}
          {type === "manga" && (
            <div className="space-y-6">
              {/* Chapters Tracker */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Chapters Read</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-white">{item.chaptersRead}</span>
                      <span className="text-gray-500 font-bold">/</span>
                      <span className="text-gray-400 font-bold">{chaptersLimit || "?"}</span>
                      
                      {item.is_rereading && (
                        <span className="ml-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                          Rereading
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => incrementMetric("chaptersRead", -1)}
                      className="w-10 h-10 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-center text-white hover:bg-gray-800 font-black transition-colors"
                    >
                      -
                    </button>
                    <button
                      onClick={() => incrementMetric("chaptersRead", 1)}
                      className="w-16 h-10 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {chaptersLimit > 0 && (
                  <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-850">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (item.chaptersRead / chaptersLimit) * 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Volumes Tracker */}
              <div className="space-y-3 border-t border-gray-850 pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Volumes Read</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-white">{item.volumesRead}</span>
                      <span className="text-gray-500 font-bold">/</span>
                      <span className="text-gray-400 font-bold">{volumesLimit || "?"}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => incrementMetric("volumesRead", -1)}
                      className="w-10 h-10 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-center text-white hover:bg-gray-800 font-black transition-colors"
                    >
                      -
                    </button>
                    <button
                      onClick={() => incrementMetric("volumesRead", 1)}
                      className="w-16 h-10 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {volumesLimit > 0 && (
                  <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-850">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (item.volumesRead / volumesLimit) * 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_rereading"
                  checked={item.is_rereading}
                  onChange={(e) => updateWatchlistFields({ is_rereading: e.target.checked })}
                  className="rounded border-gray-800 bg-gray-950 text-blue-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="is_rereading" className="text-xs text-gray-400 font-medium select-none cursor-pointer">
                  Mark as rereading manga
                </label>
              </div>
            </div>
          )}

          {/* GAME PROGRESS */}
          {type === "game" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-2">Hours Played</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={item.hoursPlayed}
                      onChange={(e) => handleHoursChange(e.target.value)}
                      className="w-24 bg-gray-950 text-white border border-gray-800 rounded-xl px-4 py-2 font-black focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => incrementMetric("hoursPlayed", 1)}
                        className="px-3 py-2 bg-gray-950/60 border border-gray-800 hover:bg-gray-850 rounded-xl text-xs font-bold text-gray-300"
                      >
                        +1h
                      </button>
                      <button
                        onClick={() => incrementMetric("hoursPlayed", 5)}
                        className="px-3 py-2 bg-gray-950/60 border border-gray-800 hover:bg-gray-850 rounded-xl text-xs font-bold text-gray-300"
                      >
                        +5h
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-2">Platform</span>
                  <select
                    value={item.platform || ""}
                    onChange={(e) => updateWatchlistFields({ platform: e.target.value || null })}
                    className="w-full bg-gray-950 text-white border border-gray-800 rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Platform...</option>
                    <option value="PC">PC</option>
                    <option value="PS5">PlayStation 5</option>
                    <option value="PS4">PlayStation 4</option>
                    <option value="Switch">Nintendo Switch</option>
                    <option value="Xbox Series X">Xbox Series X</option>
                    <option value="Xbox One">Xbox One</option>
                    <option value="Steam Deck">Steam Deck</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* MOVIE PROGRESS */}
          {type === "movie" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Watch Count</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-white">{item.watchCount}</span>
                    <span className="text-gray-400 font-bold">{item.watchCount === 1 ? "view" : "views"}</span>
                    
                    {item.watchCount > 1 && (
                      <span className="ml-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                        Rewatched
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => incrementMetric("watchCount", -1)}
                    className="w-10 h-10 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-center text-white hover:bg-gray-800 font-black transition-colors"
                  >
                    -
                  </button>
                  <button
                    onClick={() => incrementMetric("watchCount", 1)}
                    className="w-16 h-10 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    +1 Watch
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Temporal Logs Display */}
        <div className="border-t border-gray-800/60 pt-4 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-gray-500">
          {item.added_at && (
            <div>
              ADDED: <span className="text-gray-400">{new Date(item.added_at).toLocaleDateString()}</span>
            </div>
          )}
          {item.started_at && (
            <div>
              STARTED: <span className="text-gray-400">{new Date(item.started_at).toLocaleDateString()}</span>
            </div>
          )}
          {item.finished_at && (
            <div>
              FINISHED: <span className="text-gray-400">{new Date(item.finished_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
