'use client';

import { useRouter } from 'next/navigation';

export default function BackToSearchButton() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const lastSearchUrl = sessionStorage.getItem('lastSearchUrl');

      // 1. If we have a saved search URL, navigate back to it
      if (lastSearchUrl) {
        router.push(lastSearchUrl);
        return;
      }

      // 2. If browser history exists, go back
      if (window.history.length > 1) {
        router.back();
        return;
      }
    }

    // 3. Fallback to Home if opened directly
    router.push('/');
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="text-gray-400 hover:text-white mb-8 inline-flex items-center gap-2 font-semibold transition-colors cursor-pointer group"
    >
      <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span> Back to Search
    </button>
  );
}
