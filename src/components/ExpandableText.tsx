"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
}

export default function ExpandableText({ text, maxLength = 250 }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return <p className="text-gray-400 italic">No description available.</p>;

  // Check if the text is actually long enough to need hiding
  const isLong = text.length > maxLength;
  
  // Cut the string off cleanly if it's not expanded
  const displayText = isExpanded || !isLong ? text : `${text.slice(0, maxLength).trim()}...`;

  return (
    <div className="mb-10 max-w-3xl">
      <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-wrap">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:text-blue-300 font-semibold mt-2 transition-colors text-sm uppercase tracking-wider"
        >
          {isExpanded ? "Show Less ↑" : "Read More ↓"}
        </button>
      )}
    </div>
  );
}