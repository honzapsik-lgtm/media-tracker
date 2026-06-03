"use client";

import Link from "next/link";

export default function AdminError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-8 text-white">
      <div className="max-w-md rounded-lg border border-gray-800 bg-gray-900 p-8 text-center shadow-xl">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-red-400">
          Diagnostics failed
        </p>
        <h1 className="mb-3 text-3xl font-black">Admin page failed to load</h1>
        <p className="mb-6 text-sm text-gray-400">
          The diagnostics console could not load this view. Sensitive details are hidden; check system logs or server output for the underlying error.
        </p>
        <Link href="/admin" className="rounded bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-500">
          Back to Admin
        </Link>
      </div>
    </main>
  );
}
