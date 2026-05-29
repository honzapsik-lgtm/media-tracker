import SearchBar from "@/components/SearchBar";

export default function SearchLoading() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-blue-400 font-semibold">← Back Home</div>
        <SearchBar />
        
        {/* Cool pulsing skeleton grid */}
        <div className="mt-12">
          <div className="flex gap-2 mb-8 border-b border-gray-800 pb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 w-24 bg-gray-900 animate-pulse rounded-full border border-gray-800"></div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div key={i} className="w-full aspect-[2/3] bg-gray-900 animate-pulse rounded-xl border border-gray-800"></div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}