"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MediaCredit } from "@/types";

export default function ExpandableCast({
  cast,
  title = "Cast",
}: {
  cast: MediaCredit[];
  title?: string;
}) {
  const [isExtended, setIsExtended] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  if (!cast || cast.length === 0) return null;

  // Show 6 actors by default, extend to 18 when requested
  const visibleCast = isExtended ? cast.slice(0, 18) : cast.slice(0, 6);

  return (
    <div className="lg:col-span-2">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        {cast.length > 6 && (
          <button
            type="button"
            onClick={() => setIsExtended(!isExtended)}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-900/50 cursor-pointer"
          >
            {isExtended ? "Show Less" : "Extend"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {visibleCast.map((actor, idx) => (
          <Link
            href={`/person/${actor.id}`}
            key={`${actor.id}-${idx}`}
            className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group"
          >
            {actor.image ? (
              <img
                src={actor.image}
                alt={actor.name}
                className="w-14 h-14 rounded-full object-cover shadow-md border border-gray-700 group-hover:border-blue-500 transition-colors shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 group-hover:border-blue-500 transition-colors shrink-0">
                {actor.name?.[0] || "N/A"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                {actor.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{actor.role}</p>
            </div>
          </Link>
        ))}
      </div>

      {cast.length > 0 && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="mt-6 text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest cursor-pointer"
        >
          + View Full Cast
        </button>
      )}

      {/* FULL CAST MODAL PORTAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center p-6 border-b border-gray-800/60 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-white tracking-widest uppercase">
                  Full Cast
                </h2>
                <span className="text-xs text-gray-500 font-bold bg-gray-900 border border-gray-800 px-2.5 py-0.5 rounded-full">
                  {cast.length} Actors
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-900 cursor-pointer"
                aria-label="Close modal"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start">
                {cast.map((actor, idx) => (
                  <Link
                    href={`/person/${actor.id}`}
                    key={`modal-${actor.id}-${idx}`}
                    className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group"
                  >
                    {actor.image ? (
                      <img
                        src={actor.image}
                        alt={actor.name}
                        className="w-14 h-14 rounded-full object-cover shadow-md border border-gray-700 group-hover:border-blue-500 transition-colors shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 group-hover:border-blue-500 transition-colors shrink-0">
                        {actor.name?.[0] || "N/A"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                        {actor.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {actor.role}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}