import { MediaItem } from '@/types';
import MediaCardVertical from './MediaCardVertical';

export default function MediaRow({ title, items }: { title: string; items: MediaItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6 tracking-wide text-gray-100">{title}</h2>
      <div className="flex gap-4 overflow-x-auto snap-x scrollbar-none pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <div key={item.id} className="flex-none w-40 sm:w-48 lg:w-56 snap-start">
            <MediaCardVertical item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
