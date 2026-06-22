'use client';

import React, { useRef, useState, useEffect } from 'react';

export default function Carousel({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canScrollLeft = el.scrollLeft > 10;
    const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 10;
    setShowLeftArrow(canScrollLeft);
    setShowRightArrow(canScrollRight);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    // Check initial state
    checkArrows();

    // Set up resize observer to check arrows when size changes
    const resizeObserver = new ResizeObserver(() => {
      checkArrows();
    });
    resizeObserver.observe(el);

    // Also check on scroll
    el.addEventListener('scroll', checkArrows, { passive: true });

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener('scroll', checkArrows);
    };
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <div className="relative group/carousel w-full">
      {/* Left Arrow Button */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-gray-900/90 hover:bg-gray-800 border border-gray-800/80 hover:border-gray-700 text-white flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm"
          aria-label="Scroll Left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto pb-4 gap-6 snap-x hide-scrollbar scroll-smooth w-full -mx-6 px-6 sm:mx-0 sm:px-0"
      >
        {children}
      </div>

      {/* Right Arrow Button */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-gray-900/90 hover:bg-gray-800 border border-gray-800/80 hover:border-gray-700 text-white flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm"
          aria-label="Scroll Right"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
