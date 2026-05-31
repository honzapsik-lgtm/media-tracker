import { discoverMedia } from "@/app/actions";
import DiscoverFilters from "@/components/DiscoverFilters";
import Link from "next/link";
import { getListRankMap, getMediaStatsMap } from "@/lib/media-db";
import type { DiscoverMediaItem } from "@/app/actions";

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
                <Link 
                  href={`/media/${item.id}`} 
                  key={item.id} 
                  className="block hover:scale-105 transition-transform duration-300 relative group"
                >
                  <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg h-full border border-gray-800 relative flex flex-col">
                    
                    {/* Top Left: Community Score Badge (Always Visible) */}
                    <div className={`absolute top-2 left-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border backdrop-blur-md transition-colors ${getScoreColor(cScore)}`}>
                      ★ {cScore ? `${cScore}%` : 'N/A'}
                    </div>

                    {/* Top Right: List Rank Badge (Always Visible) */}
                    <div className={`absolute top-2 right-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border backdrop-blur-md transition-colors ${
                      gRank ? 'bg-blue-900/80 text-blue-400 border-blue-500' : 'bg-gray-900/80 text-gray-500 border-gray-700'
                    }`}>
                      {gRank ? `#${gRank}` : '# -'}
                    </div>
                    
                    {/* Poster Image */}
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="w-full h-auto object-cover aspect-[2/3] group-hover:opacity-80 transition-opacity" />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500 p-4 text-center">No Image</div>
                    )}
                    
                    {/* Title & Type */}
                    <div className="p-4 flex flex-col flex-1 justify-between">
                      <h2 className="font-semibold text-lg truncate" title={item.title}>{item.title}</h2>
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{item.type}</p>
                        {item.releaseDate && (
                          <p className="text-gray-500 text-xs font-medium">{item.releaseDate.split('-')[0]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
