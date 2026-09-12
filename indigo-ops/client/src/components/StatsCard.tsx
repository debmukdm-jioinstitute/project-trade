export function StatsCard({ label, value, tone }: { label: string; value: string | number; tone?: "amber" | "red" | "green" }) {
  const toneClass = tone === "amber" ? "text-ops-amber" : tone === "red" ? "text-ops-red" : tone === "green" ? "text-ops-green" : "text-ops-text";
  return (
    <div className="panel px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ops-dim">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
