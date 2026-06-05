"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProfileMediaItem } from "@/lib/media-db";
import MediaCardProfileHorizontal from "@/components/MediaCardProfileHorizontal";

export default function Top100Ranker() {
  const router = useRouter();
  
  const [activeTabType, setActiveTabType] = useState<string>("show");
  const [page, setPage] = useState(1);
  const limit = 50;

  const [items, setItems] = useState<ProfileMediaItem[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isUnsaved, setIsUnsaved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/profile/rankings?type=${activeTabType}&page=${page}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          const fetchedItems = data.results || [];
          setItems(fetchedItems);
          setCount(data.count || 0);
          
          const skip = (page - 1) * limit;
          const unsaved = fetchedItems.some((item: ProfileMediaItem, index: number) => item.rankPosition !== skip + index + 1);
          setIsUnsaved(unsaved);
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
    setIsUnsaved(true);
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

      setIsUnsaved(false);
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

      <div className="flex justify-start items-center bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl gap-4">
        <button
          onClick={handleSaveRankings}
          disabled={isSaving || isLoading || items.length === 0}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all disabled:bg-gray-800 shrink-0 shadow-lg"
        >
          {isSaving ? "Saving..." : "Save List Order"}
        </button>
        {isUnsaved && (
          <p className="text-sm text-red-400 font-bold">
            Current list order not saved!
          </p>
        )}
      </div>

      <div className={`space-y-2 transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
        {items.map((item, index) => (
          <MediaCardProfileHorizontal 
            key={item.mediaId}
            item={item}
            draggable={true}
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            visualRank={(page - 1) * limit + index + 1}
          />
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
