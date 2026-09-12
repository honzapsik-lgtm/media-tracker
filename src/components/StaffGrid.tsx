'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export interface Credit {
  id: string | number;
  name: string;
  image: string | null;
  role: string;
  isCompany?: boolean;
}

interface StaffGridProps {
  primaryStaff: Credit[];
  secondaryStaff: Credit[];
}

const ROLE_PRIORITY_ORDER = [
  'DIRECTOR',
  'ORIGINAL CREATOR',
  'CREATOR',
  'SERIES COMPOSITION',
  'HEAD WRITER',
  'COMPOSER',
  'MUSIC',
  'WRITER',
  'SCREENPLAY',
  'AUTHOR',
  'STORY & ART',
  'MANGAKA',
  'DEVELOPER',
  'ORIGINAL STORY',
  'CHARACTER DESIGN',
  'ARTIST',
  'ART DIRECTION',
  'CINEMATOGRAPHER',
  'EXECUTIVE PRODUCER',
  'PRODUCER',
  'ANIMATION DIRECTOR',
  'SUPERVISING ANIMATION DIRECTOR',
  'EDITOR',
  'SOUND DIRECTOR',
];

function getRoleRank(role: string): number {
  const upper = role.toUpperCase().trim();
  const directIdx = ROLE_PRIORITY_ORDER.indexOf(upper);
  if (directIdx !== -1) return directIdx;

  if (upper.includes('DIRECTOR')) return 0.5;
  if (upper.includes('CREATOR')) return 1.5;
  if (upper.includes('SERIES COMPOSITION') || upper.includes('HEAD WRITER')) return 3.5;
  if (upper.includes('COMPOSER') || upper.includes('MUSIC')) return 4.5;
  if (upper.includes('WRITER') || upper.includes('SCREENPLAY')) return 5.5;
  if (upper.includes('AUTHOR') || upper.includes('MANGAKA')) return 6.5;
  if (upper.includes('CHARACTER DESIGN')) return 7.5;
  if (upper.includes('PRODUCER')) return 10.5;

  return 999;
}

function sortByImage(list: Credit[]): Credit[] {
  return [...list].sort((a, b) => {
    const aImg = a.image ? 1 : 0;
    const bImg = b.image ? 1 : 0;
    return bImg - aImg;
  });
}

export function StaffGrid({ primaryStaff, secondaryStaff }: StaffGridProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const toggleRole = (role: string) => {
    setExpandedRoles(prev => ({ ...prev, [role]: !prev[role] }));
  };

  // Group PRIMARY credits by role for inline display
  const primaryGrouped: Record<string, Credit[]> = {};
  for (const credit of primaryStaff) {
    const roleKey = credit.role.toUpperCase();
    if (!primaryGrouped[roleKey]) {
      primaryGrouped[roleKey] = [];
    }
    if (!primaryGrouped[roleKey].some(c => String(c.id) === String(credit.id))) {
      primaryGrouped[roleKey].push(credit);
    }
  }

  for (const role of Object.keys(primaryGrouped)) {
    primaryGrouped[role] = sortByImage(primaryGrouped[role]);
  }

  // Sort primary roles by priority
  const sortedPrimaryRoleKeys = Object.keys(primaryGrouped).sort((a, b) => {
    const rankA = getRoleRank(a);
    const rankB = getRoleRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });

  // Prepare inline display roles with cross-role deduplication and max 4 roles (single row guarantee)
  const inlineRoles: { role: string; credits: Credit[] }[] = [];
  const displayedPersonIds = new Set<string>();

  for (const role of sortedPrimaryRoleKeys) {
    if (inlineRoles.length >= 4) break;

    const list = primaryGrouped[role];
    if (!list || list.length === 0) continue;

    // Filter to find people who haven't been displayed in an earlier role yet
    const unshownCredits = list.filter(c => !displayedPersonIds.has(String(c.id)));

    // If ALL people in this role have already been displayed in previous roles,
    // skip this redundant role (e.g. AUTHOR or WRITER repeating Benioff & Weiss / Martin),
    // unless we have fewer than 2 roles total so far (e.g. solo movie where Director is also Writer).
    if (unshownCredits.length === 0) {
      if (inlineRoles.length < 2 && role === 'WRITER') {
        const selected = list.slice(0, 2);
        for (const c of selected) displayedPersonIds.add(String(c.id));
        inlineRoles.push({ role, credits: selected });
      }
      continue;
    }

    const selectedCredits = unshownCredits.slice(0, 2);
    for (const c of selectedCredits) {
      displayedPersonIds.add(String(c.id));
    }

    inlineRoles.push({
      role,
      credits: selectedCredits,
    });
  }

  // Combine ALL credits for the modal
  const allStaff = [...primaryStaff, ...secondaryStaff];
  const allGrouped: Record<string, Credit[]> = {};
  for (const credit of allStaff) {
    const roleKey = credit.role.toUpperCase();
    if (!allGrouped[roleKey]) {
      allGrouped[roleKey] = [];
    }
    if (!allGrouped[roleKey].some(c => String(c.id) === String(credit.id))) {
      allGrouped[roleKey].push(credit);
    }
  }

  for (const role of Object.keys(allGrouped)) {
    allGrouped[role] = sortByImage(allGrouped[role]);
  }

  const allRoles = Object.keys(allGrouped).sort((a, b) => {
    const rankA = getRoleRank(a);
    const rankB = getRoleRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });

  return (
    <div className="py-5 border-y border-gray-800/60 mb-6 mt-4">
      <div className="flex flex-nowrap overflow-x-auto gap-x-8 lg:gap-x-10 items-start">
        {inlineRoles.map(({ role, credits: displayCredits }) => (
          <div key={role} className="flex flex-col shrink-0 min-w-fit">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">{role}</span>
            <div className="flex flex-col gap-2">
              {displayCredits.map(credit => (
                <Link key={credit.id} href={credit.isCompany ? `/company/${credit.id}` : `/person/${credit.id}`} className="flex items-center gap-2 group">
                  {credit.image ? (
                    <img src={credit.image} alt={credit.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                      {credit.name[0]}
                    </div>
                  )}
                  <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors whitespace-nowrap">
                    {credit.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(primaryStaff.length > 0 || secondaryStaff.length > 0) && (
        <button 
          onClick={() => {
            setExpandedRoles({});
            setIsModalOpen(true);
          }}
          className="mt-6 text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest cursor-pointer"
        >
          + View Full Crew
        </button>
      )}

      {/* STAFF MODAL PORTAL */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center p-6 border-b border-gray-800/60 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-white tracking-widest uppercase">Full Crew</h2>
                <span className="text-xs text-gray-500 font-bold bg-gray-900 border border-gray-800 px-2.5 py-0.5 rounded-full">
                  {allRoles.length} Departments
                </span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-900 cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                {allRoles.map(role => {
                  const roleCredits = allGrouped[role];
                  const isExpanded = !!expandedRoles[role];
                  const visibleCredits = isExpanded ? roleCredits : roleCredits.slice(0, 3);
                  const hasMore = roleCredits.length > 3;
                  const remaining = roleCredits.length - 3;

                  return (
                    <div key={role} className="flex flex-col">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                          {role}
                        </span>
                        <span className="text-[10px] text-gray-600 font-bold">
                          {roleCredits.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {visibleCredits.map(credit => (
                          <Link 
                            key={`${credit.id}-${credit.role}-${credit.name}`} 
                            href={credit.isCompany ? `/company/${credit.id}` : `/person/${credit.id}`} 
                            className="flex items-center gap-3 group"
                          >
                            {credit.image ? (
                              <img src={credit.image} alt={credit.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                {credit.name[0]}
                              </div>
                            )}
                            <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors truncate">
                              {credit.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => toggleRole(role)}
                          className="mt-3 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider text-left flex items-center gap-1 cursor-pointer w-fit"
                        >
                          {isExpanded ? (
                            <span>− Show less</span>
                          ) : (
                            <span>+ Show {remaining} more</span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
