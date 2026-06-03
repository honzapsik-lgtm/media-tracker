const badgeClasses: Record<string, string> = {
  pending: "border-blue-500/40 bg-blue-900/20 text-blue-300",
  processing: "border-amber-500/40 bg-amber-900/20 text-amber-300",
  completed: "border-green-500/40 bg-green-900/20 text-green-300",
  failed: "border-red-500/40 bg-red-900/20 text-red-300",
  cancelled: "border-gray-700 bg-gray-900 text-gray-400",
  ok: "border-green-500/40 bg-green-900/20 text-green-300",
  warning: "border-amber-500/40 bg-amber-900/20 text-amber-300",
  error: "border-red-500/40 bg-red-900/20 text-red-300",
  expired: "border-amber-500/40 bg-amber-900/20 text-amber-300",
  fresh: "border-green-500/40 bg-green-900/20 text-green-300",
  info: "border-blue-500/40 bg-blue-900/20 text-blue-300",
  warn: "border-amber-500/40 bg-amber-900/20 text-amber-300",
  debug: "border-gray-700 bg-gray-900 text-gray-400",
};

export function AdminBadge({ value }: { value: string }) {
  return (
    <span className={`rounded border px-2 py-1 text-xs font-black ${badgeClasses[value] ?? badgeClasses.debug}`}>
      {value}
    </span>
  );
}
