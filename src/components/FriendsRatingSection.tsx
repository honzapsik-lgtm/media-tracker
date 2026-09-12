"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Users, Star, MessageSquare } from "lucide-react";

interface FriendRating {
  id: string;
  score: number;
  review_text: string | null;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
}

const getScoreBadgeClass = (score: number) => {
  if (score >= 95) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.3)]";
  if (score >= 75) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  if (score >= 50) return "bg-blue-500/20 text-blue-400 border-blue-500/40";
  if (score >= 25) return "bg-zinc-700/50 text-zinc-300 border-zinc-600/40";
  return "bg-rose-500/20 text-rose-400 border-rose-500/40";
};

export default function FriendsRatingSection({ mediaId }: { mediaId: string }) {
  const { data: session } = useSession();
  const [ratings, setRatings] = useState<FriendRating[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id || !mediaId) return;

    let mounted = true;
    setLoading(true);
    fetch(`/api/ratings/friends?mediaId=${encodeURIComponent(mediaId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.friendsRatings) {
          setRatings(data.friendsRatings);
        }
      })
      .catch((err) => console.error("Failed to load friend ratings:", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [session?.user?.id, mediaId]);

  if (!session?.user?.id || ratings.length === 0) {
    return null;
  }

  const averageScore = Math.round(
    ratings.reduce((acc, curr) => acc + curr.score, 0) / ratings.length
  );

  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Friend Ratings
              <span className="text-xs font-normal text-zinc-400">({ratings.length})</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700/60">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-bold text-zinc-200">{averageScore}% avg</span>
        </div>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {ratings.map((item) => {
          const profileLink = item.user.username ? `/user/${item.user.username}` : `/user/${item.user.id}`;
          const displayName = item.user.name || item.user.username || "Friend";

          return (
            <div
              key={item.id}
              className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700/80 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={profileLink}
                  className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity"
                >
                  {item.user.image ? (
                    <img
                      src={item.user.image}
                      alt={displayName}
                      className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-blue-400 truncate transition-colors">
                      {displayName}
                    </p>
                    {item.user.username && (
                      <p className="text-[11px] text-zinc-500 font-mono truncate">
                        @{item.user.username}
                      </p>
                    )}
                  </div>
                </Link>

                <div
                  className={`px-2.5 py-0.5 rounded-md border text-xs font-bold shrink-0 ${getScoreBadgeClass(
                    item.score
                  )}`}
                >
                  {item.score}%
                </div>
              </div>

              {item.review_text && (
                <div className="flex items-start gap-1.5 pt-1.5 border-t border-zinc-800/60 text-xs text-zinc-400 italic">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-500" />
                  <p className="line-clamp-2">{item.review_text}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
