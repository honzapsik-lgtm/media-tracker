'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface Credit {
  id: number;
  name: string;
  image: string | null;
  role: string;
}

interface StaffGridProps {
  primaryStaff: Credit[];
  secondaryStaff: Credit[];
}

export function StaffGrid({ primaryStaff, secondaryStaff }: StaffGridProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Group PRIMARY credits by role for inline display
  const primaryGrouped: Record<string, Credit[]> = {};
  for (const credit of primaryStaff) {
    const roleKey = credit.role.toUpperCase();
    if (!primaryGrouped[roleKey]) {
      primaryGrouped[roleKey] = [];
    }
    primaryGrouped[roleKey].push(credit);
  }
  const primaryRoles = Array.from(new Set(primaryStaff.map(c => c.role.toUpperCase())));

  // Combine ALL credits for the modal
  const allStaff = [...primaryStaff, ...secondaryStaff];
  const allGrouped: Record<string, Credit[]> = {};
  for (const credit of allStaff) {
    const roleKey = credit.role.toUpperCase();
    if (!allGrouped[roleKey]) {
      allGrouped[roleKey] = [];
    }
    allGrouped[roleKey].push(credit);
  }
  const allRoles = Array.from(new Set(allStaff.map(c => c.role.toUpperCase())));

  return (
    <div className="py-5 border-y border-gray-800/60 mb-6 mt-4">
      <div className="flex flex-wrap gap-x-10 gap-y-6">
        {primaryRoles.map(role => {
          // Slice down to 2 people per role for inline view
          const displayCredits = primaryGrouped[role].slice(0, 2);
          
          return (
            <div key={role} className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">{role}</span>
              <div className="flex flex-col gap-2">
                {displayCredits.map(credit => (
                  <Link key={credit.id} href={`/person/${credit.id}`} className="flex items-center gap-2 group">
                    {credit.image ? (
                      <img src={credit.image} alt={credit.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500">{credit.name[0]}</div>
                    )}
                    <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{credit.name}</span>
                  </Link>
                ))}
                {primaryGrouped[role].length > 2 && (
                  <span className="text-xs text-gray-500 font-medium ml-8">+{primaryGrouped[role].length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(primaryStaff.length > 0 || secondaryStaff.length > 0) && (
        <button 
          onClick={() => setIsModalOpen(true)}
          className="mt-6 text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest"
        >
          + View Full Crew
        </button>
      )}

      {/* STAFF MODAL PORTAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center p-6 border-b border-gray-800/60 shrink-0">
              <h2 className="text-xl font-black text-white tracking-widest uppercase">Full Crew</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {allRoles.map(role => (
                  <div key={role} className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">{role}</span>
                    <div className="flex flex-col gap-3">
                      {allGrouped[role].map(credit => (
                        <Link key={`${credit.id}-${credit.role}`} href={`/person/${credit.id}`} className="flex items-center gap-3 group">
                          {credit.image ? (
                            <img src={credit.image} alt={credit.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500">{credit.name[0]}</div>
                          )}
                          <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{credit.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
