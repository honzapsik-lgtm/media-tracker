"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminBadge } from "@/components/admin/AdminBadge";

interface UserData {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    created_at: string | null;
    image: string | null;
  };
  accounts: any[];
  sessions: any[];
  statsCache: any[];
  aggregates: {
    ratings: number;
    watchlist: number;
    badges: number;
    rankedLists: number;
  };
  jobs: any[];
  logs: any[];
}

export default function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load user data");
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleRoleChange = async (newRole: string) => {
    if (!data) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-role", newRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update role");
      setData({ ...data, user: { ...data.user, role: newRole } });
      alert("Role updated successfully!");
    } catch (err: any) {
      alert(`Error updating role: ${err.message}`);
    }
  };

  const handleRecalculateStats = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate-stats" }), // No mediaType means it does all 4
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to recalculate stats");
      alert(`Jobs queued for: ${json.queuedTypes.join(", ")}`);
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

  const { user, aggregates, statsCache, jobs, logs } = data;

  return (
    <main className="min-h-screen bg-gray-950 px-8 py-24 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link href="/admin" className="text-blue-400 hover:text-blue-300 font-bold mb-6 inline-block">&larr; Back to Dashboard</Link>

        {/* Header Card */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {user.image ? (
              <img src={user.image} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-gray-800" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-xl font-bold">
                {user.name?.[0] || user.email?.[0] || "?"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black">{user.name || "Unknown"}</h1>
                {user.role === "admin" && <AdminBadge value="admin" />}
              </div>
              <p className="text-gray-400 text-sm">{user.email}</p>
              <p className="text-gray-500 text-xs mt-1">ID: {user.id}</p>
              <p className="text-gray-500 text-xs mt-1">Joined: {user.created_at ? new Date(user.created_at).toLocaleString() : "Unknown"}</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 min-w-[200px] border-t md:border-t-0 md:border-l border-gray-800 pt-4 md:pt-0 md:pl-6">
            <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
            <select 
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Aggregates */}
          <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-lg font-black mb-4">Database Records</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-400">Ratings</dt><dd className="font-bold text-white">{aggregates.ratings}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Watchlist</dt><dd className="font-bold text-white">{aggregates.watchlist}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Badges</dt><dd className="font-bold text-white">{aggregates.badges}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Ranked Lists</dt><dd className="font-bold text-white">{aggregates.rankedLists}</dd></div>
            </dl>
          </section>

          {/* Stats Cache */}
          <section className="md:col-span-2 rounded-lg border border-gray-800 bg-gray-900 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">UserStatsCache</h2>
              <button 
                onClick={handleRecalculateStats}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
              >
                Recalculate Stats
              </button>
            </div>
            {statsCache.length === 0 ? (
              <p className="text-sm text-gray-500 italic flex-1">No stats cache found.</p>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-48 space-y-4 pr-2">
                {statsCache.map((sc, i) => (
                  <div key={i} className="bg-gray-950 border border-gray-800 rounded p-3">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-bold text-blue-400 uppercase tracking-widest">{sc.media_type}</span>
                      <span className="text-gray-500">{new Date(sc.updated_at).toLocaleString()}</span>
                    </div>
                    <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(sc.stats_json, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Jobs Table */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-lg font-black">Recent Jobs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-950 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Attempts</th>
                  <th className="px-4 py-3 font-bold">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {jobs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No recent jobs involving this user.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-bold text-gray-300">{job.type}</td>
                    <td className="px-4 py-3"><AdminBadge value={job.status} /></td>
                    <td className="px-4 py-3 text-gray-400">{job.attempts}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(job.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Logs Table */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-lg font-black">Recent Logs</h2>
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
