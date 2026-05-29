"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import Top100Ranker from "@/components/Top100Ranker";

export default function ProfileTabs({ initialData }: { initialData: any[] }) {
  const [activeTab, setActiveTab] = useState<'ratings' | 'reviews' | 'top100'>('ratings');
  const [processedData, setProcessedData] = useState(initialData || []);
  
  // States for inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReviewText, setEditReviewText] = useState("");
  const [editScore, setEditScore] = useState<number>(50);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // --- CRUD Operations ---
  const handleDelete = async (mediaId: string) => {
    if (!window.confirm("Are you sure you want to delete this rating completely?")) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_ratings")
      .delete()
      .eq("user_id", user.id)
      .eq("media_id", mediaId);

    if (!error) {
      setProcessedData(prev => prev.filter(item => item.mediaId !== mediaId));
    } else {
      alert(`Delete Error: ${error.message}`);
    }
  };

  const handleSaveReviewEdit = async (mediaId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_ratings")
      .update({ review_text: editReviewText })
      .eq("user_id", user.id)
      .eq("media_id", mediaId);

    if (!error) {
      setProcessedData(prev => prev.map(item =>
        item.mediaId === mediaId ? { ...item, reviewText: editReviewText } : item
      ));
      setEditingId(null);
    } else {
      alert(`Update Error: ${error.message}`);
    }
  };

  const handleSaveScoreEdit = async (mediaId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_ratings")
      .update({ score: editScore })
      .eq("user_id", user.id)
      .eq("media_id", mediaId);

    if (!error) {
      setProcessedData(prev => prev.map(item =>
        item.mediaId === mediaId ? { ...item, score: editScore } : item
      ));
      setEditingId(null);
    } else {
      alert(`Update Error: ${error.message}`);
    }
  };

  // --- Render Helpers ---
  const renderTabNavigation = () => (
    <div className="flex flex-wrap gap-2 mb-8 bg-gray-900 p-2 rounded-xl border border-gray-800 w-fit">
      <button
        onClick={() => setActiveTab('ratings')}
        className={`px-6 py-2 rounded-lg font-bold transition-all duration-200 ${
          activeTab === 'ratings' ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        All Ratings
      </button>
      <button
        onClick={() => setActiveTab('reviews')}
        className={`px-6 py-2 rounded-lg font-bold transition-all duration-200 ${
          activeTab === 'reviews' ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        Written Reviews
      </button>
      <button
        onClick={() => setActiveTab('top100')}
        className={`px-6 py-2 rounded-lg font-bold transition-all duration-200 ${
          activeTab === 'top100' ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        True Rank List
      </button>
    </div>
  );

  return (
    <div>
      {renderTabNavigation()}

      {/* TAB 1: ALL RATINGS (Poster Grid) */}
      {activeTab === 'ratings' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {processedData.map((item) => (
            <div key={item.mediaId} className="relative group bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-800 flex flex-col h-full">
              
              {/* Score Badge */}
              <div className={`absolute top-2 right-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border ${
                item.score >= 75 ? 'bg-green-900 border-green-500 text-white' : 
                item.score >= 50 ? 'bg-yellow-900 border-yellow-500 text-white' : 
                'bg-red-900 border-red-500 text-white'
              }`}>
                {item.score}%
              </div>

              {/* Poster */}
              <Link href={`/media/${item.mediaId}`} className="block relative aspect-[2/3] overflow-hidden">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 p-4 text-center">No Image</div>
                )}
              </Link>

              {/* Details & Inline Edit */}
              <div className="p-4 flex flex-col flex-1">
                <h2 className="font-semibold text-lg truncate mb-1" title={item.title}>{item.title}</h2>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">{item.type}</p>

                {/* CRUD Controls at the bottom */}
                <div className="mt-auto border-t border-gray-800 pt-3">
                  {editingId === `score-${item.mediaId}` ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        type="range" min="0" max="100" value={editScore}
                        onChange={(e) => setEditScore(Number(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                      <div className="flex justify-between text-xs">
                        <span>{editScore}%</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveScoreEdit(item.mediaId)} className="text-green-400 font-bold hover:underline">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-white">Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                      <button 
                        onClick={() => { setEditingId(`score-${item.mediaId}`); setEditScore(item.score); }}
                        className="text-gray-500 hover:text-blue-400 transition-colors"
                      >
                        Edit Score
                      </button>
                      <button 
                        onClick={() => handleDelete(item.mediaId)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: WRITTEN REVIEWS (List Feed) */}
      {activeTab === 'reviews' && (
        <div className="flex flex-col gap-6 max-w-4xl">
          {processedData.filter(item => item.reviewText).map((item) => (
            <div key={item.mediaId} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl flex gap-6">
              
              {/* Thumbnail */}
              <Link href={`/media/${item.mediaId}`} className="shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="w-24 rounded-lg shadow-md border border-gray-700" />
                ) : (
                  <div className="w-24 aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center text-xs">No Img</div>
                )}
              </Link>

              {/* Review Content */}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Link href={`/media/${item.mediaId}`} className="text-xl font-black text-gray-200 hover:text-white transition-colors">
                      {item.title}
                    </Link>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{item.type}</p>
                  </div>
                  
                  {/* CSS Fix: Grouped Score and Action Buttons properly so they never overlap */}
                  <div className="flex flex-col items-end gap-2">
                     <span className={`px-3 py-1 rounded-lg border font-black text-sm ${
                        item.score >= 75 ? 'bg-green-900 border-green-500 text-white' : 
                        item.score >= 50 ? 'bg-yellow-900 border-yellow-500 text-white' : 
                        'bg-red-900 border-red-500 text-white'
                      }`}>
                        {item.score}%
                      </span>
                      <div className="flex gap-3 text-xs font-bold uppercase tracking-wider mt-1">
                        <button 
                          onClick={() => { setEditingId(`review-${item.mediaId}`); setEditReviewText(item.reviewText || ""); }}
                          className="text-gray-500 hover:text-blue-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(item.mediaId)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                  </div>
                </div>

                <div className="mt-4 flex-1">
                  {editingId === `review-${item.mediaId}` ? (
                    <div className="space-y-3">
                      <textarea
                        value={editReviewText}
                        onChange={(e) => setEditReviewText(e.target.value)}
                        className="w-full h-24 bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-y"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveReviewEdit(item.mediaId)}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-4 rounded transition-colors text-sm"
                        >
                          Save Changes
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="bg-transparent border border-gray-700 text-gray-400 hover:text-white font-bold py-1.5 px-4 rounded transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-300 leading-relaxed italic border-l-4 border-gray-700 pl-4 py-1 text-sm">
                      "{item.reviewText}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {processedData.filter(item => item.reviewText).length === 0 && (
             <p className="text-gray-500 italic p-4">You have not written any text reviews yet.</p>
          )}
        </div>
      )}

      {/* TAB 3: TOP 100 RANKER */}
      {activeTab === 'top100' && (
        <Top100Ranker rawData={processedData} />
      )}
    </div>
  );
}