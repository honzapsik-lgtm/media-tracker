"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminBadge } from "@/components/admin/AdminBadge";

interface MediaData {
  tracking: {
    id: string;
    type: string;
  };
  caches: any[];
  stats: any | null;
  aggregations: {
    totalRatings: number;
    writtenReviews: number;
    deepReviews: number;
    watchlistInclusions: number;
  };
  logs: any[];
}

export default function AdminMediaPage({ params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = use(params);
  const [data, setData] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/media/${mediaId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load media data");
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [mediaId]);

  const handleClearCache = async () => {
    if (!confirm(`Are you sure you want to clear the cache for ${mediaId} and all its sub-caches?`)) return;
    try {
      const res = await fetch(`/api/admin/media/${mediaId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-cache" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to clear cache");
      alert(`Cleared ${json.deletedCount} cache entries!`);
      // Update local state to clear the caches view
      if (data) setData({ ...data, caches: [] });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRefreshStats = async () => {
    try {
      const res = await fetch(`/api/admin/media/${mediaId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh-stats" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to refresh stats");
      alert(`Stats refreshed successfully!`);
      // Optionally re-fetch data here if needed
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 px-8 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <Link href="/admin" className="text-blue-400 hover:text-blue-300 font-bold mb-6 inline-block">&larr; Back to Dashboard</Link>
          <div className="rounded border border-red-500/40 bg-red-900/20 p-5 text-red-200 font-bold">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <main className="min-h-screen bg-gray-950 px-8 py-24 text-white">
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className="h-6 w-48 bg-gray-800 rounded"></div>
          <div className="h-32 bg-gray-900 rounded-lg border border-gray-800"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-900 rounded-lg border border-gray-800"></div>
            <div className="h-64 bg-gray-900 rounded-lg border border-gray-800"></div>
          </div>
          <div className="h-64 bg-gray-900 rounded-lg border border-gray-800"></div>
        </div>
      </main>
    );
  }

  const { tracking, caches, stats, aggregations, logs } = data;

  const rootCache = caches.find(c => c.id === tracking.id);
  const titleString = rootCache?.data?.title || rootCache?.data?.name || "Unknown Title (Not Cached)";
  const idParts = tracking.id.split('-');
  const providerName = idParts[0].toUpperCase();
  const externalId = idParts[idParts.length - 1];

  const ratingDrift = stats && stats.total_ratings !== aggregations.totalRatings;

  return (
    <main className="min-h-screen bg-gray-950 px-8 py-24 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link href="/admin/media" className="text-blue-400 hover:text-blue-300 font-bold mb-6 inline-block">&larr; Back to Lookup</Link>

        {ratingDrift && (
           <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg font-bold flex items-center justify-between">
             <div>
               <span className="mr-2">⚠️</span>
               Data Inconsistency Detected: Live user ratings count ({aggregations.totalRatings}) does not match the cached media_stats total ({stats.total_ratings}).
             </div>
             <button onClick={handleRefreshStats} className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs py-1.5 px-3 rounded transition-colors">Fix Now</button>
           </div>
        )}

        {/* Primary Metadata Card */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 flex flex-col md:flex-row justify-between gap-6 shadow-xl">
          <div>
            <h1 className="text-4xl font-black mb-2">{titleString}</h1>
            <div className="flex flex-wrap gap-3 text-sm mb-4">
              <span className="text-gray-400 font-bold bg-gray-800 px-2 py-0.5 rounded uppercase tracking-widest">{tracking.type}</span>
              <span className="text-gray-400 font-bold bg-gray-800 px-2 py-0.5 rounded">{providerName} ID: {externalId}</span>
              <span className="text-gray-500 font-mono bg-gray-950 px-2 py-0.5 rounded border border-gray-800">{tracking.id}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleRefreshStats}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition-colors self-start shadow-lg"
            >
              Recalculate Community Stats
            </button>
            <button 
              onClick={handleClearCache}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded transition-colors self-start shadow-lg"
            >
              Flush Provider Cache
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Aggregations & DB Stats */}
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-lg font-black mb-4">Database Engagement</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-400">Total Ratings</dt><dd className="font-bold text-white">{aggregations.totalRatings}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Written Reviews</dt><dd className="font-bold text-white">{aggregations.writtenReviews}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Deep Reviews</dt><dd className="font-bold text-white">{aggregations.deepReviews}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Watchlist Inclusions</dt><dd className="font-bold text-white">{aggregations.watchlistInclusions}</dd></div>
            </dl>
            <hr className="my-6 border-gray-800" />
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">media_stats row</h3>
            {stats ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-gray-400">Community Average</dt><dd className="font-bold text-white">{stats.community_average}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Total Ratings</dt><dd className="font-bold text-white">{stats.total_ratings}</dd></div>
              </dl>
            ) : (
              <p className="text-xs text-amber-500 italic">No media_stats row found for this item.</p>
            )}
          </section>

          {/* Provider Cache Inspector */}
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 flex flex-col max-h-[500px]">
            <h2 className="text-lg font-black mb-4">Provider Cache Inspector</h2>
            {caches.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="bg-red-900/30 text-red-400 border border-red-800 px-3 py-1 rounded font-bold text-sm">
                  EXPIRED / MISSING CACHE
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {caches.map((cache) => {
                  const isExpired = new Date(cache.expires_at) < new Date();
                  return (
                    <details key={cache.id} className="bg-gray-950 border border-gray-800 rounded p-3 group">
                      <summary className="cursor-pointer flex flex-col gap-1 focus:outline-none">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-blue-400 break-all font-mono text-sm">{cache.id}</span>
                          {isExpired ? (
                            <span className="bg-red-900/30 text-red-400 border border-red-800 px-2 py-0.5 rounded font-bold text-xs">EXPIRED</span>
                          ) : (
                            <span className="bg-green-900/30 text-green-400 border border-green-800 px-2 py-0.5 rounded font-bold text-xs">FRESH</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Expires: {new Date(cache.expires_at).toLocaleString()}
                        </div>
                      </summary>
                      <pre className="mt-3 font-mono bg-gray-900 border border-gray-800 p-3 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {JSON.stringify(cache.data, null, 2)}
                      </pre>
                    </details>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Logs Engine Section */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-lg font-black">Historical Logs Engine</h2>
            <p className="text-sm text-gray-500 mt-1">Lifecycle events specific to {tracking.id}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950 text-xs uppercase text-gray-500 whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 font-bold">Level</th>
                  <th className="px-4 py-3 font-bold">Event</th>
                  <th className="px-4 py-3 font-bold w-full">Message</th>
                  <th className="px-4 py-3 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {logs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No logs found.</td></tr>
                ) : logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr 
                      className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3"><AdminBadge value={log.level} /></td>
                      <td className="px-4 py-3 font-bold text-gray-300 whitespace-nowrap">{log.event}</td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-xs md:max-w-md">{log.errorMessage || log.message || "-"}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                    {expandedLogId === log.id && (
                      <tr className="bg-gray-950">
                        <td colSpan={4} className="px-4 py-4 border-l-2 border-blue-500/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Metadata</p>
                              <pre className="bg-gray-900 border border-gray-800 p-3 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(log.metadata || {}, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Error Details</p>
                              <pre className="bg-gray-900 border border-gray-800 p-3 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                {log.errorMessage ? `Name: ${log.errorName}\nMsg: ${log.errorMessage}\nStack: ${log.errorStack?.slice(0, 500)}...` : "None"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}
