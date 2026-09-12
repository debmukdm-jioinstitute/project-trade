import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, DashboardData } from "../lib/api";
import { StatsCard } from "../components/StatsCard";
import { AlertPanel } from "../components/AlertPanel";
import { StatusBadge } from "../components/StatusBadge";
import { fmtMoney } from "../lib/status";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const navigate = useNavigate();

  async function load() {
    setData(await api.get<DashboardData>("/dashboard"));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="p-4 text-ops-dim">LOADING OPERATIONS DATA...</div>;
  const s = data.stats;

  return (
    <div className="p-4 space-y-4">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">TODAY'S OPERATIONS — {data.date}</div>

      <div className="grid grid-cols-7 gap-3">
        <StatsCard label="Scheduled" value={s.flightsScheduled} />
        <StatsCard label="Boarding" value={s.flightsBoarding} tone="amber" />
        <StatsCard label="Departed" value={s.flightsDeparted} tone="green" />
        <StatsCard label="Arrived" value={s.flightsArrived} tone="green" />
        <StatsCard label="Delayed" value={s.delayed} tone="amber" />
        <StatsCard label="Cancelled" value={s.cancelled} tone="red" />
        <StatsCard label="Excess Bag Revenue" value={fmtMoney(s.excessRevenue)} tone="green" />
      </div>
      <div className="grid grid-cols-6 gap-3">
        <StatsCard label="Pax Checked-in" value={s.paxCheckedIn} />
        <StatsCard label="Pax Boarded" value={s.paxBoarded} />
        <StatsCard label="Bags Checked" value={s.bagsChecked} />
        <StatsCard label="Bags Loaded" value={s.bagsLoaded} />
        <StatsCard label="Meal Vouchers" value={s.mealVouchers} />
        <StatsCard label="Lounge Passes" value={s.loungePasses} />
      </div>

      <AlertPanel alerts={data.alerts} />

      <div className="panel">
        <div className="panel-header">
          <span>FLIGHT STATUS BOARD</span>
          <button className="btn" onClick={() => navigate("/flights")}>
            FULL LIST →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Flight</th>
                <th>Route</th>
                <th>Aircraft</th>
                <th>STD</th>
                <th>ETD</th>
                <th>Gate</th>
                <th>Pax</th>
                <th>Checked-in</th>
                <th>Boarded</th>
                <th>Bags</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.board.map((f) => (
                <tr key={f.id} onClick={() => navigate(`/flights/${f.id}`)}>
                  <td className="font-semibold">{f.flightNumber}</td>
                  <td>
                    {f.origin} → {f.destination}
                  </td>
                  <td>{f.aircraft}</td>
                  <td>{f.std}</td>
                  <td>{f.etd}</td>
                  <td>{f.gate}</td>
                  <td>{f.passengers}</td>
                  <td>{f.checkedIn}</td>
                  <td>{f.boarded}</td>
                  <td>{f.bags}</td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
