export default function WatchProviders({ watchData }: { watchData: any }) {
  if (!watchData || !watchData.flatrate || watchData.flatrate.length === 0) return null;
  return (
    <div className="flex gap-2 items-center mt-3">
      <span className="text-xs text-gray-500 font-bold uppercase tracking-widest mr-2">Stream On</span>
      <div className="flex flex-wrap gap-2">
        {watchData.flatrate.map((provider: any) => (
          <img 
            key={provider.provider_id} 
            src={`https://image.tmdb.org/t/p/w200${provider.logo_path}`} 
            alt={provider.provider_name} 
            title={provider.provider_name}
            className="w-8 h-8 rounded-lg shadow-md border border-gray-800 object-cover"
          />
        ))}
      </div>
    </div>
  );
}
