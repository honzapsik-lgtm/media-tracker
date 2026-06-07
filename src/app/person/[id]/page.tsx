import { getPersonDetails } from "@/lib/person";
import { notFound } from "next/navigation";
import Link from "next/link";
import ExpandableText from "@/components/ExpandableText";
import MediaCardVertical from "@/components/MediaCardVertical";
import { getMediaStatsMap, getListRankMap } from "@/lib/media-db";

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const personId = resolvedParams.id;
  
  const person = await getPersonDetails(personId);
  if (!person) return notFound();

  // Optionally fetch community scores and ranks for the person's credits
  const mediaIds = person.credits.map(c => c.id);
  let statsMap: Record<string, number> = {};
  let rankMap: Record<string, number> = {};
  
  if (mediaIds.length > 0) {
    const [sMap, rMap] = await Promise.all([
      getMediaStatsMap(mediaIds),
      getListRankMap(mediaIds)
    ]);
    statsMap = sMap;
    rankMap = rMap;
  }

  // Merge the stats into the credits array so MediaCardVertical can display them
  const creditsWithStats = person.credits.map(credit => ({
    ...credit,
    communityScore: statsMap[credit.id] || null,
    listRank: rankMap[credit.id] || null,
  }));

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24">
      <div className="max-w-7xl mx-auto px-8 pt-24 relative z-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-8 inline-block font-semibold">← Back to Search</Link>

        <div className="flex flex-col md:flex-row gap-10 mb-16 border-b border-gray-800 pb-16">
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
            {person.image ? (
              <img src={person.image} alt={person.name} className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-gray-800 object-cover" />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center text-gray-500">No Image</div>
            )}
          </div>

          <div className="flex-1 space-y-6">
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight">
              {person.name}
            </h1>

            <div className="flex items-center gap-4 text-sm font-bold text-gray-400">
              {person.birthDate && (
                <div>
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest block mb-0.5">Born</span>
                  {person.birthDate}
                </div>
              )}
              {person.deathDate && (
                <>
                  <div className="w-px h-8 bg-gray-800" />
                  <div>
                    <span className="text-[10px] text-gray-600 uppercase tracking-widest block mb-0.5">Died</span>
                    {person.deathDate}
                  </div>
                </>
              )}
            </div>

            {person.bio && (
              <div className="pt-4">
                <h3 className="text-xl font-bold mb-3">Biography</h3>
                <ExpandableText text={person.bio} maxLength={400} />
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-black mb-8 flex items-center gap-4">
            Known For
            <span className="text-sm font-bold bg-gray-900 text-gray-400 px-3 py-1 rounded-full border border-gray-800">
              {creditsWithStats.length} titles
            </span>
          </h2>

          {creditsWithStats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {creditsWithStats.map((credit) => (
                <div key={credit.id}>
                  <MediaCardVertical item={credit} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900/50 border border-gray-800 border-dashed rounded-2xl p-12 text-center">
              <p className="text-gray-400 text-lg">No credited works found.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
