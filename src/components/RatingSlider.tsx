"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CRITERIA_CONFIG } from "@/lib/constants";

type RatingMediaType = "game" | "movie" | "show" | "season" | "episode" | "manga";

export const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; // Gold
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; // Black/Dark Grey
};

interface RatingSliderProps {
  mediaId: string; mediaType: RatingMediaType;
  mediaTitle: string; mediaImage: string | null;
  mediaReleaseDate?: string | null;
  initialRating?: number; initialCriteria?: Record<string, number>;
}

export default function RatingSlider({ mediaId, mediaType, mediaTitle, mediaImage, mediaReleaseDate, initialRating = 50, initialCriteria }: RatingSliderProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(initialRating);
  const [isDeepReview, setIsDeepReview] = useState<boolean>(false);
  const [hasRated, setHasRated] = useState<boolean>(false);
  
  const [criteria, setCriteria] = useState<Record<string, number>>(() => {
    if (initialCriteria && Object.keys(initialCriteria).length > 0) return initialCriteria;
    const config = CRITERIA_CONFIG[mediaType] || [];
    const initial: Record<string, number> = {};
    config.forEach((item) => { initial[item.key] = 50; });
    return initial;
  });

  const [globalCriteriaAverages, setGlobalCriteriaAverages] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/ratings?mediaId=${encodeURIComponent(mediaId)}`);
      if (!res.ok) return;
      const data = await res.json() as {
        personal?: { score: number; is_deep_review: boolean | null; criteria_scores: Record<string, number> | null } | null;
        globalCriteriaAverages?: Record<string, number>;
      };

      if (data.personal) {
        setRating(data.personal.score);
        setHasRated(true);
        if (data.personal.is_deep_review) {
          setIsDeepReview(true);
          if (data.personal.criteria_scores) {
            setCriteria(prev => ({ ...prev, ...data.personal!.criteria_scores }));
          }
        }
      }

      setGlobalCriteriaAverages(data.globalCriteriaAverages ?? {});
    } catch (err) { console.error(err); }
  }, [mediaId]);

  useEffect(() => {
    // The async fetch hydrates client-only rating state after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const updateCriterion = (key: string, value: number) => { setCriteria((prev) => ({ ...prev, [key]: value })); };

  const globalKeys = Object.keys(globalCriteriaAverages);
  const overallGlobalAverage = globalKeys.length > 0
    ? Math.round(globalKeys.reduce((sum, key) => sum + globalCriteriaAverages[key], 0) / globalKeys.length)
    : null;

  const handleSave = async () => {
    setIsSaving(true); setMessage(null);
    try {
      const payloadCriteria = isDeepReview ? criteria : {};

      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          mediaType,
          score: rating,
          isDeepReview,
          criteriaScores: payloadCriteria,
          mediaTitle,
          mediaImage,
          mediaReleaseDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }
      setMessage({ type: "success", text: "Rating saved successfully!" });
      setHasRated(true);
      fetchData(); 
      router.refresh(); // Tells Next.js to instantly reload the server data on the main page
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } 
    finally { setIsSaving(false); }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl max-w-md w-full space-y-6 shadow-xl">
      <div className="flex justify-between items-center border-b border-gray-800 pb-3">
        <h3 className="font-black text-xl tracking-tight text-white">Your Rating</h3>
        <button onClick={() => setIsDeepReview(!isDeepReview)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${isDeepReview ? "bg-blue-600/10 border-blue-500/50 text-blue-400" : "bg-gray-800 border-transparent text-gray-400 hover:text-white"}`}>
          {isDeepReview ? "Simple Mode" : "Deep Review"}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <span className="text-sm font-bold text-gray-400">Master Score</span>
          <span className={`text-3xl font-black ${getScoreColor(rating)}`}>{rating}%</span>
        </div>
        <input type="range" min="0" max="100" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
      </div>

      {isDeepReview && (
        <div className="space-y-4 bg-gray-950/50 p-4 rounded-xl border border-gray-800">
          <div className="text-center text-gray-400 font-medium text-xs border-b border-gray-900 pb-2 mb-2">
            Global Criteria Average: <span className={`font-black ${getScoreColor(overallGlobalAverage)}`}>{overallGlobalAverage !== null ? `${overallGlobalAverage}%` : "N/A"}</span>
          </div>
          {(CRITERIA_CONFIG[mediaType] || []).map((item) => (
            <div key={item.key} className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">{item.label}</span>
                <span className={getScoreColor(criteria[item.key] || 50)}>{criteria[item.key] || 50}%</span>
              </div>
              <input type="range" min="0" max="100" value={criteria[item.key] || 50} onChange={(e) => updateCriterion(item.key, Number(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
        </div>
      )}

      {message && <div className={`p-3 rounded-lg text-xs font-bold text-center border ${message.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>{message.text}</div>}
      <button onClick={handleSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black py-3 px-4 rounded-xl transition-all tracking-wide text-sm shadow-lg shadow-blue-600/10">
        {isSaving ? "Saving..." : hasRated ? "Update Rating Data" : "Save Rating Data"}
      </button>
    </div>
  );
}
