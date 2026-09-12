import { useEffect, useState } from "react";
import { api, FlightRow } from "../lib/api";
import { SplitFlapText } from "../components/SplitFlap";

const REFRESH_MS = 20000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FIDS() {
  const [date] = useState(today());
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(new Date());

  async function load() {
    const data = await api.get<FlightRow[]>(`/flights?date=${date}`);
    setFlights(data);
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, REFRESH_MS);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departures = [...flights].sort((a, b) => a.std.localeCompare(b.std));
  const arrivals = [...flights].sort((a, b) => (a.sta ?? "").localeCompare(b.sta ?? ""));

  const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });
  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <div className="fids-board min-h-full p-6 space-y-6">
      <div className="flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-2xl tracking-[0.3em] font-bold text-white">INDIGO OPS</div>
          <div className="text-[11px] tracking-[0.35em] text-amber-200/70 mt-1">
            FLIGHT INFORMATION DISPLAY SYSTEM — PROTOTYPE / SIMULATION
          </div>
        </div>
        <div className="text-right">
          <SplitFlapText text={timeStr} refreshKey={0} size="lg" />
          <div className="text-[11px] tracking-[0.25em] text-amber-200/70 mt-1">{dateStr}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Board title="DEPARTURES" rows={departures} kind="dep" refreshKey={refreshKey} />
        <Board title="ARRIVALS" rows={arrivals} kind="arr" refreshKey={refreshKey} />
      </div>

      <div className="text-center text-[10px] tracking-[0.3em] text-amber-200/40 pt-2">
        BOARD REFRESHES EVERY {REFRESH_MS / 1000}s — NOT A REAL AIRLINE SYSTEM
      </div>
    </div>
  );
}

function Board({
  title,
  rows,
  kind,
  refreshKey,
}: {
  title: string;
  rows: FlightRow[];
  kind: "dep" | "arr";
  refreshKey: number;
}) {
  return (
    <div className="border border-white/10 rounded-sm">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-[13px] tracking-[0.3em] text-white font-semibold">{title}</span>
        <span className="text-[10px] tracking-widest text-amber-200/50">{rows.length} FLIGHTS</span>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <div className="grid grid-cols-[64px_84px_190px_56px_165px] gap-2 px-3 py-1.5 text-[10px] tracking-widest text-amber-200/50 border-b border-white/10 sticky top-0 bg-[#0b0d10] min-w-max">
          <span>TIME</span>
          <span>FLIGHT</span>
          <span>{kind === "dep" ? "DESTINATION" : "ORIGIN"}</span>
          <span>GATE</span>
          <span>STATUS</span>
        </div>
        {rows.map((f) => (
          <div key={f.id} className="grid grid-cols-[64px_84px_190px_56px_165px] gap-2 px-3 py-1.5 border-b border-white/5 fids-flap-sm min-w-max">
            <SplitFlapText text={kind === "dep" ? f.std : f.sta ?? "--:--"} width={5} refreshKey={refreshKey} />
            <SplitFlapText text={f.flightNumber} width={7} refreshKey={refreshKey} />
            <SplitFlapText text={kind === "dep" ? f.destination : f.origin} width={16} refreshKey={refreshKey} />
            <SplitFlapText text={f.gate?.code ?? "--"} width={4} refreshKey={refreshKey} />
            <SplitFlapText text={f.status} width={14} refreshKey={refreshKey} />
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-6 text-center text-amber-200/40 text-[12px]">NO FLIGHTS SCHEDULED</div>}
      </div>
    </div>
  );
}
