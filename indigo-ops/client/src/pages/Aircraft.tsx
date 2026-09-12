import { useEffect, useState } from "react";
import { api, FlightRow } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";

interface SeatRow {
  id: string;
  seatNumber: string;
  cabin: string;
  status: string;
  booking: { passenger: { name: string } } | null;
}

export default function Aircraft() {
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [flightId, setFlightId] = useState("");
  const [seats, setSeats] = useState<SeatRow[]>([]);

  useEffect(() => {
    api.get<any[]>("/aircraft").then(setAircraft);
    api.get<FlightRow[]>("/flights").then(setFlights);
  }, []);

  async function loadSeatmap(id: string) {
    setFlightId(id);
    if (!id) return setSeats([]);
    setSeats(await api.get<SeatRow[]>(`/flights/${id}/seatmap`));
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">AIRCRAFT MANAGEMENT</div>
      <div className="panel">
        <div className="panel-header"><span>FLEET</span></div>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Registration</th><th>Type</th><th>Configuration</th><th>Capacity</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {aircraft.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.registration}</td>
                <td>{a.type}</td>
                <td>{a.configuration}</td>
                <td>{a.seatCapacity}</td>
                <td><StatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel p-3">
        <div className="text-[11px] text-ops-dim uppercase mb-2">Seat Map Viewer (per flight)</div>
        <select className="input" value={flightId} onChange={(e) => loadSeatmap(e.target.value)}>
          <option value="">SELECT FLIGHT</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} — {f.aircraft?.registration ?? "UNASSIGNED"}
            </option>
          ))}
        </select>
        {seats.length > 0 && (
          <div className="grid grid-cols-6 gap-1 mt-3 max-w-xl">
            {seats.map((s) => (
              <div
                key={s.id}
                title={s.booking?.passenger.name ?? "AVAILABLE"}
                className={`text-[10px] text-center py-1.5 border ${
                  s.status === "AVAILABLE"
                    ? "border-ops-border2 text-ops-dim"
                    : s.status === "CHECKED-IN"
                    ? "border-ops-green text-ops-green bg-ops-green/10"
                    : "border-ops-amber text-ops-amber bg-ops-amber/10"
                }`}
              >
                {s.seatNumber}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
