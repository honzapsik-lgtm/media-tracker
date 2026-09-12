"use client";

import { useState } from "react";

export default function AnimeThemes({ themeData: rawThemeData }: { themeData: any }) {
  const [showAllOpenings, setShowAllOpenings] = useState(false);
  const [showAllEndings, setShowAllEndings] = useState(false);

  if (!rawThemeData) {
    return null;
  }

  let themeData = rawThemeData;
  if (typeof rawThemeData === 'string') {
    try {
      themeData = JSON.parse(rawThemeData);
    } catch {
      return null;
    }
  }

  const groups: any[] = Array.isArray(themeData?.groups) ? themeData.groups : [];
  const hasMultipleGroups = groups.length > 1;

  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]?.seasonName || "");
  const activeGroup = groups.find(g => g.seasonName === selectedGroup) || groups[0] || null;

  const openings = activeGroup ? activeGroup.openings : (themeData?.openings || []);
  const endings = activeGroup ? activeGroup.endings : (themeData?.endings || []);

  const hasOpenings = openings?.length > 0;
  const hasEndings = endings?.length > 0;

  if (!hasOpenings && !hasEndings) {
    return null;
  }

  const visibleOpenings = showAllOpenings ? openings : openings.slice(0, 5);
  const visibleEndings = showAllEndings ? endings : endings.slice(0, 5);

  const renderThemes = (themes: string[]) => (
    <ul className="space-y-2 text-sm text-gray-300">
      {themes.map((theme: string, idx: number) => (
        <li
          key={idx}
          className="bg-gray-900/80 px-3 py-2 rounded-xl border border-gray-800/80 hover:border-gray-700 transition-colors"
        >
          <span
            className="block overflow-hidden leading-snug break-words text-xs font-semibold text-gray-200"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
            }}
          >
            {theme}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-4 bg-gray-950/50 rounded-2xl p-5 border border-gray-800 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Anime Themes</h3>
          {(hasOpenings || hasEndings) && (
            <span className="text-[10px] text-gray-500 font-bold bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-full">
              {(openings?.length || 0) + (endings?.length || 0)}
            </span>
          )}
        </div>
      </div>

      {hasMultipleGroups && (
        <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-gray-800/80 max-h-36 overflow-y-auto pr-1">
          {groups.map((g) => {
            const isSelected = activeGroup?.seasonName === g.seasonName;
            return (
              <button
                key={g.seasonName}
                type="button"
                onClick={() => {
                  setSelectedGroup(g.seasonName);
                  setShowAllOpenings(false);
                  setShowAllEndings(false);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                    : "bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800/60"
                }`}
              >
                {g.seasonName}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {hasOpenings && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Openings</h4>
              <span className="text-[10px] text-gray-500 font-bold">{openings.length} Songs</span>
            </div>
            {renderThemes(visibleOpenings)}
            {openings.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllOpenings(!showAllOpenings)}
                className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider cursor-pointer"
              >
                {showAllOpenings ? 'Show Less' : `+ Show All (${openings.length})`}
              </button>
            )}
          </div>
        )}
        {hasEndings && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Endings</h4>
              <span className="text-[10px] text-gray-500 font-bold">{endings.length} Songs</span>
            </div>
            {renderThemes(visibleEndings)}
            {endings.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllEndings(!showAllEndings)}
                className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider cursor-pointer"
              >
                {showAllEndings ? 'Show Less' : `+ Show All (${endings.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

