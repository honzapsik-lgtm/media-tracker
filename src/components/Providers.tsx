"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const triggerWorker = () => fetch("/api/worker", { method: "POST" }).catch(() => {});
    triggerWorker();
    const interval = setInterval(triggerWorker, 15000);
    return () => clearInterval(interval);
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}