"use client";

import { useState, useEffect } from "react";
import { MediaItem } from "@/types";

interface RankListSelectModalProps {
  item: MediaItem;
  onClose: () => void;
}

export default function RankListSelectModal({ item, onClose }: RankListSelectModalProps) {
  const [lists, setLists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingListId, setSavingListId] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [isSavingNewList, setIsSavingNewList] = useState(false);
  
  const [step, setStep] = useState<"select" | "place">("select");
  const [activeList, setActiveList] = useState<any | null>(null);
  const [listItems, setListItems] = useState<any[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  useEffect(() => {
    const fetchLists = async () => {
      setIsLoading(true);
      try {
        const typeForApi = item.type.toLowerCase();
        const res = await fetch(`/api/lists?media_type=${typeForApi}`);
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
    fetchLists();
  }, [item.type]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSelectList = async (list: any) => {
    setSavingListId(list.id);
    try {
      const listDetailsRes = await fetch(`/api/lists/${list.id}`);
      if (!listDetailsRes.ok) throw new Error("Could not fetch list details");
      const listData = await listDetailsRes.json();
      
      const existingItems = listData.items || [];
      if (existingItems.some((i: any) => i.mediaId === item.id)) {
        alert("This item is already in that list!");
        setSavingListId(null);
        return;
      }

      setActiveList(listData.list);
      setListItems([
        ...existingItems.map((i: any) => ({ id: i.mediaId, title: i.title, image: i.image })),
        { id: item.id, title: item.title, image: item.image, isNew: true }
      ]);
      setStep("place");
    } catch (err) {
      console.error(err);
      alert("Failed to load list details.");
    } finally {
      setSavingListId(null);
    }
  };

  const handleCreateList = async () => {
    if (!newListTitle.trim()) return;
    setIsSavingNewList(true);
    try {
      const createRes = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newListTitle, media_type: item.type.toLowerCase() }),
      });
      if (!createRes.ok) throw new Error("Could not create list");
      const listData = await createRes.json();
      
      setActiveList(listData.list);
      setListItems([
        { id: item.id, title: item.title, image: item.image, isNew: true }
      ]);
      setStep("place");
      setIsCreatingList(false);
      setNewListTitle("");
    } catch (err) {
      console.error(err);
      alert("Failed to create list.");
    } finally {
      setIsSavingNewList(false);
    }
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const updated = [...listItems];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);
    setListItems(updated);
    setDraggedIndex(null);
  };

  const handleSavePlacement = async () => {
    if (!activeList) return;
    setIsSavingNewList(true);
    try {
      const saveRes = await fetch(`/api/lists/${activeList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: listItems.map(i => ({ id: i.id, title: i.title, image: i.image })) }),
      });
      if (!saveRes.ok) throw new Error("Could not save placement");
      onClose();
    } catch (err) {
       console.error(err);
       alert("Failed to save placement.");
    } finally {
       setIsSavingNewList(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
        >
          ✕
        </button>
        <h2 className="text-2xl font-black mb-1">Add to Custom List</h2>
        <p className="text-sm text-gray-400 mb-6">Select a list to append <span className="text-white font-bold">{item.title}</span>.</p>

        {step === "place" && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-white text-lg">Place in: {activeList?.title}</h3>
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Drag to reorder</span>
            </div>
            
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 [scrollbar-width:thin]">
              {listItems.map((listItem, index) => (
                <div
                  key={listItem.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    listItem.isNew 
                      ? 'border-blue-500 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                      : 'border-gray-800 bg-gray-950'
                  } cursor-grab active:cursor-grabbing transition-all`}
                >
                  <span className={`font-black w-6 text-center ${listItem.isNew ? 'text-blue-400' : 'text-gray-500'}`}>{index + 1}</span>
                  {listItem.image ? (
                    <img src={listItem.image} alt={listItem.title} className="w-8 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-8 h-12 bg-gray-800 rounded"></div>
                  )}
                  <span className={`font-bold truncate flex-1 ${listItem.isNew ? 'text-blue-100' : 'text-gray-300'}`}>
                    {listItem.title}
                  </span>
                  <svg className="w-5 h-5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-800/50 mt-4">
              <button 
                onClick={() => setStep("select")}
                className="flex-1 p-3 rounded-xl border border-gray-800 font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              >
                Back
              </button>
              <button 
                onClick={handleSavePlacement}
                disabled={isSavingNewList}
                className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black transition-all shadow-lg shadow-blue-900/50"
              >
                {isSavingNewList ? "Saving..." : "Save Placement"}
              </button>
            </div>
          </div>
        )}

        {step === "select" && (
          isLoading ? (
            <div className="py-8 text-center text-gray-500 font-bold">Loading your lists...</div>
          ) : isCreatingList ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">List Title</label>
                <input
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  autoFocus
                  placeholder="e.g. Masterpieces"
                  className="w-full bg-gray-950 border border-gray-800 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsCreatingList(false)}
                  disabled={isSavingNewList}
                  className="flex-1 p-3 rounded-xl border border-gray-800 font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateList}
                  disabled={isSavingNewList || !newListTitle.trim()}
                  className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black transition-all"
                >
                  {isSavingNewList ? "Creating..." : "Create List"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
              <button 
                onClick={() => setIsCreatingList(true)}
                className="w-full p-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-blue-500 hover:bg-blue-900/10 text-gray-400 hover:text-blue-400 font-black tracking-wide transition-all"
              >
                + Create New List
              </button>
              
              {lists.length === 0 ? (
                <div className="py-8 text-center text-gray-500 italic">
                  You don't have any {item.type} lists yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 [scrollbar-width:thin]">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleSelectList(list)}
                      disabled={!!savingListId}
                      className="w-full text-left p-4 rounded-xl border border-gray-800 bg-gray-950/50 hover:border-blue-500 hover:bg-gray-800 transition-all group disabled:opacity-50 flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-bold text-gray-200 group-hover:text-white truncate">{list.title}</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{(list._count?.items || 0)} Items</p>
                      </div>
                      {savingListId === list.id && (
                        <span className="text-blue-500 text-xs font-bold animate-pulse">Loading...</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
