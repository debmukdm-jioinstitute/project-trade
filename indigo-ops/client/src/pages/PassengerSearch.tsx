import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, Booking } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";

export default function PassengerSearch() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<Booking[]>([]);
  const navigate = useNavigate();

  async function search() {
    if (!q.trim()) return;
    setResults(await api.get<Booking[]>(`/passengers/search?q=${encodeURIComponent(q)}`));
  }

  useEffect(() => {
    if (params.get("q")) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">UNIVERSAL PASSENGER SEARCH</div>
      <div className="panel p-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="PNR, name, mobile, passport, bag tag, boarding pass no."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setParams({ q })}
        />
        <button className="btn-primary btn" onClick={() => { setParams({ q }); search(); }}>
          SEARCH
        </button>
      </div>
      <div className="panel">
        <table className="ops-table">
          <thead>
            <tr>
              <th>PNR</th><th>Passenger</th><th>Flight</th><th>Seat</th><th>Check-in</th><th>Boarding</th>
            </tr>
          </thead>
          <tbody>
            {results.map((b) => (
              <tr key={b.id} onClick={() => navigate(`/checkin?pnr=${b.pnr}`)}>
                <td className="font-semibold">{b.pnr}</td>
                <td>{b.passenger.name}</td>
                <td>{b.flight.flightNumber}</td>
                <td>{b.seat?.seatNumber ?? "-"}</td>
                <td><StatusBadge status={b.checkedIn ? "CHECKED-IN" : "PENDING"} /></td>
                <td><StatusBadge status={b.boarded ? "BOARDED" : "PENDING"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO RESULTS</div>}
      </div>
    </div>
  );
}
