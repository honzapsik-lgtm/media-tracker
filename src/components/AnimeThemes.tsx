export default function AnimeThemes({ themeData: rawThemeData }: { themeData: any }) {
  if (!rawThemeData) {
    return null;
  }

  let themeData = rawThemeData;
  if (typeof rawThemeData === 'string') {
    try {
      themeData = JSON.parse(rawThemeData);
    } catch (e) {
      return null;
    }
  }

  const hasOpenings = themeData?.openings?.length > 0;
  const hasEndings = themeData?.endings?.length > 0;

  if (!hasOpenings && !hasEndings) {
    return null;
  }

  const renderThemes = (themes: string[]) => (
    <ul className="space-y-2 text-sm text-gray-300">
      {themes.map((theme: string, idx: number) => (
        <li
          key={idx}
          className="bg-gray-900/80 px-3 py-2 rounded-xl border border-gray-800/80 hover:border-gray-700 transition-colors"
        >
          <span
            className="block overflow-hidden leading-snug break-words text-xs font-semibold text-gray-200"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
            }}
          >
            {theme}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-4 bg-gray-950/50 rounded-2xl p-5 border border-gray-800 shadow-xl">
      <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Anime Themes</h3>
      <div className="space-y-4">
        {hasOpenings && (
          <div>
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 tracking-widest">Openings</h4>
            {renderThemes(themeData.openings)}
          </div>
        )}
        {hasEndings && (
          <div>
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 tracking-widest">Endings</h4>
            {renderThemes(themeData.endings)}
          </div>
        )}
      </div>
    </div>
  );
}
