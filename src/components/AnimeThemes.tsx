export default function AnimeThemes({ themeData: rawThemeData }: { themeData: any }) {
  if (!rawThemeData) {
    return <p className="text-gray-500 mt-4 text-xs font-bold">AnimeThemes Mounted: No themeData</p>;
  }

  let themeData = rawThemeData;
  if (typeof rawThemeData === 'string') {
    try {
      themeData = JSON.parse(rawThemeData);
    } catch (e) {
      return <p className="text-red-500 mt-4 text-xs font-bold">AnimeThemes Mounted: Failed to parse themeData</p>;
    }
  }

  const hasOpenings = themeData?.openings?.length > 0;
  const hasEndings = themeData?.endings?.length > 0;

  if (!hasOpenings && !hasEndings) {
    return <p className="text-gray-500 mt-4 text-xs font-bold">AnimeThemes Mounted: Empty openings/endings</p>;
  }

  return (
    <div className="mt-8 bg-gray-950/50 rounded-xl p-6 border border-gray-800 shadow-xl mb-6">
      <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Anime Themes</h3>
      <div className="grid md:grid-cols-2 gap-8">
        {themeData.openings && themeData.openings.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-blue-500 uppercase mb-3 tracking-widest">Openings</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {themeData.openings.map((op: string, idx: number) => (
                <li key={idx} className="bg-gray-900 px-3 py-2 rounded-lg border border-gray-800 break-words hover:border-gray-600 transition-colors">{op}</li>
              ))}
            </ul>
          </div>
        )}
        {themeData.endings && themeData.endings.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-blue-500 uppercase mb-3 tracking-widest">Endings</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {themeData.endings.map((ed: string, idx: number) => (
                <li key={idx} className="bg-gray-900 px-3 py-2 rounded-lg border border-gray-800 break-words hover:border-gray-600 transition-colors">{ed}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
