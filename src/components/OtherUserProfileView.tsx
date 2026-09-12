"use client";

import { useState } from "react";
import Link from "next/link";
import { BADGE_DICTIONARY } from "@/components/ProfileHeader";
import MediaCardProfileHorizontal from "@/components/MediaCardProfileHorizontal";
import FriendActionButton, { FriendshipRelation } from "@/components/FriendActionButton";
import {
  Lock,
  Star,
  Activity,
  Award,
  BarChart3,
  MapPin,
  Calendar,
  EyeOff,
  Film,
  BookOpen,
  Gamepad2,
  Tv,
} from "lucide-react";

interface OtherUserProfileViewProps {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    country: string | null;
    stateRegion: string | null;
    created_at: string | null;
    showcaseBadges: string[];
  };
  ratings: any[];
  activities: any[];
  badges: any[];
  statsCache: any[];
  canViewProfile: boolean;
  canViewRatings: boolean;
  canViewActivity: boolean;
  isFriend: boolean;
  initialRelation: FriendshipRelation;
}

export default function OtherUserProfileView({
  user,
  ratings,
  activities,
  badges,
  statsCache,
  canViewProfile,
  canViewRatings,
  canViewActivity,
  isFriend,
  initialRelation,
}: OtherUserProfileViewProps) {
  const [activeTab, setActiveTab] = useState<"ratings" | "activity" | "achievements" | "stats">(
    canViewRatings ? "ratings" : canViewActivity ? "activity" : "achievements"
  );

  const displayName = user.name || user.username || "User";
  const location = [user.stateRegion, user.country].filter(Boolean).join(", ");
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Profile Header */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {user.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-zinc-700 shadow-xl"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-3xl font-bold text-zinc-300 shadow-xl">
                {displayName[0]?.toUpperCase()}
              </div>
            )}

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {displayName}
              </h1>
              {user.username && (
                <p className="text-sm font-mono text-purple-400 mt-0.5">
                  @{user.username}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-400">
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    {location}
                  </span>
                )}
                {joinDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    Joined {joinDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <FriendActionButton
              targetUserId={user.id}
              targetUsername={user.username}
              initialRelation={initialRelation}
            />
          </div>
        </div>

        {/* Showcase Badges */}
        {user.showcaseBadges && user.showcaseBadges.filter(Boolean).length > 0 && (
          <div className="flex items-center gap-2 mt-6 pt-6 border-t border-zinc-800/80">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-2">
              Featured Badges:
            </span>
            {user.showcaseBadges.filter(Boolean).map((badgeId, idx) => {
              const badgeDef = BADGE_DICTIONARY.find((b) => b.id === badgeId);
              if (!badgeDef) return null;
              return (
                <div
                  key={idx}
                  title={`${badgeDef.title}: ${badgeDef.desc}`}
                  className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold text-purple-300 flex items-center gap-1.5 shadow-sm"
                >
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  {badgeDef.title}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* If profile is locked by privacy */}
      {!canViewProfile ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">This Profile is Private</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {isFriend
              ? "This user has chosen to keep their profile hidden."
              : "This user's profile is only visible to their friends. Add them as a friend to see their ratings and activity!"}
          </p>
        </div>
      ) : (
        /* Visible Profile Tabs */
        <div>
          <div className="flex flex-wrap gap-2 mb-8 border-b border-zinc-800 pb-4">
            <button
              onClick={() => setActiveTab("ratings")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "ratings"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <Star className="w-4 h-4" />
              Ratings
              {canViewRatings && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-black/30">
                  {ratings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "activity"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <Activity className="w-4 h-4" />
              Activity
              {canViewActivity && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-black/30">
                  {activities.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("achievements")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "achievements"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <Award className="w-4 h-4" />
              Achievements
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/30">
                {badges.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "stats"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </button>
          </div>

          {/* TAB CONTENT */}
          {activeTab === "ratings" && (
            <div>
              {!canViewRatings ? (
                <div className="py-16 text-center text-zinc-500 flex flex-col items-center gap-3">
                  <EyeOff className="w-8 h-8 text-zinc-600" />
                  <p className="text-sm">User has set ratings to private.</p>
                </div>
              ) : ratings.length === 0 ? (
                <p className="text-zinc-500 text-center py-16">
                  No ratings added yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {ratings.map((item) => (
                    <MediaCardProfileHorizontal key={item.mediaId} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div>
              {!canViewActivity ? (
                <div className="py-16 text-center text-zinc-500 flex flex-col items-center gap-3">
                  <EyeOff className="w-8 h-8 text-zinc-600" />
                  <p className="text-sm">User has set activity to private.</p>
                </div>
              ) : activities.length === 0 ? (
                <p className="text-zinc-500 text-center py-16">
                  No recent activities recorded.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center gap-3.5"
                    >
                      {act.media_image ? (
                        <img
                          src={act.media_image}
                          alt={act.media_title || "Media"}
                          className="w-12 h-16 rounded-lg object-cover border border-zinc-700 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                          <Film className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-zinc-500 block mb-1">
                          {new Date(act.created_at).toLocaleDateString()}
                        </span>
                        <Link
                          href={act.media_id ? `/media/${act.media_id}` : "#"}
                          className="text-sm font-bold text-white hover:text-purple-400 truncate block"
                        >
                          {act.media_title || "Unknown Media"}
                        </Link>
                        <p className="text-xs text-zinc-400 mt-1 capitalize">
                          {act.type.replace(/_/g, " ").toLowerCase()}{" "}
                          {act.data?.score !== undefined && `(${act.data.score}%)`}
                          {act.data?.episode && `Ep ${act.data.episode}`}
                          {act.data?.chapter && `Ch ${act.data.chapter}`}
                          {act.data?.status && `to ${act.data.status}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {BADGE_DICTIONARY.map((badge) => {
                const unlocked = badges.find((b) => b.badge_id === badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      unlocked
                        ? "bg-zinc-900/80 border-purple-500/30 shadow-lg shadow-purple-950/30"
                        : "bg-zinc-900/30 border-zinc-800/50 opacity-40 grayscale"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-400">
                        {badge.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {badge.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500">
                          {unlocked?.unlocked_at
                            ? `Unlocked ${new Date(
                                unlocked.unlocked_at
                              ).toLocaleDateString()}`
                            : "Locked"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400">{badge.desc}</p>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4">
                Media Tracking Breakdown
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                Total media scored and tracked across categories.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {["MOVIE", "SHOW", "GAME", "MANGA"].map((cat) => {
                  const count = ratings.filter((r) => {
                    let t = r.type;
                    if (t === "SEASON" || t === "EPISODE") t = "SHOW";
                    return t === cat;
                  }).length;
                  const Icon =
                    cat === "MOVIE"
                      ? Film
                      : cat === "SHOW"
                      ? Tv
                      : cat === "GAME"
                      ? Gamepad2
                      : BookOpen;

                  return (
                    <div
                      key={cat}
                      className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-800 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-300">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 capitalize">
                          {cat.toLowerCase()}s
                        </p>
                        <p className="text-lg font-bold text-white">{count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
