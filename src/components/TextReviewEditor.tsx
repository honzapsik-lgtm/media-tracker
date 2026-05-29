"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function TextReviewEditor({ 
  mediaId,
  mediaTitle,
  mediaImage
}: { 
  mediaId: string;
  mediaTitle: string;
  mediaImage: string | null;
}) {
  const [reviewText, setReviewText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchExisting() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_ratings")
        .select("review_text")
        .eq("user_id", user.id)
        .eq("media_id", mediaId)
        .single();

      if (data?.review_text) {
        setReviewText(data.review_text);
        setHasExistingReview(true);
      }
    }
    fetchExisting();
  }, [mediaId, supabase]);

  const handleSave = async () => {
    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("You must be logged in to review!");
      setIsSubmitting(false);
      return;
    }

    const username = user.user_metadata?.custom_claims?.global_name || user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    // We only UPDATE the text. The score is handled by the RatingSlider.
    const { error } = await supabase
      .from("user_ratings")
      .upsert({
        user_id: user.id,
        media_id: mediaId,
        review_text: reviewText.trim() === "" ? null : reviewText,
        username: username,
        avatar_url: avatarUrl,
        media_title: mediaTitle,
        media_image: mediaImage
      }, { onConflict: "user_id, media_id" });

    setIsSubmitting(false);
    if (!error) {
      setHasExistingReview(true);
      setIsEditing(false);
      window.location.reload(); 
    } else {
      alert(`Error saving review: ${error.message}`);
    }
  };

  if (!isEditing && !hasExistingReview) {
    return (
      <div className="mb-8">
        <button 
          onClick={() => setIsEditing(true)}
          className="bg-gray-900 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
        >
          + Write a Written Review
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 shadow-xl animate-in slide-in-from-top-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-200">Your Review</h3>
        {hasExistingReview && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="text-blue-400 text-sm font-bold hover:underline">Edit</button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="What did you think of it? Write your thoughts here..."
            className="w-full h-32 bg-gray-950 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-y"
          />
          <div className="flex gap-3">
            <button 
              onClick={handleSave} disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? "Saving..." : "Publish Review"}
            </button>
            <button 
              onClick={() => setIsEditing(false)} disabled={isSubmitting}
              className="bg-transparent border border-gray-700 text-gray-400 hover:text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-300 leading-relaxed italic border-l-4 border-gray-700 pl-4 py-2">
          "{reviewText}"
        </p>
      )}
    </div>
  );
}