"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TextReviewEditor({ 
  mediaId,
  mediaTitle,
  mediaImage
}: { 
  mediaId: string;
  mediaTitle: string;
  mediaImage: string | null;
}) {
  const router = useRouter();
  const [reviewText, setReviewText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);

  useEffect(() => {
    async function fetchExisting() {
      const res = await fetch(`/api/reviews?mediaId=${encodeURIComponent(mediaId)}`);
      if (!res.ok) return;
      const data = await res.json() as { reviewText: string | null };

      if (data.reviewText) {
        setReviewText(data.reviewText);
        setHasExistingReview(true);
      }
    }
    fetchExisting();
  }, [mediaId]);

  const handleSave = async () => {
    setIsSubmitting(true);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId,
        reviewText,
        mediaTitle,
        mediaImage,
      }),
    });

    setIsSubmitting(false);
    if (res.ok) {
      setHasExistingReview(true);
      setIsEditing(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Error saving review: ${data.error || "Something went wrong."}`);
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
          &ldquo;{reviewText}&rdquo;
        </p>
      )}
    </div>
  );
}
