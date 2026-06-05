import Link from "next/link";
import { ProfileMediaItem } from "@/lib/media-db";

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
}

export default function MediaCardProfileHorizontal({ 
  item, draggable, onDragStart, onDragOver, onDrop, visualRank 
}: MediaCardProfileHorizontalProps) {
  
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
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-950 text-gray-500 border border-gray-800/60 inline-block">
              {item.type}
            </span>
            <span className="text-gray-500 text-xs font-medium">
              {item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'}
            </span>
          </div>
        </Link>
      </div>

      {/* Far Right Stats */}
      <div className="flex flex-wrap items-center justify-end gap-6 pr-2 shrink-0">
        
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

        <div className="text-right hidden sm:block">
          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">List Rank</p>
          <p className={`font-black text-base ${item.rankPosition ? 'text-white' : 'text-gray-600'}`}>
            {item.rankPosition ? `#${item.rankPosition}` : '-'}
          </p>
        </div>
        
        <div className="w-px h-8 bg-gray-800 hidden sm:block"></div>
        
        <div className="text-right w-16">
          <p className="text-[9px] text-blue-500 uppercase font-bold tracking-widest mb-1">My Score</p>
          <p className={`font-black text-base ${getScoreColor(item.score)}`}>
            {item.score}%
          </p>
        </div>
      </div>
    </div>
  );
}
