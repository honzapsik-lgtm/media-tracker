"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

export default function ExpandableAniListCast({ castData }: { castData: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [language, setLanguage] = useState("Japanese");

  const availableLanguages = useMemo(() => {
    if (!castData) return [];
    const edges = Array.isArray(castData) ? castData : castData.edges;
    if (!edges || !Array.isArray(edges)) return [];
    const langs = new Set<string>();
    edges.forEach((edge: any) => {
      edge.voiceActors?.forEach((va: any) => {
        if (va.languageV2) langs.add(va.languageV2);
      });
    });
    return Array.from(langs).sort();
  }, [castData]);

  useEffect(() => {
    if (availableLanguages.length > 0 && !availableLanguages.includes(language)) {
      setLanguage(availableLanguages.includes("Japanese") ? "Japanese" : availableLanguages[0]);
    }
  }, [availableLanguages, language]);

  if (!castData) return null;
  const edges = Array.isArray(castData) ? castData : castData.edges;
  if (!edges || !Array.isArray(edges) || edges.length === 0) return null;

  const mainCharacters = edges.filter((e: any) => e.role === 'MAIN');
  const supportingCharacters = edges.filter((e: any) => e.role !== 'MAIN');
  
  const defaultVisibleCount = Math.max(6, mainCharacters.length);
  const sortedCast = [...mainCharacters, ...supportingCharacters];
  const visibleCast = isExpanded ? sortedCast : sortedCast.slice(0, defaultVisibleCount);

  return (
    <div className="lg:col-span-2">
      <div className="flex justify-between items-end mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Cast</h2>
          {availableLanguages.length > 0 && (
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-2.5 py-1"
            >
              {availableLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          )}
        </div>
        {sortedCast.length > defaultVisibleCount && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-900/50"
          >
            {isExpanded ? "Show Less" : `View All ${sortedCast.length}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleCast.map((edge: any) => {
          const char = edge.node;
          const va = edge.voiceActors?.find((v: any) => v.languageV2 === language);
          
          return (
            <div key={char.id} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group">
              {/* Character Side */}
              <Link href={`#`} className="flex items-center gap-3 flex-1 min-w-0">
                {char.image?.large ? (
                  <img src={char.image.large} alt={char.name?.full} className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500">N/A</div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">{char.name?.full}</p>
                  <p className="text-xs text-gray-500 truncate uppercase tracking-wider">{edge.role}</p>
                </div>
              </Link>
              
              {/* Voice Actor Side */}
              <Link href={va ? `/person/anilist-staff-${va.id}` : '#'} className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-200 truncate hover:text-blue-400 transition-colors">{va ? va.name?.full : 'N/A'}</p>
                  <p className="text-xs text-gray-500 truncate">{language}</p>
                </div>
                {va?.image?.large ? (
                  <img src={va.image.large} alt={va.name?.full} className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500">N/A</div>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
