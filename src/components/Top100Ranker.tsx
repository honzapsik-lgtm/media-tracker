"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

export default function Top100Ranker({ rawData }: { rawData: any[] }) {
  // Sort the initial data by score so the highest rated is at the top by default
  const [items, setItems] = useState([...rawData].sort((a, b) => b.score - a.score));
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeTabType, setActiveTabType] = useState<string>(''); // New state

  // Derive unique media types and set default activeTabType
  const mediaTypes = [...new Set(rawData.map(item => item.type))];

  useEffect(() => {
    if (mediaTypes.length > 0 && !activeTabType) {
      setActiveTabType(mediaTypes[0]);
    }
  }, [mediaTypes, activeTabType]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setItems(newItems);
    setDraggedIndex(null);
  };

  const handleSaveRankings = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("Auth error. Please log in again.");
      setIsSaving(false);
      return;
    }

    // Map the current visual order into the exact payload our database expects
    const payload = items.map((item, index) => ({
      user_id: user.id,
      media_id: item.mediaId,
      media_type: item.type || 'unknown',
      rank_position: index + 1
    }));

    // Upsert sends a bulk array to Supabase in one single network request
    const { error } = await supabase
      .from('user_ranked_lists')
      .upsert(payload, { onConflict: 'user_id, media_id' });

    setIsSaving(false);

    if (error) {
      alert(`Error saving tier list: ${error.message}`);
    } else {
      // Optional: Show a nice toast notification here instead of an alert
      alert("🏆 Top 100 List officially updated!");
    }
  };

  if (items.length === 0) return <p className="text-gray-400 p-8">You haven't rated anything yet.</p>;

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">Your True Rank</h2>
          <p className="text-gray-400 text-sm mt-1">Drag and drop items to reorder them. This calculates the global True Rank.</p>
        </div>
        <button 
          onClick={handleSaveRankings} disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-blue-900/50 transition-all disabled:opacity-50"
        >
          {isSaving ? "Saving to DB..." : "Save List Order"}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div 
            key={item.mediaId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            className="flex items-center gap-4 bg-gray-950 p-3 rounded-xl border border-gray-800 cursor-grab active:cursor-grabbing hover:border-blue-500 transition-colors group"
          >
            {/* The Rank Number */}
            <div className="w-12 text-center font-black text-xl text-gray-700 group-hover:text-blue-500 transition-colors">
              #{index + 1}
            </div>

            {/* Thumbnail */}
            {item.image ? (
              <img src={item.image} alt={item.title} className="w-12 h-16 object-cover rounded shadow" />
            ) : (
              <div className="w-12 h-16 bg-gray-800 rounded flex items-center justify-center text-xs">No Img</div>
            )}

            {/* Details */}
            <div className="flex-1">
              <Link href={`/media/${item.mediaId}`} className="font-bold text-lg text-gray-200 hover:text-white">
                {item.title}
              </Link>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{item.type}</p>
            </div>

            {/* Original Numeric Score Indicator */}
            <div className="pr-4 text-right">
              <p className="text-xs text-gray-500 uppercase mb-1">Raw Score</p>
              <span className={`font-black ${item.score >= 75 ? 'text-green-400' : item.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {item.score}%
              </span>
            </div>
            
            {/* Drag Handle Icon */}
            <div className="text-gray-600 pr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}