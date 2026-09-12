"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  UserPlus,
  UserCheck,
  Clock,
  Check,
  X,
  Settings,
  MoreVertical,
  EyeOff,
  Eye,
  UserMinus,
  Loader2,
} from "lucide-react";

export type FriendshipRelation =
  | "SELF"
  | "FRIENDS"
  | "PENDING_SENT"
  | "PENDING_RECEIVED"
  | "NONE"
  | "LOADING";

interface FriendActionButtonProps {
  targetUserId: string;
  targetUsername?: string | null;
  initialRelation?: FriendshipRelation;
  onStatusChange?: (newStatus: FriendshipRelation) => void;
}

export default function FriendActionButton({
  targetUserId,
  targetUsername,
  initialRelation,
  onStatusChange,
}: FriendActionButtonProps) {
  const { data: session, status } = useSession();
  const [relation, setRelation] = useState<FriendshipRelation>(
    initialRelation || "LOADING"
  );
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [hideActivity, setHideActivity] = useState(false);
  const [hideRatings, setHideRatings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (!currentUserId || status !== "authenticated") {
      setRelation("NONE");
      return;
    }

    if (currentUserId === targetUserId) {
      setRelation("SELF");
      return;
    }

    // If initialRelation was provided, skip fetching
    if (initialRelation && initialRelation !== "LOADING") {
      setRelation(initialRelation);
      return;
    }

    // Fetch friend status
    let mounted = true;
    fetch("/api/friends")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const friend = data.friends?.find((f: any) => f.id === targetUserId);
        if (friend) {
          setRelation("FRIENDS");
          setFriendshipId(friend.friendshipId);
          setHideActivity(!!friend.hide_activity);
          setHideRatings(!!friend.hide_ratings);
          return;
        }

        const received = data.pendingReceived?.find(
          (r: any) => r.sender.id === targetUserId
        );
        if (received) {
          setRelation("PENDING_RECEIVED");
          setFriendshipId(received.friendshipId);
          return;
        }

        const sent = data.pendingSent?.find(
          (s: any) => s.receiver.id === targetUserId
        );
        if (sent) {
          setRelation("PENDING_SENT");
          setFriendshipId(sent.friendshipId);
          return;
        }

        setRelation("NONE");
      })
      .catch((err) => {
        console.error("Error loading friendship status:", err);
        if (mounted) setRelation("NONE");
      });

    return () => {
      mounted = false;
    };
  }, [currentUserId, targetUserId, initialRelation, status]);

  if (relation === "SELF") {
    return (
      <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs font-semibold border border-zinc-700">
        You
      </span>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  const handleSendRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.message?.includes("accepted")) {
          setRelation("FRIENDS");
          onStatusChange?.("FRIENDS");
        } else {
          setRelation("PENDING_SENT");
          onStatusChange?.("PENDING_SENT");
        }
        if (data.friendship?.id) setFriendshipId(data.friendship.id);
      } else {
        alert(data.error || "Failed to send friend request");
      }
    } catch {
      alert("Error sending request");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!friendshipId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action: "ACCEPT" }),
      });
      if (res.ok) {
        setRelation("FRIENDS");
        onStatusChange?.("FRIENDS");
      }
    } catch {
      alert("Failed to accept");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!friendshipId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action: "DECLINE" }),
      });
      if (res.ok) {
        setRelation("NONE");
        onStatusChange?.("NONE");
      }
    } catch {
      alert("Failed to decline");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    setLoading(true);
    setShowDropdown(false);
    try {
      const res = await fetch(`/api/friends?friendUserId=${targetUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRelation("NONE");
        onStatusChange?.("NONE");
      }
    } catch {
      alert("Failed to remove friend");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/friends?friendUserId=${targetUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRelation("NONE");
        onStatusChange?.("NONE");
      }
    } catch {
      alert("Failed to cancel request");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreference = async (type: "activity" | "ratings") => {
    const newHideActivity = type === "activity" ? !hideActivity : hideActivity;
    const newHideRatings = type === "ratings" ? !hideRatings : hideRatings;

    try {
      const res = await fetch("/api/friends/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendId: targetUserId,
          hide_activity: newHideActivity,
          hide_ratings: newHideRatings,
        }),
      });
      if (res.ok) {
        setHideActivity(newHideActivity);
        setHideRatings(newHideRatings);
      }
    } catch (err) {
      console.error("Failed to update preference:", err);
    }
  };

  if (relation === "LOADING" || loading) {
    return (
      <button
        disabled
        className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Processing...
      </button>
    );
  }

  if (relation === "PENDING_RECEIVED") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleAccept}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-md shadow-emerald-600/20"
        >
          <Check className="w-3.5 h-3.5" /> Accept
        </button>
        <button
          onClick={handleDecline}
          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all border border-zinc-700"
        >
          <X className="w-3.5 h-3.5" /> Decline
        </button>
      </div>
    );
  }

  if (relation === "PENDING_SENT") {
    return (
      <button
        onClick={handleCancelRequest}
        title="Click to cancel friend request"
        className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-amber-500/30 group"
      >
        <Clock className="w-3.5 h-3.5" />
        <span>Request Sent</span>
        <X className="w-3 h-3 text-zinc-500 group-hover:text-red-400 ml-0.5" />
      </button>
    );
  }

  if (relation === "FRIENDS") {
    return (
      <div className="relative">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Friends
            <Settings className="w-3 h-3 text-emerald-500 ml-0.5" />
          </button>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-30 text-xs text-left">
            <button
              onClick={() => {
                setShowDropdown(false);
                setShowSettingsModal(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <Settings className="w-3.5 h-3.5" />
              Friend Settings
            </button>
            <button
              onClick={handleRemoveFriend}
              className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-zinc-800 text-left"
            >
              <UserMinus className="w-3.5 h-3.5" />
              Remove Friend
            </button>
          </div>
        )}

        {/* Friend Inbound Preferences Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl space-y-5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-white">Friend Preferences</h3>
                  <p className="text-xs text-zinc-400">
                    Customize what you see from @{targetUsername || "friend"}
                  </p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-800">
                  <div className="pr-3">
                    <p className="text-xs font-semibold text-white">Hide Activity Stream</p>
                    <p className="text-[11px] text-zinc-400">
                      Mute this friend's updates from your home activity feed.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePreference("activity")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      hideActivity
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-zinc-700 text-zinc-300 hover:text-white"
                    }`}
                  >
                    {hideActivity ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Muted
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Visible
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-800">
                  <div className="pr-3">
                    <p className="text-xs font-semibold text-white">Hide Ratings</p>
                    <p className="text-[11px] text-zinc-400">
                      Hide their ratings when viewing media detail pages.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePreference("ratings")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      hideRatings
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-zinc-700 text-zinc-300 hover:text-white"
                    }`}
                  >
                    {hideRatings ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Muted
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Visible
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={handleRemoveFriend}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold hover:underline flex items-center gap-1"
                >
                  <UserMinus className="w-3.5 h-3.5" /> Remove Friend
                </button>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleSendRequest}
      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
    >
      <UserPlus className="w-3.5 h-3.5" />
      Add Friend
    </button>
  );
}
