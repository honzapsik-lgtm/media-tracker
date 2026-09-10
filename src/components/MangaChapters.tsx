"use client";

import { useState, useEffect, useTransition } from "react";
import RatingSlider from "@/components/RatingSlider";

interface Chapter {
  id: string;
  volume: string | null;
  chapter: string | null;
  title: string | null;
  publishAt?: string;
  isSynthetic?: boolean;
}

interface MangaChaptersProps {
  mangadexId?: string | null;
  totalChapters?: number | null;
  totalVolumes?: number | null;
  mediaId: string;
  mediaTitle: string;
  mediaImage?: string | null;
}

const CHUNK_SIZE = 50;

export default function MangaChapters({
  mangadexId,
  totalChapters,
  totalVolumes,
  mediaId,
  mediaTitle,
  mediaImage,
}: MangaChaptersProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [volumes, setVolumes] = useState<string[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>("all");
  const [activeChunk, setActiveChunk] = useState<number | "all">(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeChapterRater, setActiveChapterRater] = useState<string | null>(null);
  const [userScores, setUserScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSynthetic, setHasSynthetic] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // 1. Fetch user's existing ratings for chapters of this manga
  useEffect(() => {
    let isMounted = true;
    async function fetchUserChapterRatings() {
      try {
        const res = await fetch(`/api/ratings?prefix=${encodeURIComponent(`${mediaId}-ch-`)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ratings && isMounted) {
          const parsedScores: Record<string, number> = {};
          for (const [key, score] of Object.entries(data.ratings)) {
            const chMatch = key.match(/-ch-(.+)$/);
            if (chMatch && chMatch[1]) {
              parsedScores[chMatch[1]] = score as number;
            }
          }
          setUserScores(parsedScores);
        }
      } catch (err) {
        console.error("Failed to fetch user chapter ratings:", err);
      }
    }

    if (mediaId) {
      fetchUserChapterRatings();
    }
    return () => {
      isMounted = false;
    };
  }, [mediaId]);

  // 2. Fetch MangaDex chapters feed and synthesize missing chapters
  useEffect(() => {
    let isMounted = true;

    async function fetchAllChapters() {
      try {
        setLoading(true);
        setError(null);

        let resolvedTotalChapters = totalChapters || null;
        let resolvedTotalVolumes = totalVolumes || null;
        let allMangaDexChapters: any[] = [];

        // Check MangaDex details if we lack total chapters or volumes
        if (mangadexId) {
          if (!resolvedTotalChapters || !resolvedTotalVolumes) {
            try {
              const mdRes = await fetch(`https://api.mangadex.org/manga/${mangadexId}`);
              if (mdRes.ok) {
                const mdData = await mdRes.json();
                const lastCh = parseFloat(mdData.data?.attributes?.lastChapter);
                if (!isNaN(lastCh) && lastCh > 0 && (!resolvedTotalChapters || lastCh > resolvedTotalChapters)) {
                  resolvedTotalChapters = lastCh;
                }
                const lastVol = parseFloat(mdData.data?.attributes?.lastVolume);
                if (!isNaN(lastVol) && lastVol > 0 && !resolvedTotalVolumes) {
                  resolvedTotalVolumes = lastVol;
                }
              }
            } catch {
              // Non-fatal: continue with feed
            }
          }

          // Fetch feed from MangaDex
          let offset = 0;
          let hasMore = true;
          const limit = 500;

          while (hasMore && isMounted) {
            const url = `https://api.mangadex.org/manga/${mangadexId}/feed?translatedLanguage[]=en&limit=${limit}&offset=${offset}&order[volume]=asc&order[chapter]=asc`;
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`Failed to fetch chapters: Status ${res.status}`);
            }
            const data = await res.json();
            if (!data.data || data.data.length === 0) {
              break;
            }

            allMangaDexChapters = allMangaDexChapters.concat(data.data);
            offset += limit;
            hasMore = offset < data.total;

            if (data.data.length < limit || offset >= 2500) {
              hasMore = false;
            }
          }
        }

        if (!isMounted) return;

        const parsed: Chapter[] = allMangaDexChapters.map((item: any) => ({
          id: item.id,
          volume: item.attributes.volume || null,
          chapter: item.attributes.chapter || null,
          title: item.attributes.title || null,
          publishAt: item.attributes.publishAt,
          isSynthetic: false,
        }));

        // Deduplicate MangaDex chapters by chapter number
        const dedupedMap = new Map<string, Chapter>();
        parsed.forEach((c) => {
          const key = c.chapter || "unknown";
          const existing = dedupedMap.get(key);
          if (!existing) {
            dedupedMap.set(key, c);
          } else {
            if (!existing.title && c.title) {
              dedupedMap.set(key, c);
            } else if (existing.title && c.title) {
              if (!existing.volume && c.volume) {
                dedupedMap.set(key, c);
              }
            } else if (!existing.title && !c.title) {
              if (!existing.volume && c.volume) {
                dedupedMap.set(key, c);
              }
            }
          }
        });

        const dedupedChapters = Array.from(dedupedMap.values());
        const chapterNumbers = dedupedChapters
          .map((c) => parseFloat(c.chapter || "0"))
          .filter((n) => !isNaN(n));
        const maxFromFeed = chapterNumbers.length > 0 ? Math.max(...chapterNumbers) : 0;
        const finalMaxChapter = Math.max(resolvedTotalChapters || 0, maxFromFeed);

        // Map existing real chapters by numeric index
        const finalChapterMap = new Map<string, Chapter>();
        dedupedChapters.forEach((c) => {
          const num = parseFloat(c.chapter || "");
          const key = !isNaN(num) ? String(num) : (c.chapter || c.id);
          finalChapterMap.set(key, c);
        });

        let syntheticFound = false;

        // Fill in missing chapters 1..finalMaxChapter
        if (finalMaxChapter > 0) {
          const chaptersPerVolume =
            resolvedTotalVolumes && resolvedTotalVolumes > 0
              ? finalMaxChapter / resolvedTotalVolumes
              : null;

          for (let i = 1; i <= Math.floor(finalMaxChapter); i++) {
            const key = String(i);
            if (!finalChapterMap.has(key)) {
              syntheticFound = true;
              let estVolume = "none";
              if (chaptersPerVolume && resolvedTotalVolumes) {
                const volNum = Math.min(
                  resolvedTotalVolumes,
                  Math.max(1, Math.ceil(i / chaptersPerVolume))
                );
                estVolume = String(volNum);
              }

              finalChapterMap.set(key, {
                id: `synthetic-${mangadexId || mediaId}-ch-${i}`,
                volume: estVolume,
                chapter: String(i),
                title: `Chapter ${i}`,
                publishAt: undefined,
                isSynthetic: true,
              });
            }
          }
        }

        const allChaptersList = Array.from(finalChapterMap.values());
        allChaptersList.sort((a, b) => {
          const numA = parseFloat(a.chapter || "0");
          const numB = parseFloat(b.chapter || "0");
          return numA - numB;
        });

        const uniqueVols = new Set<string>();
        allChaptersList.forEach((c) => {
          uniqueVols.add(c.volume || "none");
        });

        const sortedVols = Array.from(uniqueVols).sort((a, b) => {
          if (a === "none") return 1;
          if (b === "none") return -1;
          return parseFloat(a) - parseFloat(b);
        });

        setChapters(allChaptersList);
        setVolumes(sortedVols);
        setHasSynthetic(syntheticFound);
      } catch (err: any) {
        console.error(err);
        if (isMounted) {
          setError(err.message || "Failed to load chapters.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (mangadexId || totalChapters) {
      fetchAllChapters();
    } else {
      setLoading(false);
      setError("No chapters found for this manga.");
    }

    return () => {
      isMounted = false;
    };
  }, [mangadexId, totalChapters, totalVolumes, mediaId]);

  const handleVolumeChange = (vol: string) => {
    startTransition(() => {
      setSelectedVolume(vol);
      setActiveChunk(0);
    });
  };

  if (loading) {
    return (
      <div className="text-center py-16 bg-gray-900/10 rounded-2xl border border-gray-800 border-dashed animate-pulse">
        <p className="text-gray-400">Loading chapters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-red-950/20 rounded-2xl border border-red-900/50 border-dashed">
        <p className="text-red-400 font-semibold">{error}</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
        <p className="text-gray-400">No chapters found for this manga.</p>
      </div>
    );
  }

  // Filter chapters based on search query or selected volume
  const filteredChapters = chapters.filter((chap) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const numMatch = chap.chapter?.toLowerCase() === q || chap.chapter?.toLowerCase().startsWith(q);
      const titleMatch = chap.title?.toLowerCase().includes(q);
      return numMatch || titleMatch;
    }
    if (selectedVolume !== "all") {
      return (chap.volume || "none") === selectedVolume;
    }
    return true;
  });

  // Calculate chunks when viewing "all" without active search query
  const shouldChunk = selectedVolume === "all" && !searchQuery.trim() && filteredChapters.length > CHUNK_SIZE;
  const chunkCount = shouldChunk ? Math.ceil(filteredChapters.length / CHUNK_SIZE) : 1;
  const visibleChapters = shouldChunk && activeChunk !== "all"
    ? filteredChapters.slice(activeChunk * CHUNK_SIZE, (activeChunk + 1) * CHUNK_SIZE)
    : filteredChapters;

  return (
    <div>
      {/* Controls Bar: Counts, Search, and Volume Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-400">
            {chapters.length} chapters total
            {volumes.filter((v) => v !== "none").length > 0 && ` across ${volumes.filter((v) => v !== "none").length} volumes`}
          </span>
          {Object.keys(userScores).length > 0 && (
            <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-full w-fit">
              ★ {Object.keys(userScores).length} rated
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Jump / Search Input */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Jump to chapter #..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setActiveChunk("all");
              }}
              className="w-full sm:w-56 bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 pl-9 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <svg
              className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Volume Dropdown */}
          {volumes.length > 1 && (
            <select
              className="bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 font-bold focus:outline-none focus:border-blue-500 transition-colors cursor-pointer text-sm"
              value={selectedVolume}
              onChange={(e) => handleVolumeChange(e.target.value)}
            >
              <option value="all">All Chapters ({chapters.length})</option>
              {volumes.map((v) => {
                const volCount = chapters.filter((c) => (c.volume || "none") === v).length;
                return (
                  <option key={v} value={v}>
                    {v === "none" ? `Other / Unassigned (${volCount})` : `Volume ${v} (${volCount} ch)`}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* Chunk Range Selector (when viewing All Chapters and count > 50) */}
      {shouldChunk && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs font-semibold text-gray-500 mr-1">Range:</span>
          {Array.from({ length: chunkCount }, (_, idx) => {
            const start = idx * CHUNK_SIZE + 1;
            const end = Math.min((idx + 1) * CHUNK_SIZE, filteredChapters.length);
            const isCurrent = activeChunk === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveChunk(idx)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  isCurrent
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:border-gray-700"
                }`}
              >
                Ch {start} – {end}
              </button>
            );
          })}
          <button
            onClick={() => setActiveChunk("all")}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
              activeChunk === "all"
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:border-gray-700"
            }`}
          >
            Show All ({filteredChapters.length})
          </button>
        </div>
      )}

      {/* Synthetic Chapters / Publisher Licensing Notice */}
      {hasSynthetic && (
        <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4 mb-6 text-sm text-gray-300 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-bold text-blue-400 block mb-1">MangaPlus / Publisher Licensing Notice</span>
            For officially licensed manga, intermediate chapters often expire and are removed from MangaDex by the publisher (like MangaPlus or Viz). All {chapters.length} chapters are generated here so you can log and rate every single chapter of the manga!
          </div>
        </div>
      )}

      {/* Chapters List */}
      <div className="flex flex-col gap-2.5">
        {visibleChapters.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/20 rounded-xl border border-gray-800 border-dashed">
            <p className="text-gray-400 text-sm">No chapters match your search query.</p>
          </div>
        ) : (
          visibleChapters.map((chap) => {
            const chapKey = chap.chapter || chap.id;
            const isRaterActive = activeChapterRater === chapKey;
            const ratingScore = chap.chapter ? userScores[chap.chapter] : undefined;

            return (
              <div
                key={chap.id}
                className="bg-gray-900/40 rounded-xl border border-gray-800/80 hover:border-gray-700 transition-colors flex flex-col overflow-hidden"
              >
                <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-black text-xs sm:text-sm px-2.5 py-1 rounded bg-gray-800 text-blue-400 shrink-0 text-center min-w-16">
                      CH {chap.chapter || "?"}
                    </span>
                    {chap.volume && chap.volume !== "none" && (
                      <span className="text-[11px] font-bold text-gray-500 shrink-0">
                        Vol. {chap.volume}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <p className="font-bold text-sm text-gray-200 truncate">
                        {chap.title || `Chapter ${chap.chapter || "?"}`}
                      </p>
                      {chap.isSynthetic && (
                        <span className="text-[10px] bg-gray-800/80 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700/60 font-medium shrink-0 hidden sm:inline-block">
                          Official Release
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                    {/* User Rating Badge if already rated */}
                    {ratingScore !== undefined && (
                      <div className="flex items-center gap-1 bg-blue-950/80 border border-blue-500/60 text-blue-300 font-black text-xs px-2.5 py-1 rounded-lg">
                        <span>★</span>
                        <span>{ratingScore}%</span>
                      </div>
                    )}

                    {/* MangaDex Reader Link (only for real MangaDex chapters) */}
                    {!chap.isSynthetic && chap.id && (
                      <a
                        href={`https://mangadex.org/chapter/${chap.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700/80 transition-colors inline-flex items-center gap-1"
                      >
                        <span>Read</span>
                        <span className="text-[10px]">↗</span>
                      </a>
                    )}

                    {/* Rate Chapter Button */}
                    <button
                      onClick={() => setActiveChapterRater(isRaterActive ? null : chapKey)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                        isRaterActive
                          ? "bg-gray-700 text-white border-gray-600"
                          : ratingScore !== undefined
                          ? "bg-blue-900/40 text-blue-300 border-blue-700 hover:bg-blue-900/60"
                          : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                      }`}
                    >
                      {isRaterActive
                        ? "Close"
                        : ratingScore !== undefined
                        ? "Edit Rating"
                        : "Rate Chapter"}
                    </button>
                  </div>
                </div>

                {/* Inline Expandable Rating Slider */}
                {isRaterActive && (
                  <div className="p-6 bg-gray-950/90 border-t border-gray-800 flex justify-center animate-in slide-in-from-top-2 duration-200">
                    <RatingSlider
                      mediaId={`${mediaId}-ch-${chap.chapter || chap.id}`}
                      mediaType="manga"
                      mediaTitle={`${mediaTitle} - Chapter ${chap.chapter}${
                        chap.title && !chap.title.startsWith("Chapter") ? `: ${chap.title}` : ""
                      }`}
                      mediaImage={mediaImage || null}
                      onSaved={(score) => {
                        if (chap.chapter) {
                          setUserScores((prev) => ({ ...prev, [chap.chapter!]: score }));
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
