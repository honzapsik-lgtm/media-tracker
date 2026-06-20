"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncLoader({ 
  mediaId,
  title = "Constructing Narrative Timeline...",
  description = "We are currently exploring the deep AniList graph to uncover all sequels, prequels, and spin-offs for this franchise. The timeline will appear here automatically in just a moment!"
}: { 
  mediaId: string;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkSyncStatus = async () => {
      try {
        const res = await fetch(`/api/media/${mediaId}/sync-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.isSynced) {
            setIsSynced(true);
            clearInterval(interval);
            // Refresh the server component to load the newly constructed timeline/relations!
            router.refresh();
          }
        }
      } catch (err) {
        console.error("Failed to poll sync status", err);
      }
    };

    interval = setInterval(checkSyncStatus, 2000);
    checkSyncStatus(); // check immediately

    return () => clearInterval(interval);
  }, [mediaId, router]);

  if (isSynced) return null;

  return (
    <div className="w-full bg-gray-900 border border-blue-900/50 rounded-2xl p-6 mb-8 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.15)] flex flex-col sm:flex-row items-center gap-6">
      <div className="w-12 h-12 rounded-full border-4 border-blue-900 border-t-blue-500 animate-spin shrink-0"></div>
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <h3 className="text-xl font-bold text-blue-400">{title}</h3>
        <p className="text-gray-400 text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}
