import Link from "next/link";
import { useState } from "react";
import { ProfileMediaItem } from "@/lib/media-db";
import RankListSelectModal from "@/components/RankListSelectModal";
import GlobalRatingModal from "@/components/GlobalRatingModal";

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; 
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; 
};

interface MediaCardProfileHorizontalProps {
  item: ProfileMediaItem;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  visualRank?: number; // the visual rank on the page
  viewContext?: "ratings" | "lists";
}

export default function MediaCardProfileHorizontal({ 
  item, draggable, onDragStart, onDragOver, onDrop, visualRank, viewContext 
}: MediaCardProfileHorizontalProps) {
  
  const [showListModal, setShowListModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const hasCriteria = item.criteriaScores && Object.keys(item.criteriaScores).length > 0;
  
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex items-center gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group ${draggable ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
    >
      {/* Optional Left Position Number (for Rankings) */}
      {visualRank !== undefined && (
        <div className="w-10 shrink-0 text-center font-black text-2xl text-gray-600 group-hover:text-blue-500 transition-colors">
          #{visualRank}
        </div>
      )}
      
      {/* Thumbnail */}
      <Link href={`/media/${item.mediaId}`} className="shrink-0 block">
        {item.image ? (
          <img src={item.image} className="w-12 h-16 object-cover rounded-md shadow-md" alt={item.title || "Cover"} />
        ) : (
          <div className="w-12 h-16 bg-gray-950 border border-gray-800 rounded-md flex items-center justify-center text-[9px] font-bold text-gray-600 text-center">NO IMG</div>
        )}
      </Link>

      {/* Middle Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/media/${item.mediaId}`} className="block">
          <p className="text-lg font-bold text-gray-200 truncate group-hover:text-white">
            {item.title || "Unknown Title"}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-950 text-gray-500 border border-gray-800/60 leading-none flex items-center">
              {item.type}
            </span>
            <span className="text-gray-500 text-xs font-medium leading-none flex items-center">
              {item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'}
            </span>
          </div>
        </Link>
      </div>

      {/* Far Right Stats */}
      <div className="flex flex-wrap items-center justify-end gap-6 pr-2 shrink-0">
        
        {/* Action Button to the left of criteria */}
        {item.inUserList === false && viewContext === "ratings" && (
          <div className="flex items-center justify-center border-r border-gray-800 pr-4">
            <button 
              onClick={() => setShowListModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-1.5 px-3 rounded shadow-lg transition-colors"
            >
              + List
            </button>
          </div>
        )}

        {(item.hasRated === false || item.score === 0 || item.score === null) && viewContext === "lists" && (
          <div className="flex items-center justify-center border-r border-gray-800 pr-4">
            <button 
              onClick={() => setShowRatingModal(true)}
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-black text-xs py-1.5 px-3 rounded shadow-lg transition-colors"
            >
              Rate
            </button>
          </div>
        )}

        {/* Criteria breakdown if available */}
        {hasCriteria && (
          <div className="hidden lg:flex items-center gap-4 pr-4 border-r border-gray-800">
            {Object.entries(item.criteriaScores).map(([key, val]: [string, any]) => (
              <div key={key} className="text-center">
                <p className="text-[8px] text-gray-500 uppercase font-bold tracking-wider mb-0.5 max-w-[60px] truncate" title={key}>{key}</p>
                <p className={`font-black text-sm ${getScoreColor(val)}`}>{val}%</p>
              </div>
            ))}
          </div>
        )}

        {/* Right Stats Block: Always My Score */}
        <div className="text-right w-16">
          <p className="text-[9px] text-blue-500 uppercase font-bold tracking-widest mb-1">My Score</p>
          <p className={`font-black text-base ${getScoreColor(item.score)}`}>
            {item.score}%
          </p>
        </div>
      </div>

      {showListModal && (
        <RankListSelectModal
          item={{
            id: item.mediaId,
            type: item.type,
            title: item.title,
            image: item.image,
            releaseDate: item.releaseDate ?? null,
            communityScore: 0,
            listRank: null,
          }}
          onClose={() => setShowListModal(false)}
        />
      )}

      {showRatingModal && (
        <GlobalRatingModal
          item={{
            id: item.mediaId,
            type: item.type,
            title: item.title,
            image: item.image,
            releaseDate: item.releaseDate ?? null,
            communityScore: 0,
            listRank: null,
          }}
          onClose={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}
