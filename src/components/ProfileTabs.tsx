"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Top100Ranker from "@/components/Top100Ranker";
import MediaCardProfileHorizontal from "@/components/MediaCardProfileHorizontal";
import { BADGE_DICTIONARY } from "@/components/ProfileHeader";

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "bg-gray-900/80 text-gray-500 border-gray-700";
  if (score >= 95) return "bg-yellow-900/80 text-yellow-400 border-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.4)]"; 
  if (score >= 75) return "bg-green-900/80 text-green-400 border-green-500";
  if (score >= 50) return "bg-blue-900/80 text-blue-400 border-blue-500";
  if (score >= 25) return "bg-gray-800 text-gray-400 border-gray-600";
  return "bg-gray-900/80 text-gray-500 border-gray-700"; 
};

export interface ProfileItem {
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

export default function ProfileTabs({ 
  initialData, 
  initialCount,
  userBadges = [],
  statsCache = []
}: { 
  initialData: ProfileItem[], 
  initialCount: number,
  userBadges?: UserBadge[],
  statsCache?: any[]
}) {
  const [activeTab, setActiveTab] = useState<'ratings' | 'reviews' | 'top100' | 'stats' | 'achievements'>('ratings');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProfileItem[]>(initialData);
  const [count, setCount] = useState<number>(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const limit = 50;

  useEffect(() => {
    if (activeTab === 'stats' || activeTab === 'achievements' || activeTab === 'top100') return;
    if (activeTab === 'ratings' && page === 1 && data === initialData) return; 

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const endpoint = activeTab === 'ratings' ? '/api/profile/ratings' : '/api/profile/reviews';
        const res = await fetch(`${endpoint}?page=${page}&limit=${limit}`);
        if (res.ok) {
          const result = await res.json();
          setData(result.results || []);
          setCount(result.count || 0);
        }
      } catch (err) {
        console.error("Failed to fetch paginated data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTab, page]);

  const handleTabSwitch = (tab: any) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setPage(1);
      if (tab === 'ratings') {
        setData(initialData);
        setCount(initialCount);
      } else if (tab === 'reviews') {
        setData([]);
        setCount(0);
      }
    }
  };

  const getMediaUrl = (mediaId: string) => {
    if (!mediaId) return "#";
    const parts = mediaId.split('-');
    if (parts[0] === 'tmdb' && parts[1] === 'tv') {
      if (parts.length === 4) {
        const seasonNum = parts[3].replace('s', ''); 
        return `/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${seasonNum}`;
      } else if (parts.length === 5) {
        const seasonNum = parts[3].replace('s', ''); 
        const epNum = parts[4].replace('e', ''); 
        return `/media/${parts[0]}-${parts[1]}-${parts[2]}/season/${seasonNum}/episode/${epNum}`;
      }
    }
    return `/media/${mediaId}`;
  };

  const getDisplayType = (type: string, mediaId: string) => {
    if (type === 'SHOW' || type === 'show') {
      if (mediaId.includes('-e')) return 'EPISODE';
      if (mediaId.includes('-s')) return 'SEASON';
    }
    return type;
  };

  // ---- STATISTICS LOGIC FROM BACKGROUND CACHE ----
  let totalRatingCount = 0;
  let sumAvg = 0;
  let gameCount = 0;
  let mangaCount = 0;
  let maxScore = 0;
  let minScore = 100;
  const distribution = [0,0,0,0,0];

  statsCache.forEach(cache => {
    const json = cache.stats_json || {};
    totalRatingCount += (json.total_count || 0);
    sumAvg += (json.average_score || 0) * (json.total_count || 0);
    
    if (cache.media_type === "game") gameCount += (json.total_count || 0);
    if (cache.media_type === "manga") mangaCount += (json.total_count || 0);
    
    if (json.highest_score > maxScore) maxScore = json.highest_score;
    if (json.lowest_score < minScore && json.lowest_score > 0) minScore = json.lowest_score;
    
    const dist = json.score_distribution || {};
    distribution[0] += (dist["1"]||0) + (dist["2"]||0);
    distribution[1] += (dist["3"]||0) + (dist["4"]||0);
    distribution[2] += (dist["5"]||0) + (dist["6"]||0);
    distribution[3] += (dist["7"]||0) + (dist["8"]||0);
    distribution[4] += (dist["9"]||0) + (dist["10"]||0);
  });

  const avgScore = totalRatingCount > 0 ? Math.round(sumAvg / totalRatingCount) : 0;
  const maxBucket = Math.max(...distribution, 1);
  const hasVoidStare = minScore <= 20 && totalRatingCount > 0;
  const hasMasterpiece = maxScore === 100;

  // ---- DYNAMIC BADGE PROGRESS LOGIC ----
  const getBadgeProgress = (badgeId: string) => {
    let current = 0;
    let target = 1;
    
    switch (badgeId) {
      case 'ratings_10': target = 10; current = totalRatingCount; break;
      case 'ratings_50': target = 50; current = totalRatingCount; break;
      case 'ratings_100': target = 100; current = totalRatingCount; break;
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
      <button onClick={() => handleTabSwitch('ratings')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'ratings' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>All Ratings</button>
      <button onClick={() => handleTabSwitch('reviews')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'reviews' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Written Reviews</button>
      <button onClick={() => handleTabSwitch('top100')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'top100' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Ranking Lists</button>
      <div className="w-px h-6 bg-gray-700 self-center mx-1 hidden sm:block"></div>
      <button onClick={() => handleTabSwitch('stats')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Statistics</button>
      <button onClick={() => handleTabSwitch('achievements')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'achievements' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Achievements</button>
    </div>
  );

  const renderPagination = () => {
    const hasNext = page * limit < count;
    const hasPrev = page > 1;

    if (!hasNext && !hasPrev) return null;

    return (
      <div className="flex justify-center items-center gap-4 mt-12 border-t border-gray-800 pt-8">
        {hasPrev ? <button onClick={() => setPage(p => p - 1)} className="bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-400 font-bold py-2 px-6 rounded-lg transition-colors text-sm">← Prev</button> : <div className="w-24"></div>}
        <span className="text-gray-500 font-bold text-sm">Page {page} of {Math.ceil(count / limit)}</span>
        {hasNext ? <button onClick={() => setPage(p => p + 1)} className="bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-400 font-bold py-2 px-6 rounded-lg transition-colors text-sm">Next →</button> : <div className="w-24"></div>}
      </div>
    );
  };

  return (
    <div>
      {renderTabNavigation()}

      {activeTab === 'ratings' && (
        <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          <div className="space-y-2">
            {data.map((item) => (
              <MediaCardProfileHorizontal key={item.mediaId} item={item} />
            ))}
          </div>
          {renderPagination()}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className={`space-y-6 max-w-4xl transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          {data.length === 0 && !isLoading && (
             <div className="text-gray-500 italic p-6 border border-dashed border-gray-800 rounded-2xl">You haven't written any reviews yet.</div>
          )}
          {data.map((item) => (
            <div key={item.mediaId} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex gap-6">
              {item.image && (
                <Link href={getMediaUrl(item.mediaId)} className="w-24 shrink-0 block">
                  <img src={item.image} alt={item.title} className="w-full rounded shadow-lg" />
                </Link>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <Link href={getMediaUrl(item.mediaId)} className="font-bold text-xl hover:text-blue-400">{item.title}</Link>
                  <span className={`px-2 py-1 text-xs font-black rounded shadow-lg border backdrop-blur-md ${getScoreColor(item.score)}`}>
                    {item.score}%
                  </span>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">{item.reviewText}</p>
              </div>
            </div>
          ))}
          {renderPagination()}
        </div>
      )}

      {activeTab === 'top100' && <Top100Ranker />}

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

      {activeTab === 'achievements' && (
        <div className="flex flex-col gap-3 max-w-4xl">
          {BADGE_DICTIONARY.map((badge) => {
            const unlockedData = userBadges.find(b => b.badge_id === badge.id);
            const isUnlocked = !!unlockedData;
            const progress = getBadgeProgress(badge.id);

            return (
              <div key={badge.id} className={`p-4 rounded-xl border flex items-center gap-5 transition-all duration-300 ${isUnlocked ? 'bg-gray-900 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.05)]' : 'bg-gray-950/50 border-gray-800/80 grayscale'}`}>
                
                <div className={`w-14 h-14 shrink-0 flex items-center justify-center text-2xl rounded-lg border-2 ${isUnlocked ? 'bg-blue-900/30 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-600'}`}>
                  {badge.icon}
                </div>
                
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
