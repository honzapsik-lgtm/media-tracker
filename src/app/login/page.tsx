"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: 'github' | 'discord' | 'google') => {
    setLoading(provider);
    
    // This automatically redirects the user to the provider, 
    // then back to our callback route we just made.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Login Error:", error.message);
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="text-gray-400 hover:text-white text-sm mb-4 inline-block">
            ← Back to App
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Join the Database</h1>
          <p className="text-gray-400">Track and rate your entire media library.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleOAuthLogin('github')}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 bg-[#24292e] hover:bg-[#2f363d] text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'github' ? 'Connecting...' : 'Continue with GitHub'}
          </button>

          <button
            onClick={() => handleOAuthLogin('discord')}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'discord' ? 'Connecting...' : 'Continue with Discord'}
          </button>

          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'google' ? 'Connecting...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </main>
  );
}