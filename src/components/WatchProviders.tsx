export default function WatchProviders({ watchData }: { watchData: any }) {
  if (!watchData || !watchData.flatrate || watchData.flatrate.length === 0) return null;
  return (
    <div className="mt-4 bg-gray-950/50 p-5 rounded-2xl border border-gray-800 shadow-xl">
      <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-3">Where to Stream</h3>
      <div className="flex flex-wrap gap-2.5 items-center">
        {watchData.flatrate.map((provider: any) => (
          <img 
            key={provider.provider_id} 
            src={`https://image.tmdb.org/t/p/w200${provider.logo_path}`} 
            alt={provider.provider_name} 
            title={provider.provider_name}
            className="w-9 h-9 rounded-xl shadow-md border border-gray-800 object-cover hover:scale-105 transition-transform"
          />
        ))}
      </div>
    </div>
  );
}
