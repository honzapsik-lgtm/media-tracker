import { discoverMedia } from "@/app/actions";
import DiscoverFilters from "@/components/DiscoverFilters";
import Link from "next/link";
import { getListRankMap, getMediaStatsMap } from "@/lib/media-db";
import type { DiscoverMediaItem } from "@/app/actions";
import MediaCardVertical from "@/components/MediaCardVertical";

// Force Next.js to always fetch fresh Database scores instead of caching the page
export const dynamic = "force-dynamic";
export const revalidate = 0;

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "bg-gray-900/80 text-gray-500 border-gray-700";
  if (score >= 95) return "bg-yellow-900/80 text-yellow-400 border-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.4)]"; 
  if (score >= 75) return "bg-green-900/80 text-green-400 border-green-500";
  if (score >= 50) return "bg-blue-900/80 text-blue-400 border-blue-500";
  if (score >= 25) return "bg-gray-800 text-gray-400 border-gray-600";
  return "bg-gray-900/80 text-gray-500 border-gray-700"; 
};

export default async function DiscoverPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  const params = await searchParams;
  const type = params.type || "movie";
  const genre = params.genre || "";
  const year = params.year || "";
  const sort = params.sort || "popular";

  const results = await discoverMedia(type, genre, year, sort);

  const mediaIds = results?.map((r) => r.id) || [];
  const [statsMap, rankMap] = await Promise.all([
    getMediaStatsMap(mediaIds),
    getListRankMap(mediaIds),
  ]);

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-24 pt-12">
      <div className="max-w-7xl mx-auto px-8">
        <h1 className="text-4xl font-black mb-8">Discover</h1>
        
        <DiscoverFilters />

        {!results || results.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
            <p className="text-gray-400 text-lg">No results found for these filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {results.map((item: DiscoverMediaItem) => {
              const cScore = statsMap[item.id];
              const gRank = rankMap[item.id];

              return (
                <MediaCardVertical 
                  key={item.id} 
                  item={{
                    ...item,
                    communityScore: cScore || null,
                    listRank: gRank || null,
                    releaseDate: item.releaseDate ?? null,
                  }} 
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
