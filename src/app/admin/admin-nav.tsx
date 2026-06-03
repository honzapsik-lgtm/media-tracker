import Link from "next/link";

const links = [
  ["Overview", "/admin"],
  ["Jobs", "/admin/jobs"],
  ["Logs", "/admin/logs"],
  ["Cache", "/admin/cache"],
  ["Database", "/admin/database"],
];

export function AdminNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 text-sm">
      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="rounded border border-gray-800 bg-gray-900 px-3 py-2 font-bold text-gray-300 hover:border-blue-500/60 hover:text-white"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
