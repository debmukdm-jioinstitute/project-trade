import { useEffect, useState } from "react";

const NAV = [
  { label: "FLIGHTS", path: "/flights", key: "F2" },
  { label: "BOOKINGS", path: "/checkin", key: "F3" },
  { label: "BAGGAGE", path: "/baggage", key: "F4" },
  { label: "BOARDING", path: "/boarding", key: "F5" },
  { label: "VOUCHERS", path: "/vouchers", key: "F6" },
  { label: "LOUNGE", path: "/lounge", key: "F7" },
  { label: "REPORTS", path: "/reports", key: "F8" },
];

export function TerminalHeader({ onNav, current }: { onNav: (path: string) => void; current: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <div className="border-b border-ops-border bg-ops-panel">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ops-border">
        <div className="flex items-baseline gap-3">
          <span className="text-ops-indigoBright font-bold tracking-widest text-[15px]">INDIGO OPS</span>
          <span className="text-ops-dim text-[11px] tracking-widest">// AIRLINE OPERATIONS CONTROL SYSTEM</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-ops-dim">
          <span>
            SYSTEM STATUS: <span className="text-ops-green">OPERATIONAL</span>
          </span>
          <span>
            DATE: <span className="text-ops-text">{dateStr}</span>
          </span>
          <span className="text-ops-text tabular-nums">{timeStr}</span>
          <span className="badge badge-amber">PROTOTYPE / SIMULATION</span>
        </div>
      </div>
      <div className="flex items-center px-2 text-[11px]">
        <button
          onClick={() => onNav("/")}
          className={`px-3 py-2 uppercase tracking-wide border-b-2 ${
            current === "/" ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
          }`}
        >
          DASHBOARD <span className="text-ops-dim">[F1]</span>
        </button>
        {NAV.map((n) => (
          <button
            key={n.path}
            onClick={() => onNav(n.path)}
            className={`px-3 py-2 uppercase tracking-wide border-b-2 ${
              current.startsWith(n.path) ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
            }`}
          >
            {n.label} <span className="text-ops-dim">[{n.key}]</span>
          </button>
        ))}
        <button
          onClick={() => onNav("/gates")}
          className={`px-3 py-2 uppercase tracking-wide border-b-2 ${
            current.startsWith("/gates") ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
          }`}
        >
          GATES
        </button>
        <button
          onClick={() => onNav("/aircraft")}
          className={`px-3 py-2 uppercase tracking-wide border-b-2 ${
            current.startsWith("/aircraft") ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
          }`}
        >
          AIRCRAFT
        </button>
        <button
          onClick={() => onNav("/audit")}
          className={`px-3 py-2 uppercase tracking-wide border-b-2 ${
            current.startsWith("/audit") ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
          }`}
        >
          AUDIT LOG
        </button>
        <button
          onClick={() => onNav("/fids")}
          className={`px-3 py-2 uppercase tracking-wide border-b-2 ${
            current.startsWith("/fids") ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
          }`}
        >
          FIDS BOARD
        </button>
        <div className="ml-auto flex items-center gap-2 pr-2 text-ops-dim">
          <span>[/] SEARCH</span>
          <span>[CTRL+K] COMMAND</span>
        </div>
      </div>
    </div>
  );
}
