export default function DetailsLoading() {
    return (
      <main className="min-h-screen bg-gray-950 text-white relative flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Spinning loader */}
          <div className="w-16 h-16 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium animate-pulse">Fetching media details...</p>
        </div>
      </main>
    );
  }