import { getTrendingMovies } from '@/lib/tmdb';
import SearchBar from '@/components/SearchBar';
import Link from 'next/link';

export default async function Home() {
  const movies = await getTrendingMovies();

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Media Aggregator
          </h1>
          <SearchBar />
        </div>

        <h2 className="text-2xl font-bold mb-6">Trending Movies</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {movies.map((movie) => (
            <Link 
              href={`/media/${movie.id}`} // FIXED: No longer hardcoding tmdb- prefix
              key={movie.id} 
              className="block hover:scale-105 transition-transform duration-300"
            >
              <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg h-full border border-gray-800">
                {movie.image ? (
                  <img 
                    src={movie.image} 
                    alt={movie.title}
                    className="w-full h-auto object-cover aspect-[2/3]"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-semibold text-lg truncate" title={movie.title}>
                    {movie.title}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {movie.releaseDate ? movie.releaseDate.split('-')[0] : 'N/A'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}