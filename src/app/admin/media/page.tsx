"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";

export default function AdminMediaLookupPage() {
  const [mediaId, setMediaId] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaId.trim()) {
      router.push(`/admin/media/${mediaId.trim()}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white px-8 pb-16 pt-24">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <Link href="/admin" className="text-blue-400 hover:text-blue-300 font-bold mb-6 inline-block">&larr; Back to Dashboard</Link>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-400">
          Internal
        </p>
        <h1 className="mb-3 text-4xl font-black">Media Lookup</h1>
        <p className="text-gray-400 mb-8">Enter a Media ID (e.g., tmdb-movie-123) to view its cache, logs, and tracking stats.</p>

        <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 max-w-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="mediaId" className="block text-sm font-bold text-gray-300 mb-2">Media ID</label>
              <input
                type="text"
                id="mediaId"
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
                placeholder="e.g. tmdb-show-12345"
                className="w-full bg-gray-950 border border-gray-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!mediaId.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              Lookup Media
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
