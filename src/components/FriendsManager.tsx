"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  UserCheck,
  Check,
  X,
  EyeOff,
  Eye,
  UserMinus,
  Clock,
  Search,
  Loader2,
  Shield,
} from "lucide-react";

interface FriendUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  friendshipId: string;
  since: string;
  hide_activity: boolean;
  hide_ratings: boolean;
}

interface PendingRequest {
  friendshipId: string;
  sender?: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  receiver?: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  created_at: string;
}

export default function FriendsManager() {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Add friend state
  const [targetUsername, setTargetUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadFriendsData = async () => {
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      if (data.friends) setFriends(data.friends);
      if (data.pendingReceived) setPendingReceived(data.pendingReceived);
      if (data.pendingSent) setPendingSent(data.pendingSent);
    } catch (err) {
      console.error("Failed to load friends data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriendsData();
  }, []);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = targetUsername.trim().replace(/^@/, "");
    if (!clean) return;

    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername: clean }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Friend request sent!" });
        setTargetUsername("");
        loadFriendsData();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send request." });
      }
    } catch {
      setMessage({ type: "error", text: "Error sending friend request." });
    } finally {
      setSending(false);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action: "ACCEPT" }),
      });
      if (res.ok) {
        loadFriendsData();
      }
    } catch (err) {
      console.error("Error accepting request:", err);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action: "DECLINE" }),
      });
      if (res.ok) {
        loadFriendsData();
      }
    } catch (err) {
      console.error("Error declining request:", err);
    }
  };

  const handleCancelSent = async (friendshipId: string) => {
    try {
      const res = await fetch(`/api/friends?friendshipId=${friendshipId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadFriendsData();
      }
    } catch (err) {
      console.error("Error canceling request:", err);
    }
  };

  const handleRemoveFriend = async (friendUserId: string) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      const res = await fetch(`/api/friends?friendUserId=${friendUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => f.id !== friendUserId));
      }
    } catch (err) {
      console.error("Error removing friend:", err);
    }
  };

  const handleTogglePreference = async (
    friendId: string,
    type: "activity" | "ratings",
    currentVal: boolean
  ) => {
    const newVal = !currentVal;
    try {
      const res = await fetch("/api/friends/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendId,
          ...(type === "activity" ? { hide_activity: newVal } : { hide_ratings: newVal }),
        }),
      });
      if (res.ok) {
        setFriends((prev) =>
          prev.map((f) =>
            f.id === friendId
              ? {
                  ...f,
                  ...(type === "activity"
                    ? { hide_activity: newVal }
                    : { hide_ratings: newVal }),
                }
              : f
          )
        );
      }
    } catch (err) {
      console.error("Error updating friend preference:", err);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
        Loading friends and social network...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Search & Add Friend */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Add Friends by Nickname</h3>
            <p className="text-xs text-zinc-400">Enter a user's unique handle to send a friend request</p>
          </div>
        </div>

        <form onSubmit={handleSendRequest} className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
              @
            </span>
            <input
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="e.g. shadow_hunter"
              className="w-full pl-8 pr-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !targetUsername.trim()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Send Request
          </button>
        </form>

        {message && (
          <p
            className={`text-xs ${
              message.type === "success" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {/* Pending Requests */}
      {(pendingReceived.length > 0 || pendingSent.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Pending Requests
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Received */}
            {pendingReceived.map((req) => {
              const u = req.sender;
              if (!u) return null;
              const displayName = u.name || u.username || "User";

              return (
                <div
                  key={req.friendshipId}
                  className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 flex items-center justify-between gap-3 shadow-lg"
                >
                  <Link
                    href={u.username ? `/user/${u.username}` : `/user/${u.id}`}
                    className="flex items-center gap-3 min-w-0 group"
                  >
                    {u.image ? (
                      <img
                        src={u.image}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                        {displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-purple-400 truncate">
                        {displayName}
                      </p>
                      {u.username && (
                        <p className="text-[11px] text-zinc-500 font-mono truncate">
                          @{u.username}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(req.friendshipId)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-600/20"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req.friendshipId)}
                      className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Sent */}
            {pendingSent.map((req) => {
              const u = req.receiver;
              if (!u) return null;
              const displayName = u.name || u.username || "User";

              return (
                <div
                  key={req.friendshipId}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3"
                >
                  <Link
                    href={u.username ? `/user/${u.username}` : `/user/${u.id}`}
                    className="flex items-center gap-3 min-w-0 group"
                  >
                    {u.image ? (
                      <img
                        src={u.image}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                        {displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-purple-400 truncate">
                        {displayName}
                      </p>
                      {u.username && (
                        <p className="text-[11px] text-zinc-500 font-mono truncate">
                          @{u.username}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Sent
                    </span>
                    <button
                      onClick={() => handleCancelSent(req.friendshipId)}
                      className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 border border-zinc-700"
                      title="Cancel Request"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Your Friends ({friends.length})
          </h3>
          <span className="text-xs text-zinc-500">
            Customize what you see from each friend
          </span>
        </div>

        {friends.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm">You haven't added any friends yet.</p>
            <p className="text-xs text-zinc-600">
              Search for users by nickname above to connect!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {friends.map((friend) => {
              const displayName = friend.name || friend.username || "Friend";
              const profileLink = friend.username
                ? `/user/${friend.username}`
                : `/user/${friend.id}`;

              return (
                <div
                  key={friend.id}
                  className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md"
                >
                  <Link
                    href={profileLink}
                    className="flex items-center gap-3.5 min-w-0 group"
                  >
                    {friend.image ? (
                      <img
                        src={friend.image}
                        alt={displayName}
                        className="w-11 h-11 rounded-full object-cover border border-zinc-700"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300">
                        {displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-purple-400 truncate transition-colors">
                        {displayName}
                      </p>
                      {friend.username && (
                        <p className="text-xs text-zinc-500 font-mono truncate">
                          @{friend.username}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Individual Controls: Mute Activity, Mute Ratings, Remove */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {/* Activity toggle */}
                    <button
                      onClick={() =>
                        handleTogglePreference(
                          friend.id,
                          "activity",
                          friend.hide_activity
                        )
                      }
                      title={
                        friend.hide_activity
                          ? "Activity muted (Click to unmute)"
                          : "Activity visible (Click to mute)"
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                        friend.hide_activity
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white"
                      }`}
                    >
                      {friend.hide_activity ? (
                        <>
                          <EyeOff className="w-3 h-3 text-rose-400" />
                          <span>Activity Muted</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Activity Visible</span>
                        </>
                      )}
                    </button>

                    {/* Ratings toggle */}
                    <button
                      onClick={() =>
                        handleTogglePreference(
                          friend.id,
                          "ratings",
                          friend.hide_ratings
                        )
                      }
                      title={
                        friend.hide_ratings
                          ? "Ratings muted (Click to unmute)"
                          : "Ratings visible (Click to mute)"
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                        friend.hide_ratings
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white"
                      }`}
                    >
                      {friend.hide_ratings ? (
                        <>
                          <EyeOff className="w-3 h-3 text-rose-400" />
                          <span>Ratings Muted</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Ratings Visible</span>
                        </>
                      )}
                    </button>

                    {/* Remove friend */}
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      title="Remove Friend"
                      className="p-2 rounded-xl bg-zinc-800/80 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 border border-zinc-700 transition-colors"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
