import Link from "next/link";
import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { appLog } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

const cards = ["Background Jobs", "Logs", "Cache", "Database Checks"];

export default async function AdminPage() {
  const requestId = createRequestId();
  let admin = null;
  let deniedCode: string | null = null;

  try {
    admin = await requireAdmin();
  } catch (error) {
    deniedCode = error instanceof AdminAuthError ? error.code : "ADMIN_REQUIRED";
    await appLog({
      level: error instanceof AdminAuthError ? "warn" : "error",
      event: "admin.page.denied",
      requestId,
      error,
      persist: true,
    });
  }

  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-8 text-white">
        <div className="max-w-md rounded-lg border border-gray-800 bg-gray-900 p-8 text-center shadow-xl">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-red-400">
            Access denied
          </p>
          <h1 className="mb-3 text-3xl font-black">Admin only</h1>
          <p className="text-sm text-gray-400">{deniedCode}</p>
        </div>
      </main>
    );
  }

  await appLog({
    level: "info",
    event: "admin.page.viewed",
    requestId,
    userId: admin.id,
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white px-8 pb-16 pt-24">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-400">
          Internal
        </p>
        <h1 className="mb-3 text-4xl font-black">Admin</h1>
        <p className="mb-10 text-gray-400">Internal diagnostics console</p>

        <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
          Signed in as{" "}
          <span className="font-bold text-white">{admin.name || admin.email || admin.id}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const content = (
              <>
                <h2 className="mb-2 font-black text-gray-100">{card}</h2>
                <p className="text-sm text-gray-500">Placeholder</p>
              </>
            );

            const href = card === "Logs" ? "/admin/logs" : card === "Background Jobs" ? "/admin/jobs" : null;

            return href ? (
              <Link key={card} href={href} className="rounded-lg border border-blue-500/40 bg-blue-900/20 p-5 transition-colors hover:border-blue-400">
                {content}
              </Link>
            ) : (
              <div key={card} className="rounded-lg border border-gray-800 bg-gray-900 p-5">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
