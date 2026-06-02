"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RankerItem {
  mediaId: string;
  title: string;
  image: string | null;
  type: string;
  score: number;
  rankPosition: number | null;
}

export default function Top100Ranker() {
  const router = useRouter();
  
  const [activeTabType, setActiveTabType] = useState<string>("show");
  const [page, setPage] = useState(1);
  const limit = 50;

  const [items, setItems] = useState<RankerItem[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/profile/rankings?type=${activeTabType}&page=${page}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.results || []);
          setCount(data.count || 0);
        }
      } catch (err) {
        console.error("Failed to fetch rankings", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTabType, page]);

  const handleTabSwitch = (type: string) => {
    setActiveTabType(type);
    setPage(1);
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...items];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setItems(updated);
    setDraggedIndex(null);
  };

  const handleSaveRankings = async () => {
    setIsSaving(true);
    try {
      const skip = (page - 1) * limit;
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rankings: items.map((item, index) => ({
            mediaId: item.mediaId,
            rankPosition: skip + index + 1, // Calculate exact rank position for this page
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save rankings.");
      }

      alert("Rankings saved successfully!");
      router.refresh(); 
    } catch (err) {
      console.error("Critical error saving rankings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ["game", "movie", "show", "season", "episode", "manga"];

  const hasNext = page * limit < count;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-800 gap-2">
        {categories.map((type) => (
          <button
            key={type}
            onClick={() => handleTabSwitch(type)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-all border-b-2 -mb-px ${
              activeTabType === type
                ? "border-blue-500 text-blue-400 font-black"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {type}s
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl">
        <p className="text-sm text-blue-200 font-medium max-w-2xl">
          Drag and drop items to sort your infinite tier lists. Note: You are currently sorting items on <strong>Page {page}</strong> (Ranks {(page - 1) * limit + 1} to {Math.min(page * limit, count || limit)}). Unranked items sit at the bottom.
        </p>
        <button
          onClick={handleSaveRankings}
          disabled={isSaving || isLoading || items.length === 0}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all disabled:bg-gray-800 shrink-0 shadow-lg"
        >
          {isSaving ? "Saving..." : "Save List Order"}
        </button>
      </div>

      <div className={`space-y-2 transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
        {items.map((item, index) => (
          <div
            key={item.mediaId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="flex items-center gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl hover:border-gray-700 transition-all cursor-grab active:cursor-grabbing select-none"
          >
            <span className="w-8 text-center text-xl font-black text-gray-600">
              #{(page - 1) * limit + index + 1}
            </span>

            {item.image ? (
              <img src={item.image} alt={item.title} className="w-12 h-16 object-cover rounded-lg shadow-md shrink-0" />
            ) : (
              <div className="w-12 h-16 bg-gray-950 rounded-lg border border-gray-800 flex items-center justify-center text-[10px] text-gray-600 font-bold shrink-0">
                NO IMG
              </div>
            )}

            <div className="flex-1 min-w-0">
              <Link href={`/media/${item.mediaId}`} className="font-bold text-base text-gray-200 hover:text-blue-400 transition-colors block truncate">
                {item.title}
              </Link>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-950 text-gray-500 border border-gray-800/60 inline-block mt-1">
                {item.type}
              </span>
            </div>

            <div className="pr-2 text-right hidden sm:block">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Rating</p>
              <span className={`text-base font-black ${item.score >= 75 ? 'text-green-400' : item.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {item.score}%
              </span>
            </div>
          </div>
        ))}

        {items.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500 italic text-sm border border-dashed border-gray-800 rounded-2xl">
            No rated {activeTabType}s discovered yet. Go rate some to build your ranking leaderboard!
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {(hasPrev || hasNext) && (
        <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-gray-800">
          {hasPrev ? (
            <button onClick={() => setPage(p => p - 1)} className="bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-400 font-bold py-2 px-6 rounded-lg transition-colors text-sm">
              ← Prev
            </button>
          ) : <div className="w-24"></div>}
          
          <span className="text-gray-500 font-bold text-sm">
            Page {page} of {Math.ceil(count / limit)}
          </span>
          
          {hasNext ? (
            <button onClick={() => setPage(p => p + 1)} className="bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-400 font-bold py-2 px-6 rounded-lg transition-colors text-sm">
              Next →
            </button>
          ) : <div className="w-24"></div>}
        </div>
      )}
    </div>
  );
}
