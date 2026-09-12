import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, Aircraft, FlightRow, Gate } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

type Tab = "OVERVIEW" | "BOARDING" | "DEPARTURE" | "ARRIVAL" | "BAGGAGE";

interface BoardingSummary {
  totalPax: number;
  checkedIn: number;
  boarded: number;
  remaining: number;
  passengers: { bookingId: string; pnr: string; name: string; seat: string; sequenceNumber: number | null; boardingGroup: string; status: string }[];
}

interface Checklist {
  checklist: Record<string, boolean>;
  ready: boolean;
  mismatches: string[];
}

interface Reconciliation {
  totalChecked: number;
  totalLoaded: number;
  unloaded: number;
  transferBags: number;
  missing: number;
  mismatches: number;
  rows: { bagId: string; tagNumber: string; passenger: string; pnr: string; weightKg: number; status: string; boarded: boolean; mismatch: boolean }[];
}

export default function FlightDetail() {
  const { id } = useParams();
  const [flight, setFlight] = useState<FlightRow | null>(null);
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!id) return;
    setFlight(await api.get<FlightRow>(`/flights/${id}`));
  }, [id]);

  useEffect(() => {
    load();
    api.get<Aircraft[]>("/aircraft").then(setAircraft);
    api.get<Gate[]>("/gates").then(setGates);
  }, [load]);

  async function act(path: string, body?: unknown, okMsg?: string) {
    try {
      await api.post(`/flights/${id}${path}`, body);
      toast.push({ kind: "success", title: okMsg ?? "ACTION COMPLETE" });
      load();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "ACTION FAILED", message: (e as Error).message });
    }
  }

  if (!flight) return <div className="p-4 text-ops-dim">LOADING FLIGHT...</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="panel p-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-ops-indigoBright">
            {flight.flightNumber} &nbsp; {flight.origin} → {flight.destination}
          </div>
          <div className="text-ops-dim text-[11px] mt-1">
            {flight.departureDate} &nbsp; STD {flight.std} &nbsp; ETD {flight.etd} &nbsp; GATE {flight.gate?.code ?? "UNASSIGNED"} &nbsp;
            AIRCRAFT {flight.aircraft?.registration ?? "UNASSIGNED"}
          </div>
        </div>
        <StatusBadge status={flight.status} />
      </div>

      <div className="flex gap-1 border-b border-ops-border">
        {(["OVERVIEW", "BOARDING", "DEPARTURE", "ARRIVAL", "BAGGAGE"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[11px] uppercase tracking-wide border-b-2 ${
              tab === t ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim hover:text-ops-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "OVERVIEW" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="panel p-3 space-y-2">
            <div className="text-[11px] text-ops-dim uppercase">Aircraft &amp; Gate</div>
            <div className="flex gap-2">
              <select className="input flex-1" value={flight.aircraft?.id ?? ""} onChange={(e) => act("/aircraft", { aircraftId: e.target.value }, "AIRCRAFT ASSIGNED")}>
                <option value="">ASSIGN AIRCRAFT</option>
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.registration} ({a.type})
                  </option>
                ))}
              </select>
              <select className="input flex-1" value={flight.gate?.id ?? ""} onChange={(e) => act(flight.gate ? "/gate/change" : "/gate", { gateId: e.target.value }, "GATE ASSIGNED")}>
                <option value="">ASSIGN GATE</option>
                {gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} ({g.terminal})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] text-ops-dim uppercase pt-2">Flight Status Actions</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => act("/checkin/open", {}, "CHECK-IN OPENED")}>OPEN CHECK-IN</button>
              <button className="btn" onClick={() => act("/checkin/close", {}, "CHECK-IN CLOSED")}>CLOSE CHECK-IN</button>
              <button className="btn" onClick={() => act("/boarding/open", {}, "BOARDING OPENED")}>OPEN BOARDING</button>
              <button className="btn" onClick={() => act("/boarding/final-call", {}, "FINAL CALL ISSUED")}>FINAL CALL</button>
              <button className="btn" onClick={() => act("/gate/close", {}, "GATE CLOSED")}>GATE CLOSED</button>
              <button className="btn" onClick={() => act("/delay", { minutes: 15 }, "FLIGHT DELAYED 15 MIN")}>DELAY +15 MIN</button>
              <button className="btn-danger btn" onClick={() => act("/cancel", {}, "FLIGHT CANCELLED")}>CANCEL FLIGHT</button>
            </div>
          </div>
          <div className="panel p-3 space-y-1 text-[12px]">
            <div className="text-[11px] text-ops-dim uppercase mb-1">Flight Info</div>
            <Row label="Passengers" value={String(flight.passengerCount)} />
            <Row label="Checked-in" value={String(flight.checkedInCount)} />
            <Row label="Boarded" value={String(flight.boardedCount)} />
            <Row label="Bags" value={String(flight.bagCount)} />
            <Row label="Terminal" value={flight.terminal} />
            <Row label="Check-in Open" value={flight.checkinOpen ? "YES" : "NO"} />
            <Row label="Boarding Open" value={flight.boardingOpen ? "YES" : "NO"} />
          </div>
        </div>
      )}

      {tab === "BOARDING" && <BoardingTab flightId={id!} refreshParent={load} />}
      {tab === "DEPARTURE" && <DepartureTab flightId={id!} status={flight.status} act={act} />}
      {tab === "ARRIVAL" && <ArrivalTab flightId={id!} status={flight.status} act={act} gates={gates} />}
      {tab === "BAGGAGE" && <BaggageTab flightId={id!} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ops-border/40 py-1">
      <span className="text-ops-dim">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BoardingTab({ flightId, refreshParent }: { flightId: string; refreshParent: () => void }) {
  const [summary, setSummary] = useState<BoardingSummary | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setSummary(await api.get<BoardingSummary>(`/boarding/${flightId}/summary`));
  }, [flightId]);
  useEffect(() => {
    load();
  }, [load]);

  async function action(path: string, bookingId: string, okMsg: string) {
    try {
      await api.post(`/boarding/${path}/${bookingId}`);
      toast.push({ kind: "success", title: okMsg });
      load();
      refreshParent();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "ACTION FAILED", message: (e as Error).message });
    }
  }

  if (!summary) return <div className="text-ops-dim p-2">LOADING BOARDING DATA...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Total Pax</div>
          <div className="text-xl">{summary.totalPax}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Checked In</div>
          <div className="text-xl">{summary.checkedIn}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Boarded</div>
          <div className="text-xl text-ops-green">{summary.boarded}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Remaining</div>
          <div className="text-xl text-ops-amber">{summary.remaining}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span>PASSENGER BOARDING LIST</span>
        </div>
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>PNR</th>
                <th>Name</th>
                <th>Seat</th>
                <th>Seq</th>
                <th>Group</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.passengers.map((p) => (
                <tr key={p.bookingId}>
                  <td>{p.pnr}</td>
                  <td>{p.name}</td>
                  <td>{p.seat}</td>
                  <td>{p.sequenceNumber ?? "-"}</td>
                  <td>{p.boardingGroup}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="flex gap-1">
                    {p.status !== "BOARDED" && (
                      <button className="btn" onClick={() => action("board", p.bookingId, "PASSENGER BOARDED")}>
                        BOARD
                      </button>
                    )}
                    {p.status === "BOARDED" && (
                      <button className="btn" onClick={() => action("undo", p.bookingId, "BOARDING UNDONE")}>
                        UNDO
                      </button>
                    )}
                    <button className="btn" onClick={() => action("no-show", p.bookingId, "MARKED NO-SHOW")}>
                      NO-SHOW
                    </button>
                    <button className="btn-danger btn" onClick={() => action("offload", p.bookingId, "OFFLOADED")}>
                      OFFLOAD
                    </button>
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

function DepartureTab({ flightId, status, act }: { flightId: string; status: string; act: (p: string, b?: unknown, m?: string) => void }) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);

  const load = useCallback(async () => {
    setChecklist(await api.get<Checklist>(`/flights/${flightId}/checklist`));
  }, [flightId]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="panel p-3 space-y-3 max-w-xl">
      <div className="text-[11px] text-ops-dim uppercase">Departure Checklist</div>
      <div className="space-y-1 text-[13px]">
        {checklist &&
          Object.entries(checklist.checklist).map(([k, v]) => (
            <div key={k} className={v ? "text-ops-green" : "text-ops-red"}>
              [{v ? "✓" : "✗"}] {k.replace(/([A-Z])/g, " $1").trim().toUpperCase()}
            </div>
          ))}
      </div>
      {checklist && checklist.mismatches.length > 0 && (
        <div className="text-ops-amber text-[12px]">⚠ BAG/PASSENGER MISMATCH — resolve in Baggage tab before departure.</div>
      )}
      <button className="btn" onClick={load}>
        REFRESH CHECKLIST
      </button>
      <button
        className="btn-primary btn w-full"
        disabled={!checklist?.ready || status === "DEPARTED"}
        onClick={() => act("/departed", {}, "FLIGHT MARKED DEPARTED")}
      >
        MARK DEPARTED
      </button>
    </div>
  );
}

function ArrivalTab({ flightId, status, act, gates }: { flightId: string; status: string; act: (p: string, b?: unknown, m?: string) => void; gates: Gate[] }) {
  const [gateId, setGateId] = useState("");
  return (
    <div className="panel p-3 space-y-3 max-w-xl">
      <div className="text-[11px] text-ops-dim uppercase">Arrival / Disembarkation — Status: {status}</div>
      <button className="btn" disabled={status !== "DEPARTED"} onClick={() => act("/landed", {}, "FLIGHT LANDED")}>
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
      <button className="btn" onClick={() => act("/disembark/start", {}, "DISEMBARKATION STARTED")}>
        START DISEMBARKATION
      </button>
      <button className="btn" onClick={() => act("/disembark/all", {}, "ALL PASSENGERS DEPLANED")}>
        DEPLANE ALL
      </button>
      <button className="btn" onClick={() => act("/arrival/close", {}, "ARRIVAL CLOSED")}>
        CLOSE ARRIVAL
      </button>
      <button className="btn-primary btn" onClick={() => act("/close", {}, "FLIGHT CLOSED — SUMMARY GENERATED")}>
        CLOSE FLIGHT
      </button>
    </div>
  );
}

function BaggageTab({ flightId }: { flightId: string }) {
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setRecon(await api.get<Reconciliation>(`/baggage/reconcile/${flightId}`));
  }, [flightId]);
  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(bagId: string, status: string) {
    try {
      await api.post(`/baggage/${bagId}/status`, { status });
      toast.push({ kind: "success", title: `BAG -> ${status}` });
      load();
    } catch (e) {
      toast.push({ kind: "error", title: "ACTION FAILED", message: (e as Error).message });
    }
  }

  if (!recon) return <div className="text-ops-dim p-2">LOADING RECONCILIATION...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Checked</div>
          <div className="text-xl">{recon.totalChecked}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Loaded</div>
          <div className="text-xl text-ops-green">{recon.totalLoaded}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Unloaded</div>
          <div className="text-xl text-ops-amber">{recon.unloaded}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Transfer</div>
          <div className="text-xl">{recon.transferBags}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="text-[10px] text-ops-dim uppercase">Mismatches</div>
          <div className="text-xl text-ops-red">{recon.mismatches}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span>PASSENGER-LEVEL RECONCILIATION</span>
        </div>
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Passenger</th>
                <th>PNR</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Boarded</th>
                <th></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recon.rows.map((r) => (
                <tr key={r.bagId}>
                  <td>{r.tagNumber}</td>
                  <td>{r.passenger}</td>
                  <td>{r.pnr}</td>
                  <td>{r.weightKg} KG</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.boarded ? "YES" : "NO"}</td>
                  <td>{r.mismatch && <span className="text-ops-red">⚠ BAG/PASSENGER MISMATCH</span>}</td>
                  <td className="flex gap-1">
                    <button className="btn" onClick={() => setStatus(r.bagId, "HELD")}>
                      HOLD
                    </button>
                    <button className="btn" onClick={() => setStatus(r.bagId, "UNLOADED")}>
                      UNLOAD
                    </button>
                    <button className="btn" onClick={() => setStatus(r.bagId, "LOADED")}>
                      CLEAR
                    </button>
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
