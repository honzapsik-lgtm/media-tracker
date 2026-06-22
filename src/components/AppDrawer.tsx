"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type ListCategory = "watch" | "play" | "read";

interface WatchlistItem {
  media_id: string;
  media_title: string | null;
  media_image: string | null;
  media_type: string | null;
  status: string | null;
  
  // Metric tracking fields
  episodesWatched?: number;
  chaptersRead?: number;
  volumesRead?: number;
  hoursPlayed?: number;
  platform?: string | null;
  watchCount?: number;
  is_rewatching?: boolean;
  is_rereading?: boolean;
}

export default function AppDrawer() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [activeView, setActiveView] = useState<"menu" | "list">("menu");
  const [activeCategory, setActiveCategory] = useState<ListCategory>("watch");
  
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [activeTab, setActiveTab] = useState("PLANNING");
  const [isLoading, setIsLoading] = useState(false);
  const [isWipingDb, setIsWipingDb] = useState(false);

  const fetchWatchlist = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || activeView !== "list" || !session) return;
    fetchWatchlist();
  }, [isOpen, activeView, session]);

  // Synchronize drawer with changes on the details page progress tracker
  useEffect(() => {
    if (!isOpen || !session) return;
    const handleWatchlistChange = () => {
      fetchWatchlist();
    };
    window.addEventListener("watchlist-updated", handleWatchlistChange);
    return () => {
      window.removeEventListener("watchlist-updated", handleWatchlistChange);
    };
  }, [isOpen, session]);

  const handleRemove = async (mediaId: string) => {
    const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`, { method: "DELETE" });
    if (res.ok) {
      setWatchlist((items) => items.filter((item) => item.media_id !== mediaId));
      window.dispatchEvent(new Event("watchlist-updated"));
    }
  };

  const handleUpdateStatus = async (mediaId: string, newStatus: string) => {
    const res = await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId, status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json() as WatchlistItem;
      setWatchlist((items) =>
        items.map((item) =>
          item.media_id === mediaId ? { ...item, status: updated.status } : item
        )
      );
      window.dispatchEvent(new Event("watchlist-updated"));
    }
  };

  const handleUpdateProgress = async (mediaId: string, fields: Partial<WatchlistItem>) => {
    const res = await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId, ...fields }),
    });
    if (res.ok) {
      const updated = await res.json() as WatchlistItem;
      setWatchlist((items) =>
        items.map((item) =>
          item.media_id === mediaId ? { ...item, ...updated } : item
        )
      );
      window.dispatchEvent(new Event("watchlist-updated"));
    }
  };

  const handleWipeDb = async () => {
    const confirmText = "WIPE LOCAL APP DATA";
    const confirmation = window.prompt(
      `Wipe all local app data? Auth users will stay, but ratings, reviews, lists, stats, caches, jobs, badges, and badge showcases will be cleared.\n\nType ${confirmText} to continue.`
    );

    if (confirmation !== confirmText) {
      return;
    }

    setIsWipingDb(true);
    try {
      const res = await fetch("/api/debug/wipe-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not wipe database.");
      }

      setWatchlist([]);
      router.refresh();
      alert("Database wiped.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not wipe database.");
    } finally {
      setIsWipingDb(false);
    }
  };

  const filteredList = watchlist.filter(item => {
    const matchesStatus = item.status === activeTab;
    const type = item.media_type?.toLowerCase() ?? "";
    
    let matchesCategory = false;
    if (activeCategory === "watch") matchesCategory = type === "movie" || type === "show";
    else if (activeCategory === "play") matchesCategory = type === "game";
    else if (activeCategory === "read") matchesCategory = type === "manga";

    return matchesStatus && matchesCategory;
  });

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setActiveView("menu"), 300); 
  };

  const openList = (category: ListCategory) => {
    setActiveCategory(category);
    setActiveTab("PLANNING");
    setActiveView("list");
  };

  const categoryConfig = {
    watch: { title: "My Watchlist" },
    play: { title: "Game Backlog" },
    read: { title: "My Readlist" }
  };

  const getStatusTabs = (cat: ListCategory) => {
    const isGame = cat === "play";
    const isManga = cat === "read";
    return [
      { key: "PLANNING", label: isGame ? "Backlog" : isManga ? "Plan" : "Plan" },
      { key: "IN_PROGRESS", label: isGame ? "Playing" : isManga ? "Reading" : "Watching" },
      { key: "COMPLETED", label: "Done" },
      { key: "ON_HOLD", label: "Hold" },
      { key: "DROPPED", label: "Drop" },
    ];
  };

  const drawerOverlay = (
    <div className={`fixed inset-0 z-[100] ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      )}

      <div className={`fixed top-0 right-0 h-dvh w-full sm:w-96 bg-gray-950 border-l border-gray-800 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* VIEW 1: THE MASTER MENU */}
        {activeView === "menu" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
              <h2 className="text-xl font-black text-white tracking-tight">Toolkit</h2>
              <button onClick={handleClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Menu Buttons */}
              <button onClick={() => openList("watch")} className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-900/30 border border-blue-500/50 rounded-lg flex items-center justify-center text-blue-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </div>
                  <span className="font-bold text-gray-200 group-hover:text-white">Watchlist</span>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <button onClick={() => openList("play")} className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-900/30 border border-emerald-500/50 rounded-lg flex items-center justify-center text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <span className="font-bold text-gray-200 group-hover:text-white">Game Backlog</span>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <button onClick={() => openList("read")} className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-900/30 border border-purple-500/50 rounded-lg flex items-center justify-center text-purple-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <span className="font-bold text-gray-200 group-hover:text-white">Manga Readlist</span>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              {/* Db Wipe Button */}
              <button 
                onClick={handleWipeDb}
                disabled={isWipingDb}
                className="w-full flex items-center justify-between p-4 bg-red-950/20 border border-red-900/30 rounded-xl hover:bg-red-900/30 hover:border-red-500/50 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center justify-center text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                  <span className="font-bold text-red-400 group-hover:text-red-300">Wipe Local DB Cache</span>
                </div>
              </button>
            </div>

            {/* LOGOUT BUTTON PINNED TO BOTTOM */}
            {session && (
              <div className="p-4 border-t border-gray-800 bg-gray-900/30 space-y-3">
                {/* Admin Panel Button */}
                {(session.user as any)?.role === "admin" && (
                  <button
                    onClick={() => { handleClose(); router.push('/admin'); }}
                    className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Admin Panel
                  </button>
                )}
                <button 
                  onClick={() => signOut()} 
                  className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Log Out
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: THE ISOLATED LIST */}
        {activeView === "list" && (
           <div className="flex flex-col h-full">
            <div className="flex flex-col border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center justify-between p-4">
                <button onClick={() => setActiveView("menu")} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg> Back
                </button>
                <button onClick={handleClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-6 pb-4">
                <h2 className="text-xl font-black text-white tracking-tight">{categoryConfig[activeCategory].title}</h2>
              </div>
            </div>

            {/* Scrollable Tab List supporting all 5 statuses */}
            <div className="flex border-b border-gray-800 shrink-0 overflow-x-auto scrollbar-none bg-gray-950/20">
              {getStatusTabs(activeCategory).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-[70px] py-3 text-[10px] font-black tracking-wider uppercase transition-all border-b-2 whitespace-nowrap text-center
                    ${activeTab === tab.key 
                      ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                      : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="text-center py-12 text-gray-500 italic text-sm border border-gray-800 border-dashed rounded-xl">Queue is clear.</div>
              ) : (
                filteredList.map((item) => {
                  const type = item.media_type?.toLowerCase() ?? "";
                  return (
                    <div key={item.media_id} className="flex gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl group relative hover:border-gray-700 transition-colors">
                      {item.media_image ? (
                        <img src={item.media_image} alt={item.media_title ?? "Media"} className="h-20 w-14 rounded-md object-cover self-start" />
                      ) : (
                        <div className="h-20 w-14 rounded-md bg-gray-900 border border-gray-800 self-start" />
                      )}
                      
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="truncate text-sm font-bold text-gray-200">{item.media_title ?? item.media_id}</p>
                          <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">{item.media_type}</p>
                        </div>

                        {/* Inline progress tracking controls! */}
                        <div className="my-2 bg-gray-950/40 p-2 rounded-lg border border-gray-850 flex flex-wrap items-center justify-between gap-2">
                          {(type === "show" || type === "tv") && (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-bold text-gray-400">Ep {item.episodesWatched ?? 0}</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdateProgress(item.media_id, { episodesWatched: Math.max(0, (item.episodesWatched ?? 0) - 1) })}
                                  className="w-6 h-6 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-xs text-white hover:bg-gray-800 font-bold"
                                >
                                  -
                                </button>
                                <button
                                  onClick={() => handleUpdateProgress(item.media_id, { episodesWatched: (item.episodesWatched ?? 0) + 1 })}
                                  className="w-8 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white hover:bg-blue-500 active:scale-95"
                                >
                                  +1
                                </button>
                              </div>
                            </div>
                          )}

                          {type === "manga" && (
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-bold text-gray-400">Ch {item.chaptersRead ?? 0}</span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleUpdateProgress(item.media_id, { chaptersRead: Math.max(0, (item.chaptersRead ?? 0) - 1) })}
                                    className="w-5 h-5 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px] text-white hover:bg-gray-800 font-bold"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={() => handleUpdateProgress(item.media_id, { chaptersRead: (item.chaptersRead ?? 0) + 1 })}
                                    className="w-7 h-5 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white hover:bg-blue-500 active:scale-95"
                                  >
                                    +1
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between w-full border-t border-gray-850 pt-1.5">
                                <span className="text-[10px] font-bold text-gray-400">Vol {item.volumesRead ?? 0}</span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleUpdateProgress(item.media_id, { volumesRead: Math.max(0, (item.volumesRead ?? 0) - 1) })}
                                    className="w-5 h-5 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px] text-white hover:bg-gray-800 font-bold"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={() => handleUpdateProgress(item.media_id, { volumesRead: (item.volumesRead ?? 0) + 1 })}
                                    className="w-7 h-5 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white hover:bg-blue-500 active:scale-95"
                                  >
                                    +1
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {type === "game" && (
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-bold text-gray-400">Hrs {item.hoursPlayed ?? 0}</span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleUpdateProgress(item.media_id, { hoursPlayed: Math.max(0, (item.hoursPlayed ?? 0) - 1) })}
                                    className="w-5 h-5 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px] text-white hover:bg-gray-800 font-bold"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={() => handleUpdateProgress(item.media_id, { hoursPlayed: (item.hoursPlayed ?? 0) + 1 })}
                                    className="w-7 h-5 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white hover:bg-blue-500 active:scale-95"
                                  >
                                    +1
                                  </button>
                                </div>
                              </div>
                              <select
                                value={item.platform || ""}
                                onChange={(e) => handleUpdateProgress(item.media_id, { platform: e.target.value || null })}
                                className="w-full bg-gray-950 text-gray-400 border border-gray-850 rounded px-1 py-0.5 text-[9px] font-bold mt-1 outline-none cursor-pointer"
                              >
                                <option value="">No Platform</option>
                                <option value="PC">PC</option>
                                <option value="PS5">PS5</option>
                                <option value="PS4">PS4</option>
                                <option value="Switch">Switch</option>
                                <option value="Xbox Series X">Xbox Series X</option>
                                <option value="Steam Deck">Steam Deck</option>
                              </select>
                            </div>
                          )}

                          {type === "movie" && (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-bold text-gray-400">Watches {item.watchCount ?? 0}</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdateProgress(item.media_id, { watchCount: Math.max(0, (item.watchCount ?? 0) - 1) })}
                                  className="w-6 h-6 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-xs text-white hover:bg-gray-800 font-bold"
                                >
                                  -
                                </button>
                                <button
                                  onClick={() => handleUpdateProgress(item.media_id, { watchCount: (item.watchCount ?? 0) + 1 })}
                                  className="w-8 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white hover:bg-blue-500 active:scale-95"
                                >
                                  +1
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Status Select and Remove Controls */}
                        <div className="flex items-center justify-between mt-1 gap-2 border-t border-gray-850/50 pt-2">
                          <select
                            value={item.status || "PLANNING"}
                            onChange={(e) => handleUpdateStatus(item.media_id, e.target.value)}
                            className="bg-gray-950 text-gray-400 text-[10px] font-black border border-gray-800 rounded px-1.5 py-0.5 outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="PLANNING">Planning</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="DROPPED">Dropped</option>
                          </select>

                          <button 
                            onClick={() => handleRemove(item.media_id)} 
                            className="text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-400 px-2 py-0.5 border border-rose-950/50 rounded hover:border-rose-500/25 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors focus:outline-none">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      {mounted ? createPortal(drawerOverlay, document.body) : null}
    </>
  );
}
