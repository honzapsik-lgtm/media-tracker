"use client";

import { useTransition } from "react";
import { wipeDatabaseAction } from "./actions";
import { useRouter } from "next/navigation";

export function WipeDatabaseButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleWipe = () => {
    const confirmation1 = window.confirm("Are you absolutely sure you want to wipe the entire database? This cannot be undone! Only auth and admin rights will be preserved.");
    if (!confirmation1) return;

    const confirmation2 = window.prompt("FINAL WARNING: All user ratings, lists, cache, and history will be deleted. Type 'nuke' to proceed.");
    if (confirmation2 !== 'nuke') return;

    startTransition(async () => {
      await wipeDatabaseAction();
      router.refresh();
      alert("Database wiped successfully!");
    });
  };

  return (
    <button
      onClick={handleWipe}
      disabled={isPending}
      className="rounded bg-red-900 border border-red-700 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-800 disabled:opacity-50 transition-colors shadow-lg shadow-red-900/20"
    >
      {isPending ? "Wiping Database..." : "Nuke Database"}
    </button>
  );
}
