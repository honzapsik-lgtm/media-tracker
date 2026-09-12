"use client";

import { useState, useEffect } from "react";
import { Shield, Globe, Users, Lock, X, Loader2, Check } from "lucide-react";

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Visibility = "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";

interface PrivacySettings {
  profile_visibility: Visibility;
  ratings_visibility: Visibility;
  watchlist_visibility: Visibility;
  activity_visibility: Visibility;
}

const VISIBILITY_OPTIONS: { id: Visibility; label: string; icon: any; desc: string }[] = [
  {
    id: "PUBLIC",
    label: "Public",
    icon: Globe,
    desc: "Visible to everyone on the platform",
  },
  {
    id: "FRIENDS_ONLY",
    label: "Friends Only",
    icon: Users,
    desc: "Only accepted friends can view",
  },
  {
    id: "PRIVATE",
    label: "Private",
    icon: Lock,
    desc: "Only you can view",
  },
];

export default function PrivacySettingsModal({ isOpen, onClose }: PrivacySettingsModalProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    profile_visibility: "PUBLIC",
    ratings_visibility: "PUBLIC",
    watchlist_visibility: "PUBLIC",
    activity_visibility: "PUBLIC",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/profile/privacy")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings({
            profile_visibility: data.settings.profile_visibility || "PUBLIC",
            ratings_visibility: data.settings.ratings_visibility || "PUBLIC",
            watchlist_visibility: data.settings.watchlist_visibility || "PUBLIC",
            activity_visibility: data.settings.activity_visibility || "PUBLIC",
          });
        }
      })
      .catch((err) => console.error("Error loading privacy settings:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = async (field: keyof PrivacySettings, value: Visibility) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/profile/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save privacy setting:", err);
    } finally {
      setSaving(false);
    }
  };

  const sections: { key: keyof PrivacySettings; title: string; subtitle: string }[] = [
    {
      key: "profile_visibility",
      title: "Profile Visibility",
      subtitle: "Control who can find and view your full profile",
    },
    {
      key: "ratings_visibility",
      title: "Ratings & Reviews",
      subtitle: "Control who can see your scores and written reviews",
    },
    {
      key: "watchlist_visibility",
      title: "Watchlist & Progress",
      subtitle: "Control who can see your watched episodes, read chapters, and status",
    },
    {
      key: "activity_visibility",
      title: "Activity Stream",
      subtitle: "Control who sees your updates on the Home activity feed",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative text-left max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Privacy Settings</h2>
              <p className="text-xs text-zinc-400">Control what others can see across the platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            Loading privacy settings...
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((sec) => (
              <div key={sec.key} className="space-y-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white">{sec.title}</h3>
                  <p className="text-xs text-zinc-400">{sec.subtitle}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = settings[sec.key] === opt.id;

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleUpdate(sec.key, opt.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "bg-purple-600/15 border-purple-500 text-white shadow-md shadow-purple-950/30"
                            : "bg-zinc-800/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <Icon
                            className={`w-4 h-4 ${
                              isSelected ? "text-purple-400" : "text-zinc-500"
                            }`}
                          />
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <span className="text-xs font-bold block">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Saving changes...</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Changes saved</span>
              </>
            ) : (
              <span>All updates apply immediately.</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
