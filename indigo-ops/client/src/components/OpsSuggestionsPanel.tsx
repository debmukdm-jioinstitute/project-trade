import { useNavigate } from "react-router-dom";
import type { DashboardData } from "../lib/api";

const LEVEL_CLASS: Record<string, string> = {
  urgent: "text-ops-red",
  warn: "text-ops-amber",
  info: "text-ops-cyan",
};

const LEVEL_ICON: Record<string, string> = {
  urgent: "⛔",
  warn: "⚠",
  info: "→",
};

// Real-time, flight-time-and-load-aware recommendations: when to open
// check-in/boarding, issue final call, depart, or prepare for arrival —
// computed server-side from each flight's STD/STA vs now and its
// check-in/boarding progress. Purely advisory; clicking jumps to the flight.
export function OpsSuggestionsPanel({ suggestions }: { suggestions: DashboardData["suggestions"] }) {
  const navigate = useNavigate();

  return (
    <div className="panel">
      <div className="panel-header">
        <span>RECOMMENDED ACTIONS — REAL-TIME</span>
        <span className="text-ops-dim">{suggestions.length} PENDING</span>
      </div>
      <div className="p-2 space-y-1 text-[12px] max-h-48 overflow-y-auto">
        {suggestions.length === 0 && <div className="text-ops-dim px-1 py-1">NO ACTIONS DUE RIGHT NOW</div>}
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => navigate(`/flights/${s.flightId}`)}
            className="w-full text-left flex items-center gap-2 px-1 py-1 hover:bg-ops-panel2 rounded-sm"
          >
            <span className={LEVEL_CLASS[s.level]}>{LEVEL_ICON[s.level]}</span>
            <span className={`badge ${s.level === "urgent" ? "badge-red" : s.level === "warn" ? "badge-amber" : "badge-cyan"}`}>
              {s.action}
            </span>
            <span className={LEVEL_CLASS[s.level]}>{s.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
