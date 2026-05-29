"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const CRITERIA_CONFIG: Record<string, { key: string; label: string }[]> = {
  game: [
    { key: "narrative", label: "Narrative" },
    { key: "gameplay", label: "Gameplay" },
    { key: "visuals", label: "Visuals and graphics" },
    { key: "performance", label: "Performance" },
    { key: "audio", label: "Audio and soundtrack" },
  ],
  movie: [
    { key: "narrative", label: "Narrative" },
    { key: "cinematography", label: "Cinematography" },
    { key: "sound", label: "Sound and score" },
    { key: "acting", label: "Acting performances" },
  ],
  show: [
    { key: "narrative", label: "Narrative" },
    { key: "cinematography", label: "Cinematography" },
    { key: "sound", label: "Sound and score" },
    { key: "acting", label: "Acting performances" },
    { key: "ending", label: "Ending" },
  ],
  manga: [
    { key: "narrative", label: "Narrative" },
    { key: "artStyle", label: "Art style" },
    { key: "characters", label: "Characters" },
    { key: "development", label: "Development" },
  ],
};



export default function RatingSlider({ 
  mediaId, 
  mediaType,
  mediaTitle,
  mediaImage
}: { 
  mediaId: string; 
  mediaType: string;
  mediaTitle: string;
  mediaImage: string | null;
}) {
  const [rating, setRating] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [isDeepReview, setIsDeepReview] = useState(false);
  const [criteria, setCriteria] = useState<Record<string, number>>({});
  const [globalCriteriaAverages, setGlobalCriteriaAverages] = useState<Record<string, number>>({});

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const initialCriteria: Record<string, number> = {};
    CRITERIA_CONFIG[mediaType]?.forEach(c => {
      initialCriteria[c.key] = 50;
    });
    setCriteria(initialCriteria);

    async function fetchExistingAndGlobalData() {
      const { data: { user } } = await supabase.auth.getUser();
      // Fetch user's existing rating
      if (user) {
        const { data: userRatingData } = await supabase
          .from("user_ratings")
          .select("score, is_deep_review, criteria_scores")
          .eq("user_id", user.id)
          .eq("media_id", mediaId)
          .single();

        if (userRatingData) {
          setRating(userRatingData.score);
          if (userRatingData.is_deep_review) {
            setIsDeepReview(true);
            if (userRatingData.criteria_scores) {
              // Only update criteria that are part of the current mediaType config
              const updatedCriteria = { ...initialCriteria };
              for (const key in userRatingData.criteria_scores) {
                if (initialCriteria.hasOwnProperty(key)) {
                  updatedCriteria[key] = userRatingData.criteria_scores[key];
                }
              }
              setCriteria(updatedCriteria);
            }
          }
          setHasRated(true);
        }
      }

      // Fetch global criteria averages
      const { data: allRatings, error: allRatingsError } = await supabase
        .from("user_ratings")
        .select("criteria_scores")
        .eq("media_id", mediaId);

      if (allRatingsError) {
        console.error("Error fetching global ratings:", allRatingsError.message);
        return;
      }

      if (allRatings) {
        const criteriaSums: Record<string, number[]> = {};
        CRITERIA_CONFIG[mediaType]?.forEach(c => {
          criteriaSums[c.key] = [];
        });

        allRatings.forEach(rating => {
          if (rating.criteria_scores) {
            for (const key in rating.criteria_scores) {
              if (criteriaSums.hasOwnProperty(key)) {
                criteriaSums[key].push(rating.criteria_scores[key]);
              }
            }
          }
        });

        const calculatedGlobalAverages: Record<string, number> = {};
        for (const key in criteriaSums) {
          if (criteriaSums[key].length > 0) {
            const sum = criteriaSums[key].reduce((acc, val) => acc + val, 0);
            calculatedGlobalAverages[key] = Math.round(sum / criteriaSums[key].length);
          }
        }
        setGlobalCriteriaAverages(calculatedGlobalAverages);
      }
    }
    fetchExistingAndGlobalData();
  }, [mediaId, mediaType, supabase]);

  const updateCriterion = (key: string, value: number) => {
    setCriteria(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("You must be logged in to rate!");

    const username = user.user_metadata?.custom_claims?.global_name || user.email?.split('@')[0] || 'Anonymous';
    const payload = {
      score: rating, username: username, avatar_url: user.user_metadata?.avatar_url || null,
      is_deep_review: isDeepReview, criteria_scores: isDeepReview ? criteria : null,
      media_title: mediaTitle, media_image: mediaImage
    };

    const { error } = hasRated 
      ? await supabase.from("user_ratings").update(payload).eq("user_id", user.id).eq("media_id", mediaId)
      : await supabase.from("user_ratings").insert({ user_id: user.id, media_id: mediaId, ...payload });

    setIsSubmitting(false);
    if (error) alert(`Error: ${error.message}`);
    else setHasRated(true);
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      <div className="flex justify-between items-end">
        <h3 className="font-bold text-gray-200">Your Score</h3>
        <span className={`text-4xl font-black ${rating >= 75 ? 'text-green-400' : rating >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {rating}%
        </span>
      </div>

      <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
        <button onClick={() => setIsDeepReview(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${!isDeepReview ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Quick</button>
        <button onClick={() => setIsDeepReview(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${isDeepReview ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Deep</button>
      </div>

      {!isDeepReview ? (
        <input type="range" min="0" max="100" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
      ) : (
        <div className="space-y-4 bg-gray-950/50 p-4 rounded-xl border border-gray-800">
          <div className="text-center text-gray-500 text-sm mb-4">
            Calculated Criteria Average: {Math.round(Object.values(criteria).reduce((sum, val) => sum + val, 0) / (Object.keys(criteria).length || 1))}
          </div>
          {CRITERIA_CONFIG[mediaType]?.map((item) => (
            <div key={item.key}>
              <div className="flex justify-between text-xs mb-1 font-bold">
                <span className="text-gray-400">
                  {item.label}{globalCriteriaAverages[item.key] !== undefined && ` (Global: ${globalCriteriaAverages[item.key]}%)`}
                </span>
                <span className="text-blue-400">{criteria[item.key]}</span>
              </div>
              <input type="range" min="0" max="100" value={criteria[item.key]} onChange={(e) => updateCriterion(item.key, Number(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
        </div>
      )}

      <button onClick={handleSave} disabled={isSubmitting} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
        {isSubmitting ? "Saving..." : hasRated ? "Update Rating" : "Save Rating"}
      </button>
    </div>
  );
}