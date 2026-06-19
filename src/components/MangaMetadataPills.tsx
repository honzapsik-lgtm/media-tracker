"use client";

import { useEffect, useState } from "react";

interface MangaMetadataPillsProps {
  mangadexId: string | null;
  initialChapters: number | null;
  initialVolumes: number | null;
  status: string | null;
}

function getStatusLabel(status: string | null): string | null {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'RELEASING') return 'Publishing';
  if (s === 'FINISHED') return 'Finished';
  if (s === 'HIATUS') return 'Hiatus';
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'NOT_YET_RELEASED') return 'Not Yet Released';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusStyle(label: string | null): string {
  if (!label) return '';
  const norm = label.toLowerCase();
  if (norm.includes('publishing')) {
    return 'border-green-800/60 bg-green-950/30 text-green-400';
  }
  if (norm.includes('hiatus')) {
    return 'border-yellow-800/60 bg-yellow-950/30 text-yellow-400';
  }
  if (norm.includes('cancelled')) {
    return 'border-red-800/60 bg-red-950/30 text-red-400';
  }
  if (norm.includes('not yet released')) {
    return 'border-blue-800/60 bg-blue-950/30 text-blue-400';
  }
  return 'border-gray-800 bg-gray-900/80 text-gray-400';
}

export default function MangaMetadataPills({
  mangadexId,
  initialChapters,
  initialVolumes,
  status,
}: MangaMetadataPillsProps) {
  const [chapters, setChapters] = useState<string | null>(
    initialChapters ? `${initialChapters} chapters` : null
  );
  const [volumes, setVolumes] = useState<string | null>(
    initialVolumes ? `${initialVolumes} volumes` : null
  );

  useEffect(() => {
    // If we already have both initial values, no need to fetch fallback metadata
    if (initialChapters && initialVolumes) return;
    if (!mangadexId) return;

    let isMounted = true;

    async function fetchMetadata() {
      try {
        const res = await fetch(`https://api.mangadex.org/manga/${mangadexId}/aggregate`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json.volumes) return;

        let maxVol = 0;
        let maxChap = 0;

        Object.keys(json.volumes).forEach((volKey) => {
          if (volKey !== "none") {
            const volNum = parseFloat(volKey);
            if (!isNaN(volNum) && volNum > maxVol) {
              maxVol = volNum;
            }
          }

          const volData = json.volumes[volKey];
          if (volData && volData.chapters) {
            Object.keys(volData.chapters).forEach((chapKey) => {
              const chapNum = parseFloat(chapKey);
              if (!isNaN(chapNum) && chapNum > maxChap) {
                maxChap = chapNum;
              }
            });
          }
        });

        if (!isMounted) return;

        if (!initialChapters && maxChap > 0) {
          setChapters(`${maxChap} chapters`);
        }
        if (!initialVolumes && maxVol > 0) {
          setVolumes(`${maxVol} volumes`);
        }
      } catch (err) {
        console.error("Failed to fetch fallback manga metadata", err);
      }
    }

    fetchMetadata();

    return () => {
      isMounted = false;
    };
  }, [mangadexId, initialChapters, initialVolumes]);

  const statusLabel = getStatusLabel(status);
  const statusStyle = getStatusStyle(statusLabel);

  if (!chapters && !volumes && !statusLabel) return null;

  return (
    <>
      {chapters && (
        <>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
            {chapters}
          </span>
        </>
      )}
      {volumes && (
        <>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <span className="bg-gray-900/80 border border-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
            {volumes}
          </span>
        </>
      )}
      {statusLabel && (
        <>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <span className={`border px-3 py-1 rounded-full text-xs font-bold ${statusStyle}`}>
            {statusLabel}
          </span>
        </>
      )}
    </>
  );
}
