"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function WatchlistButton({ 
  mediaId, title, image, type 
}: { 
  mediaId: string, title: string, image: string | null, type: string 
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_watchlist")
        .select("status")
        .eq("user_id", user.id)
        .eq("media_id", mediaId)
        .single();

      if (data) setStatus(data.status);
    };
    fetchStatus();
  }, [mediaId, supabase]);

  const toggleWatchlist = async () => {
    setIsUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("You must be logged in to track media.");
      setIsUpdating(false);
      return;
    }

    if (status) {
      await supabase.from("user_watchlist").delete().eq("user_id", user.id).eq("media_id", mediaId);
      setStatus(null);
    } else {
      const payload = {
        user_id: user.id,
        media_id: mediaId,
        media_title: title,
        media_image: image,
        media_type: type,
        status: "plan_to_watch" // Acts as the default 'unplayed/unread' status across all categories
      };
      
      await supabase.from("user_watchlist").upsert(payload);
      setStatus("plan_to_watch");
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