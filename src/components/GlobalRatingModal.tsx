"use client";

import { useEffect } from "react";
import RatingSlider from "@/components/RatingSlider";
import TextReviewEditor from "@/components/TextReviewEditor";
import { MediaItem } from "@/types";

interface GlobalRatingModalProps {
  item: MediaItem;
  onClose: () => void;
}

export default function GlobalRatingModal({ item, onClose }: GlobalRatingModalProps) {
  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <span className="text-sm font-bold uppercase tracking-widest">Close</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="flex items-center gap-4 mb-6">
          {item.image && (
            <img src={item.image} alt={item.title} className="w-16 h-24 object-cover rounded shadow-lg" />
          )}
          <div>
            <h2 className="text-3xl font-black text-white">{item.title}</h2>
            <p className="text-gray-400 font-bold tracking-wider">{item.type.toUpperCase()} • {item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <RatingSlider
            mediaId={item.id}
            mediaType={item.type as any}
            mediaTitle={item.title}
            mediaImage={item.image || null}
            mediaReleaseDate={item.releaseDate}
          />
          <TextReviewEditor 
            mediaId={item.id} 
            mediaTitle={item.title} 
            mediaImage={item.image || null} 
          />
        </div>
      </div>
    </div>
  );
}
