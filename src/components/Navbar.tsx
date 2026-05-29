"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur px-4 md:px-8 h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        {/* Left Side: Logo */}
        <Link href="/" className="text-xl font-bold text-white tracking-tight shrink-0">
          Media<span className="text-blue-500">Aggregator</span>
        </Link>

        {/* Right Side: Nav Links */}
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={[
              "px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent",
              isActive("/") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50",
            ].join(" ")}
          >
            Search
          </Link>
          <Link
            href="/discover"
            className={[
              "px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent",
              isActive("/discover") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50",
            ].join(" ")}
          >
            Discover
          </Link>
          <Link
            href="/profile"
            className={[
              "px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-transparent",
              isActive("/profile") ? "text-blue-400 bg-blue-600/10 border-blue-500/30" : "text-gray-300 hover:text-white hover:bg-gray-800/50",
            ].join(" ")}
          >
            Profile
          </Link>
        </nav>
      </div>
    </header>
  );
}