export function AlertPanel({ alerts }: { alerts: { level: "warn" | "ok"; message: string }[] }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>OPERATIONAL ALERTS</span>
      </div>
      <div className="p-2 space-y-1 text-[12px] max-h-40 overflow-y-auto">
        {alerts.map((a, i) => (
          <div key={i} className={a.level === "warn" ? "text-ops-amber" : "text-ops-green"}>
            {a.level === "warn" ? "⚠ " : "✓ "}
            {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}
