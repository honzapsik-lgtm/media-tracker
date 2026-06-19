import { getUnifiedPersonProfile } from "@/lib/person";
import { enqueueJob } from "@/lib/jobs";
import { notFound } from "next/navigation";
import Link from "next/link";
import ExpandableText from "@/components/ExpandableText";
import MediaCardVertical from "@/components/MediaCardVertical";
import { getMediaStatsMap, getListRankMap } from "@/lib/media-db";
import { UnifiedCredit } from "@/types/person";

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const personSlug = resolvedParams.id;
  
  const profile = await getUnifiedPersonProfile(personSlug);
  if (!profile) return notFound();

  // Non-blocking trigger of background sync
  if (profile.id) {
    enqueueJob({
      type: "syncPersonCrossPlatform",
      payload: { personId: profile.id },
      dedupeKey: `sync-person-${profile.id}`
    }).catch(e => console.error("Failed to enqueue syncPersonCrossPlatform", e));
  }

  // "Known For" horizontal carousel: top 6 performing items
  const allCredits = [...profile.credits.cast, ...profile.credits.crew];
  const uniqueCredits = Array.from(new Map(allCredits.map(c => [c.mediaId || c.title, c])).values());

  const mediaIds = uniqueCredits.map(c => c.mediaId).filter(Boolean) as string[];
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

  const creditsWithStats = uniqueCredits.map(credit => ({
    ...credit,
    communityScore: credit.mediaId ? statsMap[credit.mediaId] : null,
    listRank: credit.mediaId ? rankMap[credit.mediaId] : null,
  }));

  // Sort by communityScore, fallback to recent year
  creditsWithStats.sort((a, b) => {
    if (a.communityScore !== b.communityScore) return (b.communityScore || 0) - (a.communityScore || 0);
    return (b.releaseYear || 0) - (a.releaseYear || 0);
  });

  const topKnownFor = creditsWithStats.slice(0, 6);

  // Unified Credits Timeline grouped by decade/year
  const groupCredits = (credits: UnifiedCredit[]) => {
    const sorted = [...credits].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    const grouped = sorted.reduce((acc, c) => {
      const year = c.releaseYear || "Upcoming";
      if (!acc[year]) acc[year] = [];
      acc[year].push(c);
      return acc;
    }, {} as Record<string, UnifiedCredit[]>);
    return grouped;
  };

  const castGroups = groupCredits(profile.credits.cast);
  const crewGroups = groupCredits(profile.credits.crew);

  const calculateAge = (birth?: string | null, death?: string | null) => {
    if (!birth) return null;
    const b = new Date(birth);
    const end = death ? new Date(death) : new Date();
    let age = end.getFullYear() - b.getFullYear();
    const m = end.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < b.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(profile.birthDate, profile.deathDate);

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24 selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 pt-24 relative z-10 space-y-20">
        
        <Link href="/" className="text-gray-500 hover:text-white mb-8 inline-flex items-center gap-2 font-medium transition-colors">
          <span className="text-xl">←</span> Back to Search
        </Link>

        {/* Hero Section */}
        <section className="flex flex-col md:flex-row gap-12 lg:gap-16">
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt={profile.name} className="w-full rounded-3xl shadow-2xl shadow-black/50 border border-gray-800 object-cover aspect-[2/3]" />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 rounded-3xl border border-gray-800 flex items-center justify-center text-gray-500 text-lg font-medium shadow-inner">No Image Available</div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-8">
            <div>
              <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight leading-tight">
                {profile.name}
              </h1>
              {profile.nativeName && (
                <h2 className="text-2xl font-bold text-gray-500 mt-2 tracking-wide">{profile.nativeName}</h2>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm font-bold text-gray-400 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 inline-flex">
              {profile.knownForDepartment && (
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Department</span>
                  <span className="text-gray-200">{profile.knownForDepartment}</span>
                </div>
              )}
              {profile.birthDate && (
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Born</span>
                  <span className="text-gray-200">{profile.birthDate} {age && !profile.deathDate ? `(Age ${age})` : ''}</span>
                </div>
              )}
              {profile.deathDate && (
                <>
                  <div className="w-px h-10 bg-gray-800 hidden sm:block" />
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Died</span>
                    <span className="text-gray-200">{profile.deathDate} {age ? `(Age ${age})` : ''}</span>
                  </div>
                </>
              )}
            </div>

            {profile.bio && (
              <div className="max-w-3xl">
                <h3 className="text-lg font-bold mb-4 text-gray-300">Biography</h3>
                <div className="prose prose-invert prose-gray max-w-none text-gray-400 leading-relaxed">
                  <ExpandableText text={profile.bio} maxLength={500} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Known For Section */}
        {topKnownFor.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-black text-white">Known For</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
            </div>
            
            <div className="flex overflow-x-auto pb-8 -mx-6 px-6 sm:mx-0 sm:px-0 gap-6 snap-x hide-scrollbar">
              {topKnownFor.map((credit, idx) => (
                <div key={`${credit.mediaId}-${idx}`} className="w-40 sm:w-48 lg:w-56 shrink-0 snap-start">
                  <MediaCardVertical item={{
                    id: credit.mediaId || `temp-${idx}`,
                    title: credit.title,
                    type: credit.mediaType.toLowerCase() as any,
                    image: credit.poster,
                    releaseDate: credit.releaseYear?.toString() || 'N/A',
                    communityScore: credit.communityScore || null,
                    listRank: credit.listRank || null
                  }} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Unified Credits Timeline */}
        <section>
          <div className="flex items-center gap-4 mb-10">
            <h2 className="text-3xl font-black text-white">Filmography & Credits</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16">
            {/* CAST */}
            {profile.credits.cast.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                  <span className="bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-sm tracking-widest uppercase border border-blue-500/20">Cast</span>
                  <span className="text-gray-500 text-base">{profile.credits.cast.length} Roles</span>
                </h3>
                
                <div className="space-y-12 border-l-2 border-gray-900 ml-4 pl-8">
                  {Object.entries(castGroups).sort(([a], [b]) => (b === "Upcoming" ? -1 : a === "Upcoming" ? 1 : Number(b) - Number(a))).map(([year, credits]) => (
                    <div key={`cast-${year}`} className="relative">
                      <div className="absolute -left-[45px] top-1 bg-gray-950 text-gray-500 font-bold text-sm px-2 py-1">{year}</div>
                      <div className="space-y-6">
                        {credits.map((c, i) => (
                          <div key={i} className="group bg-gray-900/40 hover:bg-gray-800/60 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors flex items-center gap-5">
                            {c.isVoiceRole && c.characterImage ? (
                              <img src={c.characterImage} alt={c.role} className="w-14 h-14 rounded-full object-cover border-2 border-gray-700 shrink-0" />
                            ) : (
                              <div className="w-14 h-14 rounded-full bg-gray-800 border-2 border-gray-700 shrink-0 flex items-center justify-center text-gray-500 text-xs font-bold">
                                {c.mediaType.slice(0, 2)}
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-lg text-gray-200 truncate group-hover:text-white">{c.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                {c.isVoiceRole && <span className="text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">Voice</span>}
                                <span className="text-sm text-gray-400 truncate">{c.role}</span>
                              </div>
                            </div>
                            
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-gray-950 text-gray-500 border border-gray-800 shrink-0">
                              {c.mediaType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CREW */}
            {profile.credits.crew.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                  <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-sm tracking-widest uppercase border border-emerald-500/20">Crew</span>
                  <span className="text-gray-500 text-base">{profile.credits.crew.length} Credits</span>
                </h3>
                
                <div className="space-y-12 border-l-2 border-gray-900 ml-4 pl-8">
                  {Object.entries(crewGroups).sort(([a], [b]) => (b === "Upcoming" ? -1 : a === "Upcoming" ? 1 : Number(b) - Number(a))).map(([year, credits]) => (
                    <div key={`crew-${year}`} className="relative">
                      <div className="absolute -left-[45px] top-1 bg-gray-950 text-gray-500 font-bold text-sm px-2 py-1">{year}</div>
                      <div className="space-y-6">
                        {credits.map((c, i) => (
                          <div key={i} className="group bg-gray-900/40 hover:bg-gray-800/60 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors flex items-center gap-5">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-lg text-gray-200 truncate group-hover:text-white">{c.title}</h4>
                              <p className="text-sm text-gray-400 mt-1 truncate">{c.role}</p>
                            </div>
                            
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-gray-950 text-gray-500 border border-gray-800 shrink-0">
                              {c.mediaType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}
