import Link from "next/link";
import { MediaItem } from "@/types";
import MediaActionMenu from "./MediaActionMenu";

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "bg-gray-900/80 text-gray-500 border-gray-700";
  if (score >= 95) return "bg-yellow-900/80 text-yellow-400 border-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.4)]"; 
  if (score >= 75) return "bg-green-900/80 text-green-400 border-green-500";
  if (score >= 50) return "bg-blue-900/80 text-blue-400 border-blue-500";
  if (score >= 25) return "bg-gray-800 text-gray-400 border-gray-600";
  return "bg-gray-900/80 text-gray-500 border-gray-700"; 
};

export default function MediaCardVertical({ item }: { item: MediaItem }) {
  return (
    <Link 
      href={`/media/${item.id}`} 
      className="block hover:scale-105 transition-transform duration-300 relative group h-full"
    >
      <div className="bg-gray-900 rounded-xl shadow-lg h-full border border-gray-800 relative flex flex-col">
        {/* Top Left: Community Score Badge */}
        <div className={`absolute top-2 left-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border backdrop-blur-md transition-colors ${getScoreColor(item.communityScore)}`}>
          ★ {item.communityScore ? `${item.communityScore}%` : 'N/A'}
        </div>

        {/* Top Right: List Rank Badge */}
        <div className={`absolute top-2 right-2 z-10 px-2 py-1 text-xs font-black rounded shadow-lg border backdrop-blur-md transition-colors ${
          item.listRank ? 'bg-blue-900/80 text-blue-400 border-blue-500' : 'bg-gray-900/80 text-gray-500 border-gray-700'
        }`}>
          {item.listRank ? `#${item.listRank}` : '# -'}
        </div>
        
        {/* Poster Image */}
        {item.image ? (
          <img src={item.image} alt={item.title} className="w-full h-auto object-cover aspect-[2/3] rounded-t-xl group-hover:opacity-80 transition-opacity" />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-800 rounded-t-xl flex items-center justify-center text-gray-500 p-4 text-center">No Image</div>
        )}
        
        {/* Title & Type */}
        <div className="p-4 flex flex-col flex-1 justify-between">
          <h2 className="font-semibold text-lg truncate group-hover:text-white transition-colors text-gray-200" title={item.title}>
            {item.title}
          </h2>
          <div className="flex justify-between items-end mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-950 text-gray-500 border border-gray-800/60 inline-block">
                {item.type}
              </span>
              <span className="text-gray-500 text-xs font-medium">
                {item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'}
              </span>
            </div>
            <div className="shrink-0 -mb-1 -mr-1">
              <MediaActionMenu item={item} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
