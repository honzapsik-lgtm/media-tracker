"use client";

import { useState, useRef, useEffect } from "react";
import { MediaItem } from "@/types";
import GlobalRatingModal from "@/components/GlobalRatingModal";
import RankListSelectModal from "@/components/RankListSelectModal";

interface MediaActionMenuProps {
  item: MediaItem;
}

export default function MediaActionMenu({ item }: MediaActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isRankListOpen, setIsRankListOpen] = useState(false);
  const [isWatchlisting, setIsWatchlisting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const getWatchlistLabel = () => {
    if (item.type === "game") return "Add to Backlog";
    if (item.type === "manga") return "Add to Readlist";
    return "Add to Watchlist";
  };

  const handleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    setIsWatchlisting(true);
    
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: item.id,
          mediaType: item.type,
          mediaTitle: item.title,
          mediaImage: item.image,
          mediaReleaseDate: item.releaseDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to update watchlist");
      // Could show a toast here, but we will just silently succeed or fail as requested
    } catch (err) {
      console.error(err);
    } finally {
      setIsWatchlisting(false);
    }
  };

  const handleRateReview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    setIsRatingOpen(true);
  };

  const handleAddToList = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    setIsRankListOpen(true);
  };

  return (
    <div className="relative" ref={menuRef} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button
        onClick={handleMenuClick}
        className="p-1.5 rounded-full bg-gray-900/80 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors backdrop-blur-md"
        title="More Actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden text-sm">
          <button
            onClick={handleWatchlist}
            disabled={isWatchlisting}
            className="w-full text-left px-4 py-3 hover:bg-gray-800 text-gray-200 transition-colors disabled:opacity-50"
          >
            {isWatchlisting ? "Adding..." : getWatchlistLabel()}
          </button>
          <button
            onClick={handleRateReview}
            className="w-full text-left px-4 py-3 hover:bg-gray-800 text-gray-200 transition-colors"
          >
            Rate / Review
          </button>
          <button
            onClick={handleAddToList}
            className="w-full text-left px-4 py-3 hover:bg-gray-800 text-gray-200 transition-colors"
          >
            Add to Rank List
          </button>
        </div>
      )}

      {isRatingOpen && (
        <GlobalRatingModal item={item} onClose={() => setIsRatingOpen(false)} />
      )}

      {isRankListOpen && (
        <RankListSelectModal item={item} onClose={() => setIsRankListOpen(false)} />
      )}
    </div>
  );
}
