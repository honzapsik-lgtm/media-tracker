"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NukeButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleNuke = async () => {
    if (!window.confirm("ARE YOU ABSOLUTELY SURE? This will delete ALL media, reviews, watchlists, logs, and background jobs. Only users will be preserved. THIS CANNOT BE UNDONE.")) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/nuke", { method: "POST" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      window.alert("Database nuked successfully.");
      router.refresh();
    } catch (err: any) {
      window.alert("Error nuking DB: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleNuke}
      disabled={loading}
      className="rounded bg-red-900 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-800 disabled:opacity-50"
    >
      {loading ? "Nuking..." : "NUKE DATABASE"}
    </button>
  );
}
