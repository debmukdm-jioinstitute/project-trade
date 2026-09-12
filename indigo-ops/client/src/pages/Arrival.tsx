import { useEffect, useState } from "react";
import { api, FlightRow, Gate } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export default function Arrival() {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [flightId, setFlightId] = useState("");
  const [gateId, setGateId] = useState("");
  const toast = useToast();

  async function reload() {
    setFlights(await api.get<FlightRow[]>("/flights"));
  }
  useEffect(() => {
    reload();
    api.get<Gate[]>("/gates").then(setGates);
  }, []);

  async function act(path: string, body?: unknown, okMsg?: string) {
    try {
      await api.post(`/flights/${flightId}${path}`, body);
      toast.push({ kind: "success", title: okMsg ?? "ACTION COMPLETE" });
      reload();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "ACTION FAILED", message: (e as Error).message });
    }
  }

  const flight = flights.find((f) => f.id === flightId);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">ARRIVAL / DISEMBARKATION OPERATIONS</div>
      <div className="panel p-3">
        <select className="input" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
          <option value="">SELECT FLIGHT</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} {f.origin}→{f.destination} — {f.status}
            </option>
          ))}
        </select>
      </div>

      {flight && (
        <div className="panel p-3 max-w-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{flight.flightNumber}</div>
            <StatusBadge status={flight.status} />
          </div>
          <button className="btn w-full" disabled={flight.status !== "DEPARTED"} onClick={() => act("/landed", {}, "FLIGHT LANDED")}>
            MARK LANDED
          </button>
          <div className="flex gap-2">
            <select className="input flex-1" value={gateId} onChange={(e) => setGateId(e.target.value)}>
              <option value="">SELECT ARRIVAL GATE</option>
              {gates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} ({g.terminal})
                </option>
              ))}
            </select>
            <button className="btn" disabled={!gateId} onClick={() => act("/arrival-gate", { gateId }, "ARRIVAL GATE ASSIGNED")}>
              ASSIGN GATE
            </button>
          </div>
          <button className="btn w-full" onClick={() => act("/disembark/start", {}, "DISEMBARKATION STARTED")}>
            START DISEMBARKATION
          </button>
          <button className="btn w-full" onClick={() => act("/disembark/all", {}, "ALL PASSENGERS DEPLANED")}>
            DEPLANE ALL
          </button>
          <button className="btn w-full" onClick={() => act("/arrival/close", {}, "ARRIVAL CLOSED")}>
            CLOSE ARRIVAL
          </button>
          <button className="btn-primary btn w-full" onClick={() => act("/close", {}, "FLIGHT CLOSED")}>
            CLOSE FLIGHT
          </button>
        </div>
      )}
    </div>
  );
}
