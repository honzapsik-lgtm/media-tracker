"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

// Shared dictionary so the header knows the names/icons of the badges
export const BADGE_DICTIONARY = [
  { id: 'ratings_10', title: 'Initiate', desc: 'Rate 10 total pieces of media.', icon: '🥉' },
  { id: 'ratings_50', title: 'Critic', desc: 'Rate 50 total pieces of media.', icon: '🥈' },
  { id: 'ratings_100', title: 'The Completionist', desc: 'Rate 100 total pieces of media.', icon: '🥇' },
  { id: 'games_10', title: 'Controller Freak', desc: 'Rate 10 different games.', icon: '🎮' },
  { id: 'manga_10', title: 'Ink & Paper', desc: 'Rate 10 different manga volumes.', icon: '📖' },
  { id: 'void_stare', title: 'The Void Stare', desc: 'Give a score of 20% or lower. You survived the trash.', icon: '💀' },
  { id: 'masterpiece', title: 'True Kíno', desc: 'Award a flawless 100% Master Score.', icon: '✨' },
];

export default function ProfileHeader({ user, ratings, userBadges = [] }: { user: any; ratings: any[]; userBadges?: any[] }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [isEditing, setIsEditing] = useState(false);
  const [realName, setRealName] = useState(user.user_metadata?.real_name || "");
  const [stateRegion, setStateRegion] = useState(user.user_metadata?.state_region || "");
  const [country, setCountry] = useState(user.user_metadata?.country || "");
  const [showcase, setShowcase] = useState<string[]>(user.user_metadata?.showcase_badges || ["", "", ""]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { real_name: realName, state_region: stateRegion, country: country, showcase_badges: showcase }
    });
    setIsSaving(false);
    
    if (!error) {
      setIsEditing(false);
      router.refresh();
    } else {
      alert(`Update Error: ${error.message}`);
    }
  };

  const username = user.user_metadata?.custom_claims?.global_name || user.email?.split('@')[0];
  const displayLocation = [stateRegion, country].filter(Boolean).join(", ") || "Location not set";
  const joinDate = new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const totalRatings = ratings.length || 1;
  const typeCounts: Record<string, number> = { MOVIE: 0, SHOW: 0, GAME: 0, MANGA: 0 };
  
  ratings.forEach(r => {
    let t = r.type;
    if (t === 'SEASON' || t === 'EPISODE' || r.mediaId.includes('-s')) t = 'SHOW';
    if (typeCounts[t] !== undefined) typeCounts[t]++;
  });

  const dynamicStats = [
    { name: "Movies", count: typeCounts.MOVIE, percentage: Math.round((typeCounts.MOVIE / totalRatings) * 100) },
    { name: "TV Shows", count: typeCounts.SHOW, percentage: Math.round((typeCounts.SHOW / totalRatings) * 100) },
    { name: "Games", count: typeCounts.GAME, percentage: Math.round((typeCounts.GAME / totalRatings) * 100) },
    { name: "Manga", count: typeCounts.MANGA, percentage: Math.round((typeCounts.MANGA / totalRatings) * 100) },
  ].filter(s => s.count > 0).sort((a, b) => b.percentage - a.percentage);

  const updateShowcase = (index: number, val: string) => {
    const newArr = [...showcase];
    newArr[index] = val;
    setShowcase(newArr);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 mb-12 border-b border-gray-800 pb-10">
      <div className="flex-1 flex items-start gap-8 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 relative group">
        
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
          >
            Edit Profile
          </button>
        )}

        {/* Left Sub-Column: Avatar & Date */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="relative">
            {user.user_metadata?.avatar_url ? (
               <img src={user.user_metadata.avatar_url} alt="Profile" className="w-32 h-32 rounded-full border-4 border-gray-800 shadow-xl object-cover" />
            ) : (
               <div className="w-32 h-32 rounded-full bg-blue-900 border-4 border-blue-800 flex items-center justify-center text-4xl font-black shadow-xl">
                 {username?.charAt(0).toUpperCase() || '?'}
               </div>
            )}
            <div className="absolute -bottom-2 -right-2 bg-emerald-400 text-gray-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-4 border-gray-900 shadow-md">
              Online
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center max-w-[120px]">
            Joined<br/>{joinDate}
          </p>
        </div>
        
        {/* Right Sub-Column: Info & Showcase */}
        <div className="flex flex-col justify-center py-2 flex-1 pr-16 min-h-[128px]">
          {isEditing ? (
            <div className="space-y-3 w-full max-w-md">
              <div className="flex gap-2">
                <input type="text" placeholder="Real Name (Optional)" value={realName} onChange={(e) => setRealName(e.target.value)} className="w-1/2 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white" />
                <input type="text" placeholder="State / Region" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} className="w-1/4 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white" />
                <input type="text" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="w-1/4 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white" />
              </div>
              
              <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
                <p className="text-xs text-gray-400 font-bold mb-2">Showcase Badges</p>
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <select key={i} value={showcase[i]} onChange={e => updateShowcase(i, e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-white outline-none">
                      <option value="">None</option>
                      {userBadges.map(b => {
                        const dict = BADGE_DICTIONARY.find(d => d.id === b.badge_id);
                        return dict ? <option key={b.badge_id} value={b.badge_id}>{dict.icon} {dict.title}</option> : null;
                      })}
                    </select>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-4 rounded text-xs transition-colors">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setIsEditing(false)} className="bg-transparent border border-gray-700 text-gray-400 hover:text-white font-bold py-1.5 px-4 rounded text-xs transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-black mb-1">{username}</h1>
              {user.user_metadata?.real_name && <h2 className="text-lg text-gray-300 font-semibold">{user.user_metadata.real_name}</h2>}
              <p className="text-sm text-gray-500 mt-1 mb-auto">{displayLocation}</p>
              
              {/* Badge Showcase */}
              <div className="flex gap-3 mt-4">
                {[0, 1, 2].map(i => {
                  const badgeId = showcase[i];
                  const badge = BADGE_DICTIONARY.find(b => b.id === badgeId);
                  
                  if (badge) {
                    return (
                      <div key={i} className="w-10 h-10 bg-blue-900/30 border border-blue-500 rounded-lg flex items-center justify-center text-xl shadow-[0_0_10px_rgba(59,130,246,0.2)] cursor-help" title={badge.title}>
                        {badge.icon}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="w-10 h-10 bg-gray-900/50 border border-gray-800 border-dashed rounded-lg flex items-center justify-center text-gray-700 text-xs font-black">
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="lg:w-[450px] shrink-0 bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="font-bold text-sm text-gray-200">Most Rated <span className="text-blue-400">Categories</span></h3>
          <div className="w-4 h-4 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-[10px] font-bold cursor-help" title="Calculated live from your ratings database">?</div>
        </div>

        <div className="space-y-4">
          {dynamicStats.length === 0 ? (
             <p className="text-xs text-gray-500 italic">No ratings yet. Start reviewing to see your stats!</p>
          ) : (
            dynamicStats.map((stat) => (
              <div key={stat.name} className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-400 font-medium">{stat.name}</div>
                <div className="flex-1 h-3.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800/50">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${stat.percentage}%` }} />
                </div>
                <div className="w-8 text-right text-xs font-bold text-gray-500">{stat.percentage}%</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}