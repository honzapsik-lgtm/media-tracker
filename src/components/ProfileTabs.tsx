"use client";

import { useState } from "react";
import Link from "next/link";
import Top100Ranker from "@/components/Top100Ranker";
import { BADGE_DICTIONARY } from "@/components/ProfileHeader";

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "bg-gray-900/80 text-gray-500 border-gray-700";
  if (score >= 95) return "bg-yellow-900/80 text-yellow-400 border-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.4)]"; 
  if (score >= 75) return "bg-green-900/80 text-green-400 border-green-500";
  if (score >= 50) return "bg-blue-900/80 text-blue-400 border-blue-500";
  if (score >= 25) return "bg-gray-800 text-gray-400 border-gray-600";
  return "bg-gray-900/80 text-gray-500 border-gray-700"; 
};

interface ProfileItem {
  mediaId: string;
  score: number;
  reviewText: string | null;
  title: string;
  image: string | null;
  type: string;
  rankPosition: number | null;
}

interface UserBadge {
  badge_id: string;
  unlocked_at: Date | null;
}

export default function ProfileTabs({ initialData, userBadges = [] }: { initialData: ProfileItem[], userBadges?: UserBadge[] }) {
  const [activeTab, setActiveTab] = useState<'ratings' | 'reviews' | 'top100' | 'stats' | 'achievements'>('ratings');
  const [processedData] = useState(initialData || []);

  const getMediaUrl = (mediaId: string) => {
    if (!mediaId) return "#";
    const parts = mediaId.split('-');
    if (parts[0] === 'tmdb' && parts[1] === 'tv' && parts.length === 4) {
      const seasonNum = parts[3].replace('s', ''); 
      return `/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${seasonNum}`;
    }
    return `/media/${mediaId}`;
  };

  const getDisplayType = (type: string, mediaId: string) => {
    if (type === 'SHOW' && mediaId.includes('-s')) return 'SEASON';
    return type;
  };

  // ---- STATISTICS LOGIC ----
  const totalScores = processedData.map(d => d.score);
  const avgScore = totalScores.length > 0 ? Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length) : 0;
  
  const distribution = [0, 0, 0, 0, 0]; 
  totalScores.forEach(score => {
    if (score <= 20) distribution[0]++;
    else if (score <= 40) distribution[1]++;
    else if (score <= 60) distribution[2]++;
    else if (score <= 80) distribution[3]++;
    else distribution[4]++;
  });
  const maxBucket = Math.max(...distribution, 1);

  // ---- DYNAMIC BADGE PROGRESS LOGIC ----
  const gameCount = processedData.filter(d => d.type === 'GAME').length;
  const mangaCount = processedData.filter(d => d.type === 'MANGA').length;
  const hasVoidStare = processedData.some(d => d.score <= 20);
  const hasMasterpiece = processedData.some(d => d.score === 100);

  const getBadgeProgress = (badgeId: string) => {
    let current = 0;
    let target = 1;
    
    switch (badgeId) {
      case 'ratings_10': target = 10; current = processedData.length; break;
      case 'ratings_50': target = 50; current = processedData.length; break;
      case 'ratings_100': target = 100; current = processedData.length; break;
      case 'games_10': target = 10; current = gameCount; break;
      case 'manga_10': target = 10; current = mangaCount; break;
      case 'void_stare': target = 1; current = hasVoidStare ? 1 : 0; break;
      case 'masterpiece': target = 1; current = hasMasterpiece ? 1 : 0; break;
    }
    
    return {
      current: Math.min(current, target),
      target,
      percentage: Math.min((current / target) * 100, 100)
    };
  };

  const renderTabNavigation = () => (
    <div className="flex flex-wrap gap-2 mb-8 bg-gray-900 p-2 rounded-xl border border-gray-800 w-fit">
      <button onClick={() => setActiveTab('ratings')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'ratings' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>All Ratings</button>
      <button onClick={() => setActiveTab('reviews')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'reviews' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Written Reviews</button>
      <button onClick={() => setActiveTab('top100')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'top100' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>List Rank</button>
      <div className="w-px h-6 bg-gray-700 self-center mx-1 hidden sm:block"></div>
      <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Statistics</button>
      <button onClick={() => setActiveTab('achievements')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'achievements' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Achievements</button>
    </div>
  );

  return (
    <div>
      {renderTabNavigation()}

      {activeTab === 'ratings' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {processedData.map((item) => (
            <div key={item.mediaId} className="relative group bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-800 flex flex-col h-full">
              <div className={`absolute top-2 right-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border backdrop-blur-md ${getScoreColor(item.score)}`}>
                {item.score}%
              </div>
              <Link href={getMediaUrl(item.mediaId)} className="block relative aspect-[2/3] overflow-hidden">
                {item.image ? <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" /> : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 p-4 text-center">No Image</div>}
              </Link>
              <div className="p-4 flex flex-col flex-1">
                <h2 className="font-semibold text-lg truncate mb-1" title={item.title}>{item.title}</h2>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">{getDisplayType(item.type, item.mediaId)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'top100' && <Top100Ranker rawData={processedData} />}

      {activeTab === 'stats' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
            <h3 className="text-2xl font-black mb-2">The Critic&apos;s Offset</h3>
            <p className="text-gray-400 text-sm mb-8">How harsh or generous are your ratings?</p>
            <div className="flex items-end gap-6 mb-6">
              <div className="text-6xl font-black text-blue-500">{avgScore}%</div>
              <div className="pb-2 text-gray-400 font-bold uppercase tracking-widest text-sm">Average Score</div>
            </div>
            {avgScore > 80 ? <p className="text-green-400 text-sm font-bold border-l-4 border-green-500 pl-3">You are a highly generous critic. You focus on the best parts of media.</p> : 
             avgScore < 50 ? <p className="text-red-400 text-sm font-bold border-l-4 border-red-500 pl-3">You are a notoriously harsh critic. Perfection is rarely achieved.</p> :
             <p className="text-yellow-400 text-sm font-bold border-l-4 border-yellow-500 pl-3">You have a balanced, critical eye. A true bell-curve evaluator.</p>}
          </div>

          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
            <h3 className="text-2xl font-black mb-8">Score Distribution</h3>
            <div className="flex items-end justify-between h-48 gap-2">
              {['0-20', '21-40', '41-60', '61-80', '81-100'].map((label, index) => (
                <div key={label} className="flex flex-col items-center flex-1 gap-2 group">
                  <div className="text-xs font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{distribution[index]}</div>
                  <div className="w-full bg-blue-600 rounded-t-md transition-all duration-500 hover:bg-blue-400" style={{ height: `${Math.max((distribution[index] / maxBucket) * 100, 5)}%` }}></div>
                  <div className="text-[10px] text-gray-500 font-bold whitespace-nowrap">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* THE NEW ACHIEVEMENTS LIST LAYOUT */}
      {activeTab === 'achievements' && (
        <div className="flex flex-col gap-3 max-w-4xl">
          {BADGE_DICTIONARY.map((badge) => {
            const unlockedData = userBadges.find(b => b.badge_id === badge.id);
            const isUnlocked = !!unlockedData;
            const progress = getBadgeProgress(badge.id);

            return (
              <div key={badge.id} className={`p-4 rounded-xl border flex items-center gap-5 transition-all duration-300 ${isUnlocked ? 'bg-gray-900 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.05)]' : 'bg-gray-950/50 border-gray-800/80 grayscale'}`}>
                
                {/* Icon Block */}
                <div className={`w-14 h-14 shrink-0 flex items-center justify-center text-2xl rounded-lg border-2 ${isUnlocked ? 'bg-blue-900/30 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-600'}`}>
                  {badge.icon}
                </div>
                
                {/* Text Block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className={`font-black text-lg tracking-tight truncate ${isUnlocked ? 'text-gray-100' : 'text-gray-500'}`}>{badge.title}</h3>
                    {isUnlocked ? (
                      <span className="text-[10px] shrink-0 font-black uppercase tracking-widest text-blue-400">
                        Unlocked {unlockedData.unlocked_at ? new Date(unlockedData.unlocked_at).toLocaleDateString() : "recently"}
                      </span>
                    ) : (
                      <span className="text-[10px] shrink-0 font-bold text-gray-500">
                        {progress.current} / {progress.target}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">{badge.desc}</p>
                </div>

                {/* Progress Bar (Only visible if locked) */}
                {!isUnlocked && (
                  <div className="w-32 shrink-0 hidden sm:block">
                    <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                      <div 
                        className="h-full bg-gray-600 rounded-full transition-all duration-500" 
                        style={{ width: `${progress.percentage}%` }} 
                      />
                    </div>
                  </div>
                )}
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
