"use client";

import { useState, useEffect } from "react";

export default function WatchlistButton({ 
  mediaId, title, image, type 
}: { 
  mediaId: string, title: string, image: string | null, type: string 
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchStatus = async () => {
    const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`);
    if (!res.ok) return;
    const data = await res.json() as { status: string | null };
    setStatus(data.status);
  };

  useEffect(() => {
    fetchStatus();

    const handleWatchlistUpdate = () => {
      fetchStatus();
    };

    window.addEventListener("watchlist-updated", handleWatchlistUpdate);
    return () => {
      window.removeEventListener("watchlist-updated", handleWatchlistUpdate);
    };
  }, [mediaId]);

  const toggleWatchlist = async () => {
    setIsUpdating(true);

    if (status) {
      const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`, { method: "DELETE" });
      if (res.ok) {
        setStatus(null);
        // Notify other components
        window.dispatchEvent(new Event("watchlist-updated"));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to remove from list.");
      }
    } else {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, title, image, type, status: "PLANNING" }),
      });
      if (res.ok) {
        setStatus("PLANNING");
        // Notify other components
        window.dispatchEvent(new Event("watchlist-updated"));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to add to list.");
      }
    }
    
    setIsUpdating(false);
  };

  // Dynamic Terminology Logic
  const isGame = type.toLowerCase() === 'game';
  const isManga = type.toLowerCase() === 'manga';
  
  const addText = isGame ? "+ Add to Backlog" : isManga ? "+ Add to Readlist" : "+ Add to Watchlist";
  const removeText = isGame ? "- Remove from Backlog" : isManga ? "- Remove from Readlist" : "- Remove from List";

  return (
    <button
      disabled={isUpdating}
      onClick={toggleWatchlist}
      className={`font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all border outline-none disabled:opacity-50 whitespace-nowrap
        ${status 
          ? 'bg-blue-900/30 text-blue-400 border-blue-500/50 hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/50' 
          : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white hover:border-gray-500'
        }`}
    >
      {status ? removeText : addText}
    </button>
  );
}
