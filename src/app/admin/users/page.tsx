"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/app/admin/admin-nav";

export default function AdminUsersPage() {
  const [userId, setUserId] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userId.trim()) {
      router.push(`/admin/users/${userId.trim()}`);
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
        <h1 className="mb-3 text-4xl font-black">User Lookup</h1>
        <p className="text-gray-400 mb-8">Enter a user ID to view their diagnostics and manage their account.</p>

        <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 max-w-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-bold text-gray-300 mb-2">User ID</label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="w-full bg-gray-950 border border-gray-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!userId.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              Lookup User
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
