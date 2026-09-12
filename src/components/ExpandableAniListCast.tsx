"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

export default function ExpandableAniListCast({
  castData,
  mediaType,
}: {
  castData: any;
  mediaType?: string;
}) {
  const [isExtended, setIsExtended] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [language, setLanguage] = useState("Japanese");

  const isManga = mediaType === "manga";

  const availableLanguages = useMemo(() => {
    if (!castData || isManga) return [];
    const edges = Array.isArray(castData) ? castData : castData.edges;
    if (!edges || !Array.isArray(edges)) return [];
    const langs = new Set<string>();
    edges.forEach((edge: any) => {
      edge.voiceActors?.forEach((va: any) => {
        if (va.languageV2) langs.add(va.languageV2);
      });
    });
    return Array.from(langs).sort();
  }, [castData, isManga]);

  useEffect(() => {
    if (availableLanguages.length > 0 && !availableLanguages.includes(language)) {
      setLanguage(
        availableLanguages.includes("Japanese") ? "Japanese" : availableLanguages[0]
      );
    }
  }, [availableLanguages, language]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  if (!castData) return null;
  const edges = Array.isArray(castData) ? castData : castData.edges;
  if (!edges || !Array.isArray(edges) || edges.length === 0) return null;

  const mainCharacters = edges.filter((e: any) => e.role === "MAIN");
  const supportingCharacters = edges.filter((e: any) => e.role !== "MAIN");

  const defaultVisibleCount = 6;
  const sortedCast = [...mainCharacters, ...supportingCharacters];
  const visibleCast = isExtended
    ? sortedCast.slice(0, 18)
    : sortedCast.slice(0, defaultVisibleCount);

  return (
    <div className="lg:col-span-2">
      <div className="flex justify-between items-end mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">{isManga ? "Characters" : "Cast"}</h2>
          {!isManga && availableLanguages.length > 0 && (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-2.5 py-1"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          )}
        </div>
        {sortedCast.length > defaultVisibleCount && (
          <button
            type="button"
            onClick={() => setIsExtended(!isExtended)}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-900/50 cursor-pointer"
          >
            {isExtended ? "Show Less" : "Extend"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleCast.map((edge: any) => {
          const char = edge.node;
          const va = isManga
            ? null
            : edge.voiceActors?.find((v: any) => v.languageV2 === language);

          return (
            <div
              key={char.id}
              className="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group"
            >
              {/* Character Side */}
              <Link href={`#`} className="flex items-center gap-3 flex-1 min-w-0">
                {char.image?.large ? (
                  <img
                    src={char.image.large}
                    alt={char.name?.full}
                    className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 shrink-0">
                    N/A
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                    {char.name?.full}
                  </p>
                  <p className="text-xs text-gray-500 truncate uppercase tracking-wider">
                    {edge.role}
                  </p>
                </div>
              </Link>

              {/* Voice Actor Side */}
              {!isManga && (
                <Link
                  href={va ? `/person/anilist-${va.id}` : "#"}
                  className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-200 truncate hover:text-blue-400 transition-colors">
                      {va ? va.name?.full : "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{language}</p>
                  </div>
                  {va?.image?.large ? (
                    <img
                      src={va.image.large}
                      alt={va.name?.full}
                      className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 shrink-0">
                      N/A
                    </div>
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {sortedCast.length > 0 && (
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
                  {isManga ? "Full Characters" : "Full Cast"}
                </h2>
                <span className="text-xs text-gray-500 font-bold bg-gray-900 border border-gray-800 px-2.5 py-0.5 rounded-full">
                  {sortedCast.length} {isManga ? "Characters" : "Actors"}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {sortedCast.map((edge: any, idx) => {
                  const char = edge.node;
                  const va = isManga
                    ? null
                    : edge.voiceActors?.find(
                        (v: any) => v.languageV2 === language
                      );

                  return (
                    <div
                      key={`modal-${char.id}-${idx}`}
                      className="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group"
                    >
                      {/* Character Side */}
                      <Link
                        href={`#`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        {char.image?.large ? (
                          <img
                            src={char.image.large}
                            alt={char.name?.full}
                            className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 shrink-0">
                            N/A
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                            {char.name?.full}
                          </p>
                          <p className="text-xs text-gray-500 truncate uppercase tracking-wider">
                            {edge.role}
                          </p>
                        </div>
                      </Link>

                      {/* Voice Actor Side */}
                      {!isManga && (
                        <Link
                          href={va ? `/person/anilist-${va.id}` : "#"}
                          className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-200 truncate hover:text-blue-400 transition-colors">
                              {va ? va.name?.full : "N/A"}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {language}
                            </p>
                          </div>
                          {va?.image?.large ? (
                            <img
                              src={va.image.large}
                              alt={va.name?.full}
                              className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 shrink-0">
                              N/A
                            </div>
                          )}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
