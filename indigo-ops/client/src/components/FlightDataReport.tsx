import { useEffect, useState } from "react";
import { api, FlightRow, FlightManifest } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { fmtMoney } from "../lib/status";
import { downloadDotMatrixReport } from "../lib/dotMatrixReport";

export function FlightDataReport() {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [flightId, setFlightId] = useState("");
  const [manifest, setManifest] = useState<FlightManifest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<FlightRow[]>("/flights").then(setFlights);
  }, []);

  async function select(id: string) {
    setFlightId(id);
    setManifest(null);
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<FlightManifest>(`/reports/flight/${id}/manifest`);
      setManifest(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="panel p-3 flex items-center gap-3">
        <label className="text-[11px] text-ops-dim uppercase whitespace-nowrap">Select Flight</label>
        <select className="input flex-1" value={flightId} onChange={(e) => select(e.target.value)}>
          <option value="">SELECT FLIGHT NUMBER</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} — {f.origin}→{f.destination} ({f.departureDate} {f.std})
            </option>
          ))}
        </select>
        {manifest && (
          <button className="btn-primary btn whitespace-nowrap" onClick={() => downloadDotMatrixReport(manifest)}>
            ⬇ DOWNLOAD (DOT-MATRIX .TXT)
          </button>
        )}
      </div>

      {loading && <div className="panel p-3 text-ops-dim text-[12px]">LOADING FLIGHT MANIFEST...</div>}

      {manifest && (
        <div className="space-y-3">
          <div className="panel p-3 grid grid-cols-4 gap-2 text-[12px]">
            <Field label="Flight" value={manifest.flight.flightNumber} />
            <Field label="Route" value={`${manifest.flight.origin} → ${manifest.flight.destination}`} />
            <Field label="Date" value={manifest.flight.departureDate} />
            <Field label="STD / ETD" value={`${manifest.flight.std} / ${manifest.flight.etd ?? "-"}`} />
            <Field label="Aircraft" value={manifest.flight.aircraft ? `${manifest.flight.aircraft.registration} (${manifest.flight.aircraft.type})` : "UNASSIGNED"} />
            <Field label="Gate / Terminal" value={`${manifest.flight.gate?.code ?? "UNASSIGNED"} / ${manifest.flight.terminal}`} />
            <Field label="Crew" value={manifest.flight.crew} />
            <div>
              <div className="text-[10px] text-ops-dim uppercase">Status</div>
              <StatusBadge status={manifest.flight.status} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>CHECKPOINT SUMMARY</span>
            </div>
            <div className="grid grid-cols-6 gap-2 p-3 text-[12px]">
              <Stat label="Total Pax" value={manifest.checkpoints.totalPax} />
              <Stat label="Checked-in" value={manifest.checkpoints.checkedIn} />
              <Stat label="Bag Drop" value={manifest.checkpoints.bagDrop} />
              <Stat label="Security Cleared" value={manifest.checkpoints.securityCleared} />
              <Stat label="Lounge Used" value={manifest.checkpoints.loungeUsed} />
              <Stat label="Boarded" value={manifest.checkpoints.boarded} />
              <Stat label="No-show" value={manifest.checkpoints.noShow} />
              <Stat label="Offloaded" value={manifest.checkpoints.offloaded} />
              <Stat label="Deplaned" value={manifest.checkpoints.deplaned} />
              <Stat label="Bags Loaded/Total" value={`${manifest.checkpoints.bagsLoaded}/${manifest.checkpoints.bagsTotal}`} />
              <Stat label="Excess Bag Revenue" value={fmtMoney(manifest.checkpoints.excessBaggageRevenue)} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>CUSTOMER DATA &amp; CHECKPOINTS</span>
              <span className="text-ops-dim">{manifest.passengers.length} PASSENGERS</span>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>PNR</th>
                    <th>Passenger</th>
                    <th>Seat</th>
                    <th>Check-in</th>
                    <th>Bag Drop</th>
                    <th>Lounge</th>
                    <th>Boarded</th>
                    <th>Special Services</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.passengers.map((p) => (
                    <tr key={p.pnr}>
                      <td>{p.pnr}</td>
                      <td>{p.name}</td>
                      <td>{p.seat ?? "-"}</td>
                      <td>{p.checkedIn ? "YES" : "NO"}</td>
                      <td>{p.bagDrop ? "YES" : "NO"}</td>
                      <td>{p.loungeUsed ? "YES" : "NO"}</td>
                      <td>{p.boarded ? "YES" : "NO"}</td>
                      <td>{p.specialServices.join(", ") || "-"}</td>
                      <td>
                        <StatusBadge status={p.boarded ? "BOARDED" : p.noShow ? "NO-SHOW" : p.offloaded ? "OFFLOADED" : p.checkedIn ? "CHECKED-IN" : "PENDING"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="panel">
              <div className="panel-header">
                <span>BAGGAGE — LOGISTICAL PLANNING</span>
                <span className="text-ops-dim">{manifest.baggage.length} BAGS</span>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>PNR</th>
                      <th>Weight</th>
                      <th>Dest</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.baggage.map((b) => (
                      <tr key={b.tagNumber}>
                        <td>{b.tagNumber}</td>
                        <td>{b.pnr}</td>
                        <td>{b.weightKg} KG</td>
                        <td>{b.destination}</td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {manifest.baggage.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO BAGGAGE RECORDS</div>}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span>MEAL / FOOD CHOICE</span>
                <span className="text-ops-dim">{manifest.mealVouchers.length} VOUCHERS</span>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Voucher No.</th>
                      <th>Passenger</th>
                      <th>Meal Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.mealVouchers.map((v) => (
                      <tr key={v.voucherNo}>
                        <td>{v.voucherNo}</td>
                        <td>{v.passenger}</td>
                        <td>{v.mealType.replace(/_/g, " ")}</td>
                        <td>
                          <StatusBadge status={v.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {manifest.mealVouchers.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO MEAL VOUCHERS ISSUED</div>}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>LOUNGE USAGE — CUSTOMERS</span>
              <span className="text-ops-dim">{manifest.loungePasses.length} PASSES</span>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Pass ID</th>
                    <th>Passenger</th>
                    <th>Lounge</th>
                    <th>Access Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.loungePasses.map((l) => (
                    <tr key={l.passId}>
                      <td>{l.passId}</td>
                      <td>{l.passenger}</td>
                      <td>{l.lounge}</td>
                      <td>{l.accessType.replace(/_/g, " ")}</td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {manifest.loungePasses.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO LOUNGE PASSES ISSUED</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-ops-dim uppercase">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel px-2 py-1.5">
      <div className="text-[10px] text-ops-dim uppercase">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
