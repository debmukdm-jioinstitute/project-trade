import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, Booking, FlightRow } from "../lib/api";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { BookingWorkspace } from "../components/BookingWorkspace";

export default function Checkin() {
  const [params, setParams] = useSearchParams();
  const [pnrInput, setPnrInput] = useState(params.get("pnr") ?? "");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [timeline, setTimeline] = useState<{ step: string; reached: boolean }[] | null>(null);
  const [connectionAlert, setConnectionAlert] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const toast = useToast();

  const search = useCallback(async (pnr: string) => {
    if (!pnr.trim()) return;
    setNotFound(false);
    try {
      const b = await api.get<Booking>(`/bookings/pnr/${pnr.toUpperCase()}`);
      setBooking(b);
      const profile = await api.get<{ timeline: any[]; connectionAlert: string | null }>(`/passengers/${b.id}/profile`);
      setTimeline(profile.timeline);
      setConnectionAlert(profile.connectionAlert);
    } catch (e) {
      setBooking(null);
      setNotFound(true);
      toast.push({ kind: "error", title: "PNR NOT FOUND", message: (e as Error).message });
    }
  }, [toast]);

  useEffect(() => {
    const p = params.get("pnr");
    if (p) {
      setPnrInput(p);
      search(p);
    }
  }, [params, search]);

  function refresh() {
    if (booking) search(booking.pnr);
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-ops-dim text-[11px] tracking-widest uppercase">CHECK-IN / PNR / BOOKING WORKSPACE</div>
        <button className="btn-primary btn" onClick={() => setShowCreate(true)}>
          + CREATE BOOKING
        </button>
      </div>

      <div className="panel p-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="ENTER PNR e.g. A7K9PQ"
          value={pnrInput}
          onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && setParams({ pnr: pnrInput })}
        />
        <button className="btn-primary btn" onClick={() => setParams({ pnr: pnrInput })}>
          SEARCH PNR
        </button>
      </div>

      {notFound && <div className="panel p-3 text-ops-red text-[12px]">ERROR [OPS-404] — PNR NOT FOUND</div>}

      {booking && timeline && (
        <BookingWorkspace booking={booking} timeline={timeline} connectionAlert={connectionAlert} onChange={refresh} />
      )}

      {showCreate && <CreateBookingModal onClose={() => setShowCreate(false)} onCreated={(pnr) => { setShowCreate(false); setParams({ pnr }); }} />}
    </div>
  );
}

function CreateBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (pnr: string) => void }) {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [flightId, setFlightId] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.get<FlightRow[]>("/flights").then(setFlights);
  }, []);

  async function submit() {
    try {
      const booking = await api.post<Booking>("/bookings", {
        flightId,
        passenger: { name, mobile, email },
      });
      toast.push({ kind: "success", title: `BOOKING CREATED — PNR ${booking.pnr}` });
      onCreated(booking.pnr);
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "BOOKING FAILED", message: (e as Error).message });
    }
  }

  return (
    <Modal title="CREATE BOOKING" onClose={onClose}>
      <div className="space-y-2 text-[12px]">
        <select className="input w-full" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
          <option value="">SELECT FLIGHT</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} {f.origin}→{f.destination} ({f.departureDate} {f.std})
            </option>
          ))}
        </select>
        <input className="input w-full" placeholder="PASSENGER NAME" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input w-full" placeholder="MOBILE" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <input className="input w-full" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-primary btn w-full" disabled={!flightId || !name} onClick={submit}>
          CREATE BOOKING
        </button>
      </div>
    </Modal>
  );
}
