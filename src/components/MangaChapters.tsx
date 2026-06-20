"use client";

import { useState, useEffect, useTransition } from "react";

interface Chapter {
  id: string;
  volume: string | null;
  chapter: string | null;
  title: string | null;
  publishAt: string;
}

interface MangaChaptersProps {
  mangadexId: string;
  totalChapters?: number | null;
}

export default function MangaChapters({ mangadexId, totalChapters }: MangaChaptersProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [volumes, setVolumes] = useState<string[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxChapter, setMaxChapter] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function fetchAllChapters() {
      try {
        setLoading(true);
        setError(null);

        let allChapters: any[] = [];
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

          allChapters = allChapters.concat(data.data);
          offset += limit;
          hasMore = offset < data.total;

          // Safety buffer to prevent infinite requests
          if (data.data.length < limit || offset >= 2500) {
            hasMore = false;
          }
        }

        if (!isMounted) return;

        const parsed: Chapter[] = allChapters.map((item: any) => ({
          id: item.id,
          volume: item.attributes.volume || null,
          chapter: item.attributes.chapter || null,
          title: item.attributes.title || null,
          publishAt: item.attributes.publishAt
        }));

        // Deduplicate chapters by chapter number
        const dedupedMap = new Map<string, Chapter>();
        parsed.forEach((c) => {
          const key = c.chapter || "unknown";
          const existing = dedupedMap.get(key);
          if (!existing) {
            dedupedMap.set(key, c);
          } else {
            // Prefer the one with a title
            if (!existing.title && c.title) {
              dedupedMap.set(key, c);
            } else if (existing.title && c.title) {
              // Both have titles. Keep the one that has a volume mapped
              if (!existing.volume && c.volume) {
                dedupedMap.set(key, c);
              }
            } else if (!existing.title && !c.title) {
              // Neither has a title. Keep the one with a volume mapped
              if (!existing.volume && c.volume) {
                dedupedMap.set(key, c);
              }
            }
          }
        });
        const dedupedChapters = Array.from(dedupedMap.values());

        // Sort chapters numerically
        dedupedChapters.sort((a, b) => {
          const numA = parseFloat(a.chapter || "0");
          const numB = parseFloat(b.chapter || "0");
          return numA - numB;
        });

        const chapterNumbers = dedupedChapters.map(c => parseFloat(c.chapter || "0")).filter(n => !isNaN(n));
        const computedMaxChap = chapterNumbers.length > 0 ? Math.max(...chapterNumbers) : 0;
        setMaxChapter(computedMaxChap);

        const uniqueVols = new Set<string>();
        dedupedChapters.forEach((c) => {
          uniqueVols.add(c.volume || "none");
        });

        const sortedVols = Array.from(uniqueVols).sort((a, b) => {
          if (a === "none") return 1;
          if (b === "none") return -1;
          return parseFloat(a) - parseFloat(b);
        });

        setChapters(dedupedChapters);
        setVolumes(sortedVols);
        if (sortedVols.length > 0) {
          setSelectedVolume(sortedVols[0]);
        }
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

    if (mangadexId) {
      fetchAllChapters();
    } else {
      setLoading(false);
      setError("No MangaDex ID linked to this manga.");
    }

    return () => {
      isMounted = false;
    };
  }, [mangadexId]);

  const handleVolumeChange = (vol: string) => {
    startTransition(() => {
      setSelectedVolume(vol);
    });
  };

  if (loading) {
    return (
      <div className="text-center py-16 bg-gray-900/10 rounded-2xl border border-gray-800 border-dashed animate-pulse">
        <p className="text-gray-400">Loading chapters from MangaDex...</p>
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
        <p className="text-gray-400">No English chapters found for this manga on MangaDex.</p>
      </div>
    );
  }

  const filteredChapters = chapters.filter((c) => (c.volume || "none") === selectedVolume);

  const expectedChapters = totalChapters || maxChapter;
  const isMissingChapters = expectedChapters > 0 && chapters.length < expectedChapters - 5;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-500">
            ({chapters.length} chapters fetched / {volumes.filter(v => v !== "none").length} volumes)
          </span>
        </div>
        
        {volumes.length > 1 && (
          <select
            className="bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-4 py-2 font-bold focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            value={selectedVolume}
            onChange={(e) => handleVolumeChange(e.target.value)}
          >
            {volumes.map((v) => (
              <option key={v} value={v}>
                {v === "none" ? "Other / Unassigned" : `Volume ${v}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {isMissingChapters && (
        <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4 mb-6 text-sm text-gray-300 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-bold text-blue-400 block mb-1">MangaPlus / Publisher Licensing Notice</span>
            For officially licensed manga, intermediate chapters often expire and are removed from MangaDex by the publisher (like MangaPlus or Viz). Because fan translation groups do not translate these chapters due to the official release, some volumes and chapters may be unavailable on MangaDex.
          </div>
        </div>
      )}

      <div className={`flex flex-col gap-2 transition-opacity duration-200 ${isPending ? "opacity-50" : "opacity-100"}`}>
        {filteredChapters.map((chap) => (
          <a
            key={chap.id}
            href={`https://mangadex.org/chapter/${chap.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900/40 rounded-lg border border-gray-800/60 hover:border-blue-500 hover:bg-gray-800/80 transition-colors flex items-center justify-between p-3 group shadow-sm"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-gray-500 font-black text-sm shrink-0 w-16 text-center group-hover:text-blue-500 transition-colors">
                CH {chap.chapter || "?"}
              </span>
              <p className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors truncate">
                {chap.title || `Chapter ${chap.chapter || "?"}`}
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-4">
              {chap.publishAt && (
                <span className="text-xs text-gray-500 font-medium hidden sm:block">
                  {new Date(chap.publishAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
