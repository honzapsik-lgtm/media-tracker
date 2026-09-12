"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Activity,
  Tv,
  BookOpen,
  Gamepad2,
  Star,
  Film,
  Bookmark,
  Clock,
  UserCheck,
  EyeOff,
  MoreHorizontal,
  Layers,
} from "lucide-react";

interface ActivityUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

interface ActivityItem {
  id: string;
  user_id: string;
  type: string;
  media_id: string | null;
  media_title: string | null;
  media_image: string | null;
  media_type: string | null;
  data: any;
  created_at: string;
  user: ActivityUser;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

const getScoreBadgeClass = (score: number) => {
  if (score >= 95) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
  if (score >= 75) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  if (score >= 50) return "bg-blue-500/20 text-blue-400 border-blue-500/40";
  if (score >= 25) return "bg-zinc-700/50 text-zinc-300 border-zinc-600/40";
  return "bg-rose-500/20 text-rose-400 border-rose-500/40";
};

export default function FriendActivityFeed() {
  const { data: session } = useSession();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"friends" | "all" | "self">("friends");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchActivities = async (selectedScope: "friends" | "all" | "self") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?scope=${selectedScope}`);
      const data = await res.json();
      if (data.activities) {
        setActivities(data.activities);
      }
    } catch (err) {
      console.error("Failed to load activities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchActivities(scope);
    } else {
      setLoading(false);
    }
  }, [session?.user?.id, scope]);

  const handleMuteUser = async (friendId: string) => {
    try {
      await fetch("/api/friends/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, hide_activity: true }),
      });
      // Filter out this friend's activities locally
      setActivities((prev) => prev.filter((a) => a.user_id !== friendId));
      setActiveMenuId(null);
    } catch (err) {
      console.error("Failed to mute user:", err);
    }
  };

  if (!session?.user?.id) {
    return null;
  }

  const renderActivityDescription = (act: ActivityItem) => {
    switch (act.type) {
      case "RATED_MEDIA": {
        const score = act.data?.score;
        return (
          <div className="flex items-center gap-2 flex-wrap text-sm text-zinc-300">
            <span>rated</span>
            {score !== undefined && (
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreBadgeClass(score)}`}>
                {score}%
              </span>
            )}
          </div>
        );
      }
      case "EPISODES_WATCHED": {
        const ep = act.data?.episode;
        return (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Tv className="w-3.5 h-3.5 text-indigo-400" />
            <span>watched episode <strong className="text-white font-semibold">{ep}</strong></span>
          </div>
        );
      }
      case "CHAPTERS_READ": {
        const ch = act.data?.chapter;
        return (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>read chapter <strong className="text-white font-semibold">{ch}</strong></span>
          </div>
        );
      }
      case "VOLUMES_READ": {
        const vol = act.data?.volume;
        return (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>read volume <strong className="text-white font-semibold">{vol}</strong></span>
          </div>
        );
      }
      case "HOURS_PLAYED": {
        const hours = act.data?.hours;
        return (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
            <span>played for <strong className="text-white font-semibold">{hours}h</strong></span>
          </div>
        );
      }
      case "WATCHLIST_STATUS": {
        const st = (act.data?.status || "").replace("_", " ").toLowerCase();
        return (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Bookmark className="w-3.5 h-3.5 text-blue-400" />
            <span>marked as <strong className="text-white font-semibold capitalize">{st}</strong></span>
          </div>
        );
      }
      case "FAVORITED": {
        return (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span>added to favorites</span>
          </div>
        );
      }
      default:
        return <span className="text-sm text-zinc-400">updated progress</span>;
    }
  };

  return (
    <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/80 p-6 shadow-xl mb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Friend Activity</h2>
            <p className="text-xs text-zinc-400">Real-time watch, read, and rating updates</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-950/80 border border-zinc-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setScope("friends")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scope === "friends"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scope === "all"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setScope("self")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scope === "self"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            You
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 flex justify-center items-center text-zinc-500 text-sm gap-2">
          <Clock className="w-4 h-4 animate-spin text-purple-400" />
          Loading activity stream...
        </div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center text-zinc-400 space-y-2">
          <p className="text-sm font-medium">No recent activity found.</p>
          <p className="text-xs text-zinc-500">
            {scope === "friends"
              ? "Add friends or encourage them to track their media to see their updates here!"
              : "Start watching, reading, or rating to generate your own activity!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
          {activities.map((act) => {
            const userProfileLink = act.user.username
              ? `/user/${act.user.username}`
              : `/user/${act.user.id}`;
            const isSelf = act.user_id === session.user.id;
            const displayName = act.user.name || act.user.username || "User";

            return (
              <div
                key={act.id}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all relative group"
              >
                {/* Media thumbnail */}
                {act.media_id ? (
                  <Link
                    href={`/media/${act.media_id}`}
                    className="shrink-0 group/media relative"
                  >
                    {act.media_image ? (
                      <img
                        src={act.media_image}
                        alt={act.media_title || "Media"}
                        className="w-14 h-20 rounded-xl object-cover border border-zinc-700/60 shadow-md group-hover/media:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-14 h-20 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-500">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                  </Link>
                ) : null}

                {/* Details */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={userProfileLink}
                      className="flex items-center gap-1.5 hover:underline text-xs font-semibold text-white truncate"
                    >
                      {act.user.image ? (
                        <img
                          src={act.user.image}
                          alt={displayName}
                          className="w-5 h-5 rounded-full object-cover border border-zinc-700 shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                          {displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="truncate">{displayName}</span>
                      {act.user.username && (
                        <span className="text-[11px] text-zinc-500 font-mono font-normal">
                          @{act.user.username}
                        </span>
                      )}
                    </Link>
                    <span className="text-[11px] text-zinc-500 shrink-0">
                      • {timeAgo(act.created_at)}
                    </span>
                  </div>

                  <div className="mb-1">{renderActivityDescription(act)}</div>

                  {act.media_id && act.media_title && (
                    <Link
                      href={`/media/${act.media_id}`}
                      className="text-xs font-medium text-purple-400 hover:text-purple-300 hover:underline truncate block"
                    >
                      {act.media_title}
                    </Link>
                  )}
                </div>

                {/* Quick Action Menu for Friends */}
                {!isSelf && (
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() =>
                        setActiveMenuId(activeMenuId === act.id ? null : act.id)
                      }
                      className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title="Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {activeMenuId === act.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-20 text-xs text-left">
                        <Link
                          href={userProfileLink}
                          className="flex items-center gap-2 px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                          onClick={() => setActiveMenuId(null)}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          View Profile
                        </Link>
                        <button
                          onClick={() => handleMuteUser(act.user_id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-zinc-800 text-left"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Mute this user's activity
                        </button>
                      </div>
                    )}
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
