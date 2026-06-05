"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppDrawer from "@/components/AppDrawer";
import { useSession, signIn } from "next-auth/react";
import SearchBar from "@/components/SearchBar";
import { Suspense } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur px-4 md:px-8 h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        {/* Left Side: Logo and SearchBar */}
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" className="text-xl font-bold text-white tracking-tight">
            Media<span className="text-blue-500">Aggregator</span>
          </Link>
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>

        {/* Right Side: Nav Links */}
        <nav className="flex items-center gap-2">
          <Link href="/" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent ${isActive("/") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50"}`}>
            Home
          </Link>
          <Link href="/discover" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent ${isActive("/discover") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50"}`}>
            Discover
          </Link>
          <Link href="/rankings" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent ${isActive("/rankings") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50"}`}>
            Rankings
          </Link>

          {/* AUTHENTICATION LOGIC */}
          {status === "loading" ? (
             <div className="w-5 h-5 ml-3 rounded-full border-2 border-gray-800 border-t-blue-500 animate-spin"></div>
          ) : session ? (
            <Link href="/profile" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent ${isActive("/profile") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50"}`}>
              Profile
            </Link>
          ) : (
            <button onClick={() => signIn()} className="ml-2 px-4 py-2 rounded-lg text-sm font-bold text-black bg-white hover:bg-gray-200 transition-colors">
              Log In
            </button>
          )}

          <div className="w-px h-6 bg-gray-800 hidden sm:block mx-2"></div>
          <AppDrawer /> 
        </nav>
      </div>
    </header>
  );
}