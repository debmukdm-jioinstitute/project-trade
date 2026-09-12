import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, DashboardData } from "../lib/api";
import { StatsCard } from "../components/StatsCard";
import { AlertPanel } from "../components/AlertPanel";
import { StatusBadge } from "../components/StatusBadge";
import { GlobalCustomerSearch } from "../components/GlobalCustomerSearch";
import { StatDetailModal, type StatKind } from "../components/StatDetailModal";
import { fmtMoney } from "../lib/status";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [detail, setDetail] = useState<StatKind | null>(null);
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
      <GlobalCustomerSearch />

      <div className="text-ops-dim text-[11px] tracking-widest uppercase">TODAY'S OPERATIONS — {data.date}</div>

      <div className="grid grid-cols-7 gap-3">
        <StatsCard label="Scheduled" value={s.flightsScheduled} onClick={() => setDetail("SCHEDULED")} />
        <StatsCard label="Boarding" value={s.flightsBoarding} tone="amber" onClick={() => setDetail("BOARDING")} />
        <StatsCard label="Departed" value={s.flightsDeparted} tone="green" onClick={() => setDetail("DEPARTED")} />
        <StatsCard label="Arrived" value={s.flightsArrived} tone="green" onClick={() => setDetail("ARRIVED")} />
        <StatsCard label="Delayed" value={s.delayed} tone="amber" onClick={() => setDetail("DELAYED")} />
        <StatsCard label="Cancelled" value={s.cancelled} tone="red" onClick={() => setDetail("CANCELLED")} />
        <StatsCard label="Excess Bag Revenue" value={fmtMoney(s.excessRevenue)} tone="green" onClick={() => setDetail("EXCESS_REVENUE")} />
      </div>
      <div className="grid grid-cols-6 gap-3">
        <StatsCard label="Pax Checked-in" value={s.paxCheckedIn} onClick={() => setDetail("CHECKED_IN")} />
        <StatsCard label="Pax Boarded" value={s.paxBoarded} onClick={() => setDetail("BOARDED")} />
        <StatsCard label="Bags Checked" value={s.bagsChecked} onClick={() => setDetail("BAGS_CHECKED")} />
        <StatsCard label="Bags Loaded" value={s.bagsLoaded} onClick={() => setDetail("BAGS_LOADED")} />
        <StatsCard label="Meal Vouchers" value={s.mealVouchers} onClick={() => setDetail("MEAL_VOUCHERS")} />
        <StatsCard label="Lounge Passes" value={s.loungePasses} onClick={() => setDetail("LOUNGE_PASSES")} />
      </div>

      <AlertPanel alerts={data.alerts} />

      {detail && <StatDetailModal kind={detail} date={data.date} board={data.board} onClose={() => setDetail(null)} />}

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
