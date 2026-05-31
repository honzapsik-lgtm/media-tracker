"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

type ListCategory = "watch" | "play" | "read";

export default function AppDrawer() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [activeView, setActiveView] = useState<"menu" | "list">("menu");
  const [activeCategory, setActiveCategory] = useState<ListCategory>("watch");
  
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("plan_to_watch");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || activeView !== "list" || !session) return;
    
    const fetchWatchlist = async () => {
      setIsLoading(true);
      // TODO: Replace with Prisma API fetch
      // const res = await fetch('/api/watchlist');
      // const data = await res.json();
      // setWatchlist(data);
      setIsLoading(false);
    };

    fetchWatchlist();
  }, [isOpen, activeView, session]);

  const handleRemove = async (mediaId: string) => {
    // TODO: Connect to Prisma
  };

  const handleUpdateStatus = async (mediaId: string, newStatus: string) => {
    // TODO: Connect to Prisma
  };

  const filteredList = watchlist.filter(item => {
    const matchesStatus = item.status === activeTab;
    const type = item.media_type.toLowerCase();
    
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
    setActiveTab("plan_to_watch");
    setActiveView("list");
  };

  const categoryConfig = {
    watch: { title: "My Watchlist", action: "Plan to Watch" },
    play: { title: "Game Backlog", action: "Plan to Play" },
    read: { title: "My Readlist", action: "Plan to Read" }
  };

  const drawerOverlay = (
    <div className="relative z-[100]">
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      )}

      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-gray-950 border-l border-gray-800 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
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
                  <div className="w-10 h-10 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center justify-center text-green-400">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <span className="font-bold text-gray-200 group-hover:text-white">Game Backlog</span>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <button onClick={() => openList("read")} className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-900/30 border border-purple-500/50 rounded-lg flex items-center justify-center text-purple-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <span className="font-bold text-gray-200 group-hover:text-white">Readlist</span>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* LOGOUT BUTTON PINNED TO BOTTOM */}
            {session && (
              <div className="p-4 border-t border-gray-800 bg-gray-900/30">
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

        {/* VIEW 2: THE ISOLATED LIST (Unchanged structurally) */}
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

            <div className="flex border-b border-gray-800 shrink-0">
              <button onClick={() => setActiveTab("plan_to_watch")} className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${activeTab === "plan_to_watch" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
                {categoryConfig[activeCategory].action} 
              </button>
              <button onClick={() => setActiveTab("dropped")} className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${activeTab === "dropped" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
                Dropped 
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="text-center py-12 text-gray-500 italic text-sm border border-gray-800 border-dashed rounded-xl">Queue is clear.</div>
              ) : (
                filteredList.map((item) => (
                  <div key={item.media_id} className="flex gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl group relative hover:border-gray-700 transition-colors">
                    {/* Items map logic remains identical */}
                  </div>
                ))
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
      {mounted && createPortal(drawerOverlay, document.body)}
    </>
  );
}