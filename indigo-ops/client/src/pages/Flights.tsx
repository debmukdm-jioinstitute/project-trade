import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Aircraft, FlightRow, Gate } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";

export default function Flights() {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function load() {
    const [f, a, g] = await Promise.all([
      api.get<FlightRow[]>("/flights"),
      api.get<Aircraft[]>("/aircraft"),
      api.get<Gate[]>("/gates"),
    ]);
    setFlights(f);
    setAircraft(a);
    setGates(g);
  }
  useEffect(() => {
    load();
  }, []);

  const [form, setForm] = useState({
    flightNumber: "",
    origin: "",
    destination: "",
    departureDate: new Date().toISOString().slice(0, 10),
    std: "",
    sta: "",
    aircraftId: "",
    gateId: "",
  });

  async function createFlight() {
    try {
      await api.post("/flights", form);
      toast.push({ kind: "success", title: "FLIGHT CREATED" });
      setShowCreate(false);
      load();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "CREATE FAILED", message: (e as Error).message });
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-ops-dim text-[11px] tracking-widest uppercase">FLIGHT SCHEDULING</div>
        <button className="btn-primary btn" onClick={() => setShowCreate(true)}>
          + CREATE FLIGHT
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>ALL FLIGHTS</span>
          <span className="text-ops-dim">{flights.length} RECORDS</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Flight</th>
                <th>Route</th>
                <th>Date</th>
                <th>Aircraft</th>
                <th>STD</th>
                <th>ETD</th>
                <th>Gate</th>
                <th>Terminal</th>
                <th>Pax</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f) => (
                <tr key={f.id} onClick={() => navigate(`/flights/${f.id}`)}>
                  <td className="font-semibold">{f.flightNumber}</td>
                  <td>
                    {f.origin} → {f.destination}
                  </td>
                  <td>{f.departureDate}</td>
                  <td>{f.aircraft?.registration ?? "UNASSIGNED"}</td>
                  <td>{f.std}</td>
                  <td>{f.etd}</td>
                  <td>{f.gate?.code ?? "-"}</td>
                  <td>{f.terminal}</td>
                  <td>
                    {f.checkedInCount}/{f.passengerCount}
                  </td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <Modal title="CREATE FLIGHT" onClose={() => setShowCreate(false)}>
          <div className="space-y-2 text-[12px]">
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="FLIGHT NUMBER (e.g. 6E999)" value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} />
              <input className="input" placeholder="DATE" type="date" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} />
              <input className="input" placeholder="ORIGIN (DEL)" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value.toUpperCase() })} />
              <input className="input" placeholder="DESTINATION (BOM)" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })} />
              <input className="input" placeholder="STD (06:10)" value={form.std} onChange={(e) => setForm({ ...form, std: e.target.value })} />
              <input className="input" placeholder="STA (08:10)" value={form.sta} onChange={(e) => setForm({ ...form, sta: e.target.value })} />
              <select className="input" value={form.aircraftId} onChange={(e) => setForm({ ...form, aircraftId: e.target.value })}>
                <option value="">SELECT AIRCRAFT</option>
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.registration} ({a.type})
                  </option>
                ))}
              </select>
              <select className="input" value={form.gateId} onChange={(e) => setForm({ ...form, gateId: e.target.value })}>
                <option value="">SELECT GATE</option>
                {gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} ({g.terminal})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary btn w-full mt-2" onClick={createFlight}>
              CREATE FLIGHT
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
