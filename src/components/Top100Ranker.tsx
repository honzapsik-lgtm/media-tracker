"use client";

import { useMemo, useState } from "react";
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

const sortItems = (rawData: RankerItem[]) =>
  [...rawData].sort((a, b) => {
    if (a.rankPosition && b.rankPosition) return a.rankPosition - b.rankPosition;
    if (a.rankPosition) return -1;
    if (b.rankPosition) return 1;
    return b.score - a.score;
  });

export default function Top100Ranker({ rawData }: { rawData: RankerItem[] }) {
  const router = useRouter();
  const sortedData = useMemo(() => sortItems(rawData), [rawData]);
  const [items, setItems] = useState(sortedData);
  
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Defaulting to "show" since that is what you are testing right now
  const [activeTabType, setActiveTabType] = useState<string>("show");

  const filteredItems = items.filter(
    (item) => (item.type || "").toLowerCase() === activeTabType.toLowerCase()
  );

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updatedFiltered = [...filteredItems];
    const [movedItem] = updatedFiltered.splice(draggedIndex, 1);
    updatedFiltered.splice(targetIndex, 0, movedItem);

    const nonFilteredItems = items.filter(
      (item) => (item.type || "").toLowerCase() !== activeTabType.toLowerCase()
    );
    
    setItems([...updatedFiltered, ...nonFilteredItems]);
    setDraggedIndex(null);
  };

  const handleSaveRankings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rankings: filteredItems.map((item, index) => ({
            mediaId: item.mediaId,
            rankPosition: index + 1,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save rankings.");
      }

      alert("Infinite Rankings saved successfully!");
      router.refresh(); // Instantly update the master UI cache
    } catch (err) {
      console.error("Critical error saving rankings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ["game", "movie", "show", "manga"];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-800 gap-2">
        {categories.map((type) => (
          <button
            key={type}
            onClick={() => setActiveTabType(type)}
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

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400 font-medium">
          Drag and drop items to sort your infinite tier lists. Unranked items sit at the bottom.
        </p>
        <button
          onClick={handleSaveRankings}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-4 rounded-xl text-sm transition-all disabled:bg-gray-800"
        >
          {isSaving ? "Saving..." : "Save List Order"}
        </button>
      </div>

      <div className="space-y-2">
        {filteredItems.map((item, index) => (
          <div
            key={item.mediaId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="flex items-center gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl hover:border-gray-700 transition-all cursor-grab active:cursor-grabbing select-none"
          >
            <span className="w-8 text-center text-xl font-black text-gray-600">
              #{index + 1}
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

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-500 italic text-sm border border-dashed border-gray-800 rounded-2xl">
            No rated {activeTabType}s discovered yet. Go rate some to build your ranking leaderboard!
          </div>
        )}
      </div>
    </div>
  );
}
