import { getUnifiedCompanyProfile } from "@/lib/company";
import { notFound } from "next/navigation";
import Link from "next/link";
import ExpandableText from "@/components/ExpandableText";
import MediaCardVertical from "@/components/MediaCardVertical";
import { UnifiedCompanyMedia } from "@/types/company";

function PortfolioGrid({ title, items }: { title: string, items: UnifiedCompanyMedia[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-3xl font-black text-white">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {items.map((item, idx) => (
          <MediaCardVertical key={`${item.mediaId}-${idx}`} item={{
            id: item.mediaId,
            title: item.title,
            type: item.mediaType.toLowerCase() as any,
            image: item.poster,
            releaseDate: item.releaseYear?.toString() || 'N/A',
          }} />
        ))}
      </div>
    </section>
  );
}

export default async function CompanyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const companySlug = resolvedParams.id;
  
  const profile = await getUnifiedCompanyProfile(companySlug);
  if (!profile) return notFound();

  return (
    <main className="min-h-screen bg-gray-950 text-white relative pb-24 selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 pt-24 relative z-10 space-y-20">
        
        <Link href="/" className="text-gray-500 hover:text-white mb-8 inline-flex items-center gap-2 font-medium transition-colors">
          <span className="text-xl">←</span> Back to Search
        </Link>

        {/* Hero Section */}
        <section className="flex flex-col md:flex-row gap-12 lg:gap-16 items-center md:items-start">
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 flex justify-center bg-gray-900 rounded-3xl p-8 border border-gray-800">
            {profile.logo ? (
              <img src={profile.logo} alt={profile.name} className="w-full object-contain max-h-64 drop-shadow-2xl" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-gray-500 text-lg font-medium">No Logo Available</div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-8 w-full">
            <div>
              <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight leading-tight">
                {profile.name}
              </h1>
            </div>

            {profile.country && (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm font-bold text-gray-400 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 inline-flex">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Headquarters</span>
                  <span className="text-gray-200">{profile.country}</span>
                </div>
              </div>
            )}

            {profile.description && (
              <div className="max-w-3xl">
                <h3 className="text-lg font-bold mb-4 text-gray-300">About</h3>
                <div className="prose prose-invert prose-gray max-w-none text-gray-400 leading-relaxed">
                  <ExpandableText text={profile.description} maxLength={500} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Portfolio Grids */}
        <div className="space-y-16">
          <PortfolioGrid title="Developed Games" items={profile.portfolio.developedGames} />
          <PortfolioGrid title="Published Games" items={profile.portfolio.publishedGames} />
          <PortfolioGrid title="Animation Studio" items={profile.portfolio.animationStudioFor} />
          <PortfolioGrid title="Produced Anime" items={profile.portfolio.producedAnime} />
          <PortfolioGrid title="Published Manga" items={profile.portfolio.publishedManga} />
          <PortfolioGrid title="Produced Film & TV" items={profile.portfolio.producedFilmTv} />
          <PortfolioGrid title="Broadcasted On" items={profile.portfolio.broadcastedOn} />
        </div>

      </div>
    </main>
  );
}
