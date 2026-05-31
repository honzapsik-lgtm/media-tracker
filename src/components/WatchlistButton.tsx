"use client";

import { useState, useEffect } from "react";

export default function WatchlistButton({ 
  mediaId, title, image, type 
}: { 
  mediaId: string, title: string, image: string | null, type: string 
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`);
      if (!res.ok) return;
      const data = await res.json() as { status: string | null };
      setStatus(data.status);
    };
    fetchStatus();
  }, [mediaId]);

  const toggleWatchlist = async () => {
    setIsUpdating(true);

    if (status) {
      const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`, { method: "DELETE" });
      if (res.ok) setStatus(null);
      else alert("You must be logged in to track media.");
    } else {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, title, image, type, status: "plan_to_watch" }),
      });
      if (res.ok) setStatus("plan_to_watch");
      else alert("You must be logged in to track media.");
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
