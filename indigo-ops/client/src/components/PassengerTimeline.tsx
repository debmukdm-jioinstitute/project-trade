export function PassengerTimeline({ timeline }: { timeline: { step: string; reached: boolean }[] }) {
  return (
    <div className="flex items-center flex-wrap gap-1 text-[10px]">
      {timeline.map((t, i) => (
        <div key={t.step} className="flex items-center gap-1">
          <span className={`px-2 py-1 border uppercase tracking-wide ${t.reached ? "border-ops-green text-ops-green bg-ops-green/10" : "border-ops-border2 text-ops-dim"}`}>
            {t.step}
          </span>
          {i < timeline.length - 1 && <span className="text-ops-dim">→</span>}
        </div>
      ))}
    </div>
  );
}
