import { getUnifiedPersonProfile } from "@/lib/person";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ExpandableText from "@/components/ExpandableText";
import MediaCardVertical from "@/components/MediaCardVertical";
import Carousel from "@/components/Carousel";
import { getMediaStatsMap, getListRankMap } from "@/lib/media-db";
import { UnifiedCredit } from "@/types/person";
import PersonCredits from "@/components/PersonCredits";
import BackToSearchButton from "@/components/BackToSearchButton";

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const personSlug = resolvedParams.id;
  
  const profile = await getUnifiedPersonProfile(personSlug);
  if (!profile) return notFound();

  // Redirect to canonical slug if it differs
  let canonicalSlug = personSlug;
  if (profile.tmdbId) {
    canonicalSlug = `tmdb-${profile.tmdbId}`;
  } else if (profile.mangadexId) {
    canonicalSlug = `mangadex-${profile.mangadexId}`;
  } else if (profile.anilistId) {
    canonicalSlug = `anilist-${profile.anilistId}`;
  } else if (profile.igdbId) {
    canonicalSlug = `igdb-${profile.igdbId}`;
  } else if (profile.rawgId) {
    canonicalSlug = `rawg-${profile.rawgId}`;
  }

  if (personSlug !== canonicalSlug) {
    redirect(`/person/${canonicalSlug}`);
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

  // Credits are grouped and sorted in the client component

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
        
        <BackToSearchButton />

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
            
            <Carousel>
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
            </Carousel>
          </section>
        )}

        {/* Unified Credits Timeline */}
        <PersonCredits initialCredits={profile.credits} personSlug={canonicalSlug} />

      </div>
    </main>
  );
}
