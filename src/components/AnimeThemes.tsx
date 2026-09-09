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
          className="bg-gray-900 px-3 py-2 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
        >
          <span
            className="block overflow-hidden leading-5 break-words"
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
    <div className="mt-8 bg-gray-950/50 rounded-xl p-6 border border-gray-800 shadow-xl mb-6">
      <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Anime Themes</h3>
      <div className="space-y-5">
        {themeData.openings && themeData.openings.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-blue-500 uppercase mb-3 tracking-widest">Openings</h4>
            {renderThemes(themeData.openings)}
          </div>
        )}
        {themeData.endings && themeData.endings.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-blue-500 uppercase mb-3 tracking-widest">Endings</h4>
            {renderThemes(themeData.endings)}
          </div>
        )}
      </div>
    </div>
  );
}
