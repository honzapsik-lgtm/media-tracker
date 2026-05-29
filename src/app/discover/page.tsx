import { discoverMedia } from "@/app/actions";
import DiscoverFilters from "@/components/DiscoverFilters";
import Link from "next/link";

export default async function DiscoverPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  // 1. Await the Next.js 15 searchParams
  const params = await searchParams;
  
  // 2. Extract values with defaults
  const type = params.type || "movie";
  const genre = params.genre || "";
  const year = params.year || "";
  const sort = params.sort || "popular";

  // 3. Fetch the normalized data from your server action
  const results = await discoverMedia(type, genre, year, sort);

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-24 pt-12">
      <div className="max-w-7xl mx-auto px-8">
        <h1 className="text-4xl font-black mb-8">Discover</h1>
        
        {/* The Client Component Filters */}
        <DiscoverFilters />

        {/* The Results Grid */}
        {!results || results.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
            <p className="text-gray-400 text-lg">No results found for these filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {results.map((item: any) => (
              <Link 
                href={`/media/${item.id}`} 
                key={item.id} 
                className="block hover:scale-105 transition-transform duration-300 relative group"
              >
                <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg h-full border border-gray-800">
                  {/* Global Score Badge */}
                  {item.globalScore > 0 && (
                    <div className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border bg-blue-900 border-blue-500 text-white">
                      {item.globalScore}%
                    </div>
                  )}
                  
                  {/* Poster Image */}
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-full h-auto object-cover aspect-[2/3] group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500 p-4 text-center">No Image</div>
                  )}
                  
                  {/* Title & Type */}
                  <div className="p-4">
                    <h2 className="font-semibold text-lg truncate" title={item.title}>{item.title}</h2>
                    <p className="text-gray-400 text-xs uppercase tracking-wider mt-1">{item.type}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}