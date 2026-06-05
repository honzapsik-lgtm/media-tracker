import Link from "next/link";
import { MediaItem } from "@/types";

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 95) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"; 
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 25) return "text-gray-400";
  return "text-gray-700"; 
};

interface MediaCardHorizontalProps {
  item: MediaItem;
  rankPosition?: number;
  showTotalRatings?: boolean;
}

export default function MediaCardHorizontal({ item, rankPosition, showTotalRatings }: MediaCardHorizontalProps) {
  return (
    <Link href={`/media/${item.id}`} className="flex items-center gap-4 bg-gray-900 border border-gray-800 p-3 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group">
      {/* Optional Left Position Number (for Rankings) */}
      {rankPosition !== undefined && (
        <div className="w-12 shrink-0 text-center font-black text-2xl text-gray-600 group-hover:text-blue-500 transition-colors">
          #{rankPosition}
        </div>
      )}
      
      {/* Thumbnail */}
      <div className="shrink-0">
        {item.image ? (
          <img src={item.image} className="w-12 h-16 object-cover rounded-md shadow-md" alt={item.title || "Cover"} />
        ) : (
          <div className="w-12 h-16 bg-gray-950 border border-gray-800 rounded-md flex items-center justify-center text-[9px] font-bold text-gray-600 text-center">NO IMG</div>
        )}
      </div>

      {/* Middle Info */}
      <div className="flex-1 min-w-0">
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
      </div>

      {/* Far Right Stats */}
      <div className="flex items-center gap-6 pr-4 shrink-0">
        {showTotalRatings ? (
          <div className="text-right hidden sm:block">
            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Ratings</p>
            <p className="font-black text-base text-blue-400">{item.totalRatings || 0}</p>
          </div>
        ) : (
          <div className="text-right hidden sm:block">
            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">List Rank</p>
            <p className={`font-black text-base ${item.listRank ? 'text-white' : 'text-gray-600'}`}>
              {item.listRank ? `#${item.listRank}` : '-'}
            </p>
          </div>
        )}
        <div className="w-px h-8 bg-gray-800 hidden sm:block"></div>
        <div className="text-right">
          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Score</p>
          <p className={`font-black text-base ${getScoreColor(item.communityScore)}`}>
            {item.communityScore ? `${item.communityScore}%` : 'N/A'}
          </p>
        </div>
      </div>
    </Link>
  );
}
