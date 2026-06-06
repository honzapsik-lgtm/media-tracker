"use client";

import { useState, useEffect } from "react";
import MediaCardProfileHorizontal from "@/components/MediaCardProfileHorizontal";
import CreateListModal from "@/components/CreateListModal";
import LiveSearchModal from "@/components/LiveSearchModal";

export default function CustomListsManager() {
  const categories = ["game", "movie", "show", "season", "episode", "manga"];
  
  const [activeTabType, setActiveTabType] = useState<string>("show");
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid");
  
  const [lists, setLists] = useState<any[]>([]);
  const [activeList, setActiveList] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnsaved, setIsUnsaved] = useState(false);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fetch lists for grid view
  useEffect(() => {
    if (viewMode === "grid") {
      fetchLists(activeTabType);
    }
  }, [activeTabType, viewMode]);

  const fetchLists = async (mediaType: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lists?media_type=${mediaType}`);
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (err) {
      console.error("Failed to fetch lists", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchListDetails = async (listId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveList(data.list);
        setItems(data.items || []);
        setIsUnsaved(false);
        setViewMode("detail");
      }
    } catch (err) {
      console.error("Failed to fetch list details", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabSwitch = (type: string) => {
    setActiveTabType(type);
    setViewMode("grid");
    setActiveList(null);
  };

  // Drag and Drop Logic
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...items];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setItems(updated);
    setDraggedIndex(null);
    setIsUnsaved(true);
  };

  const handleSaveListOrder = async () => {
    if (!activeList) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/lists/${activeList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaIds: items.map((item) => ({
            id: item.mediaId,
            title: item.title,
            image: item.image,
          })),
        }),
      });

      if (!res.ok) throw new Error("Could not save list.");
      setIsUnsaved(false);
    } catch (err) {
      console.error("Error saving list:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = async (item: any) => {
    setIsSearchModalOpen(false);
    if (!activeList) return;

    // Check if item already in list
    if (items.some((i) => i.mediaId === item.id)) {
      alert("This item is already in the list!");
      return;
    }

    const newItem = {
      mediaId: item.id,
      score: 0,
      reviewText: null,
      title: item.title,
      image: item.image,
      type: item.type,
      rankPosition: items.length + 1,
      releaseDate: item.releaseDate,
    };

    const newItems = [...items, newItem];
    setItems(newItems);
    
    // Save immediately
    try {
      await fetch(`/api/lists/${activeList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaIds: newItems.map((i) => ({
            id: i.mediaId,
            title: i.title,
            image: i.image,
          })),
        }),
      });
      // Optionally re-fetch
    } catch (err) {
      console.error("Failed to save new item", err);
    }
  };

  const handleEditList = async (e: React.MouseEvent, list: any) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const newTitle = prompt("Edit list title:", list.title);
    if (!newTitle || !newTitle.trim() || newTitle === list.title) return;
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setLists(lists.map(l => l.id === list.id ? { ...l, title: newTitle.trim() } : l));
        if (activeList?.id === list.id) setActiveList({ ...activeList, title: newTitle.trim() });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteList = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!confirm("Are you sure you want to delete this list?")) return;
    try {
      const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLists(lists.filter(l => l.id !== id));
        if (activeList?.id === id) setViewMode("grid");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-800 gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((type) => (
          <button
            key={type}
            onClick={() => handleTabSwitch(type)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-all border-b-2 -mb-[9px] shrink-0 ${
              activeTabType === type && viewMode === "grid"
                ? "border-blue-500 text-blue-400 font-black"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {type}s
          </button>
        ))}
      </div>

      {viewMode === "grid" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <div>
              <h2 className="text-xl font-black capitalize text-white">Your {activeTabType} Lists</h2>
              <p className="text-gray-400 text-sm">Create and manage your custom ranking lists.</p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create a New List
            </button>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            {lists.length === 0 && !isLoading ? (
              <div className="col-span-full py-12 text-center text-gray-500 italic border border-dashed border-gray-800 rounded-2xl">
                No {activeTabType} lists created yet.
              </div>
            ) : (
              lists.map((list) => (
                <div
                  key={list.id}
                  onClick={() => fetchListDetails(list.id)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 hover:bg-gray-800 transition-all cursor-pointer group shadow-lg flex flex-col h-32 relative"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-black text-white group-hover:text-blue-400 mb-2 truncate pr-6">{list.title}</h3>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === list.id ? null : list.id);
                        }}
                        className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors -mt-1 -mr-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      {openMenuId === list.id && (
                        <div className="absolute top-8 right-0 bg-gray-950 border border-gray-800 rounded-lg shadow-2xl z-20 w-32 overflow-hidden">
                          <button 
                            onClick={(e) => handleEditList(e, list)}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                          >
                            Edit Name
                          </button>
                          <button 
                            onClick={(e) => handleDeleteList(e, list.id)}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border-t border-gray-800"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1"></div>
                  
                  <div className="flex justify-between items-end pt-4 border-t border-gray-800/50">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{list._count?.items || 0} Items</span>
                    <span className="text-blue-500 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">View List →</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode("grid")}
                className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-black text-white">{activeList?.title}</h2>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
              <button
                onClick={handleSaveListOrder}
                disabled={isSaving || !isUnsaved}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors disabled:bg-gray-800 disabled:text-gray-500 text-sm flex items-center gap-2"
              >
                {isSaving ? "Saving..." : "Save Order"}
                {isUnsaved && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
              </button>
            </div>
          </div>

          <div className={`space-y-2 transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            {items.map((item, index) => (
              <MediaCardProfileHorizontal
                key={item.mediaId}
                item={item}
                viewContext="lists"
                draggable={true}
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                visualRank={index + 1}
              />
            ))}

            {items.length === 0 && !isLoading && (
              <div className="text-center py-16 px-4 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
                <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">This list is empty</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">Click the "Add Item" button above to search and add your favorite {activeTabType}s to this list.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <CreateListModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        mediaType={activeTabType}
        onSuccess={() => fetchLists(activeTabType)}
      />

      <LiveSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        mediaType={activeTabType}
        onSelect={handleAddItem}
      />
    </div>
  );
}
