"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { User, Check, AlertCircle, Loader2 } from "lucide-react";

export default function UsernamePromptModal() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (!session.user.username) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  }, [status, session]);

  // Debounced availability check
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) {
      setIsAvailable(null);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setChecking(true);
      setError(null);
      try {
        const res = await fetch(`/api/profile/username?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (res.ok) {
          if (data.available) {
            setIsAvailable(true);
            setError(null);
          } else {
            setIsAvailable(false);
            setError(data.error || "This nickname is already taken.");
          }
        } else {
          setIsAvailable(false);
          setError(data.error || "Invalid nickname.");
        }
      } catch {
        setError("Error verifying availability.");
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim();
    if (!clean || clean.length < 3) {
      setError("Nickname must be at least 3 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set nickname");
      }

      // Reload page to refresh the NextAuth session with the new username
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Failed to set nickname.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 md:p-8 shadow-2xl relative text-left">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Choose your Nickname</h2>
            <p className="text-xs text-zinc-400">
              Welcome to the community! Pick a unique handle to get started.
            </p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-5 leading-relaxed">
          Your unique nickname is how friends will search for you, tag you, and view your activity and ratings.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Unique Nickname
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                placeholder="e.g. shadow_hunter"
                required
                minLength={3}
                maxLength={25}
                className="w-full pl-8 pr-10 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                autoFocus
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                {checking ? (
                  <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                ) : isAvailable === true ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : isAvailable === false ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : null}
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-1.5">
              3-25 characters. Letters, numbers, underscores, dashes, and dots.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || checking || !username.trim() || isAvailable === false}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting Nickname...
              </>
            ) : (
              "Confirm & Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
