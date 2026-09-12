export function StatsCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  tone?: "amber" | "red" | "green";
  onClick?: () => void;
}) {
  const toneClass = tone === "amber" ? "text-ops-amber" : tone === "red" ? "text-ops-red" : tone === "green" ? "text-ops-green" : "text-ops-text";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`panel px-3 py-2 text-left w-full ${
        onClick ? "hover:border-ops-indigoBright hover:bg-ops-panel2 transition-colors cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-ops-dim">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </button>
  );
}
