import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; 
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; 
};

export default async function RankingsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  const params = await searchParams;
  const type = params.type || "show";
  const sort = params.sort || "list_rank"; 
  const genre = params.genre || "";
  const year = params.year || "";
  const page = parseInt(params.page || "1", 10);
  
  const limit = 100;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  let query = supabase.from('global_leaderboard').select('*', { count: 'exact' }).eq('media_type', type);

  if (sort === 'list_rank') {
    query = query.not('list_rank', 'is', null).order('list_rank', { ascending: true });
  } else if (sort === 'community') {
    query = query.not('community_average', 'is', null).order('community_average', { ascending: false }).order('total_ratings', { ascending: false });
  } else if (sort === 'popular') {
    query = query.not('total_ratings', 'is', null).order('total_ratings', { ascending: false });
  }

  // NOTE: genre and year filters would be applied to the query here once the DB supports it
  
  const { data: results, count } = await query.range(from, to);
  const hasNext = count ? page * limit < count : false;
  const hasPrev = page > 1;

  const categories = [
    { id: "movie", label: "Movies" }, { id: "show", label: "TV Shows" },
    { id: "season", label: "Seasons" }, { id: "episode", label: "Episodes" },
    { id: "game", label: "Games" }, { id: "manga", label: "Manga" }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1890 + 1 }, (_, i) => currentYear - i);

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-24 pt-12">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-4xl font-black mb-8 tracking-tight">Global Rankings</h1>
        
        {/* Navigation & Filters Block */}
        <div className="flex flex-col gap-4 mb-8 bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
          
          {/* Row 1: Categories */}
          <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
            {categories.map((cat) => (
              <Link 
                key={cat.id} href={`?type=${cat.id}&sort=${sort}&page=1`}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${type === cat.id ? "bg-blue-600 text-white shadow-lg" : "bg-gray-950 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"}`}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          {/* Row 2: Sorting */}
          <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
            <Link href={`?type=${type}&sort=community&page=1`} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${sort === 'community' ? "bg-blue-900/50 text-blue-400 border border-blue-500/50" : "bg-gray-950 text-gray-500 hover:text-gray-300 border border-gray-800"}`}>
              Community Score
            </Link>
            <Link href={`?type=${type}&sort=list_rank&page=1`} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${sort === 'list_rank' ? "bg-blue-900/50 text-blue-400 border border-blue-500/50" : "bg-gray-950 text-gray-500 hover:text-gray-300 border border-gray-800"}`}>
              List Rank
            </Link>
            <Link href={`?type=${type}&sort=popular&page=1`} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${sort === 'popular' ? "bg-blue-900/50 text-blue-400 border border-blue-500/50" : "bg-gray-950 text-gray-500 hover:text-gray-300 border border-gray-800"}`}>
              Popularity
            </Link>
          </div>

          {/* Row 3: Filters (UI Only for now) */}
          <div className="flex flex-wrap gap-3 pt-2">
            <select className="bg-gray-950 border border-gray-700 text-gray-300 text-sm font-semibold rounded-lg block p-2 outline-none cursor-pointer">
              <option value="">All Genres</option>
              <option value="action">Action</option>
              <option value="rpg">RPG</option>
              <option value="scifi">Sci-Fi</option>
              <option value="comedy">Comedy</option>
            </select>
            
            <select className="bg-gray-950 border border-gray-700 text-gray-300 text-sm font-semibold rounded-lg block p-2 outline-none cursor-pointer max-h-60">
              <option value="">Any Year</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* The List Layout */}
        <div className="space-y-2">
          {!results || results.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
              <p className="text-gray-400 text-lg">No rankings exist in this category yet.</p>
            </div>
          ) : (
            results.map((item: any, index: number) => {
              const displayRank = sort === 'list_rank' ? item.list_rank : from + index + 1;

              return (
                <Link href={`/media/${item.media_id}`} key={item.media_id} className="flex items-center gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group">
                  <div className="w-12 shrink-0 text-center font-black text-2xl text-gray-600 group-hover:text-blue-500 transition-colors">
                    #{displayRank}
                  </div>
                  <div className="shrink-0">
                    {item.image ? (
                      <img src={item.image} className="w-12 h-16 object-cover rounded-md shadow-md" alt={item.title || "Cover"} />
                    ) : (
                      <div className="w-12 h-16 bg-gray-950 border border-gray-800 rounded-md flex items-center justify-center text-[9px] font-bold text-gray-600">NO IMG</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-200 truncate group-hover:text-white">{item.title || "Unknown Title"}</p>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-950 text-gray-500 border border-gray-800/60 inline-block mt-1">
                      {item.media_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 pr-4 shrink-0">
                    {sort === 'popular' && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Ratings</p>
                        <p className="font-black text-base text-blue-400">{item.total_ratings}</p>
                      </div>
                    )}
                    {sort !== 'popular' && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">List Rank</p>
                        <p className={`font-black text-base ${item.list_rank ? 'text-white' : 'text-gray-600'}`}>{item.list_rank ? `#${item.list_rank}` : '-'}</p>
                      </div>
                    )}
                    <div className="w-px h-8 bg-gray-800 hidden sm:block"></div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Score</p>
                      <p className={`font-black text-base ${getScoreColor(item.community_average)}`}>{item.community_average ? `${item.community_average}%` : 'N/A'}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Pagination Buttons */}
        {(hasPrev || hasNext) && (
          <div className="flex justify-center items-center gap-4 mt-12 border-t border-gray-800 pt-8">
            {hasPrev ? <Link href={`?type=${type}&sort=${sort}&page=${page - 1}`} className="bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-400 font-bold py-2 px-6 rounded-lg transition-colors text-sm">← Prev 100</Link> : <div className="w-28"></div>}
            <span className="text-gray-500 font-bold text-sm">Page {page}</span>
            {hasNext ? <Link href={`?type=${type}&sort=${sort}&page=${page + 1}`} className="bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-400 font-bold py-2 px-6 rounded-lg transition-colors text-sm">Next 100 →</Link> : <div className="w-28"></div>}
          </div>
        )}
      </div>
    </main>
  );
}