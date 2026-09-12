import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { BookingWorkspace } from "./BookingWorkspace";

interface SearchResult {
  kind: string;
  label: string;
  sub: string;
  bookingId: string | null;
  href: string;
}

interface Profile {
  booking: any;
  timeline: { step: string; reached: boolean }[];
  connectionAlert: string | null;
}

// Prominent dashboard-level search: name, phone, email, PNR, baggage tag,
// boarding pass / voucher / lounge pass number, or any system-generated ID.
// Selecting a result loads the full customer/booking detail inline, right
// on the dashboard, using the same workspace as the Check-in module.
export function GlobalCustomerSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const data = await api.get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`);
      setResults(data.results);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function loadProfile(bookingId: string) {
    setOpen(false);
    setLoading(true);
    setNotFound(false);
    try {
      const data = await api.get<Profile>(`/passengers/${bookingId}/profile`);
      setProfile(data);
    } catch {
      setProfile(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function selectResult(r: SearchResult) {
    if (r.kind === "FLIGHT") {
      setOpen(false);
      navigate(r.href.replace("flight:", "/flights/"));
      return;
    }
    if (r.bookingId) loadProfile(r.bookingId);
  }

  function refresh() {
    if (profile) loadProfile(profile.booking.id);
  }

  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative">
        <div className="panel p-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="SEARCH CUSTOMER — name, phone, email, PNR, baggage tag, boarding pass / voucher / lounge no., or any system ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) selectResult(results[0]);
              if (e.key === "Escape") setOpen(false);
            }}
            autoComplete="off"
          />
          <button className="btn-primary btn" disabled={!results[0]} onClick={() => results[0] && selectResult(results[0])}>
            SEARCH
          </button>
        </div>

        {open && results.length > 0 && (
          <div className="absolute z-[60] mt-1 w-full panel max-h-80 overflow-y-auto shadow-2xl">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2 border-b border-ops-border/60 hover:bg-ops-panel2 flex items-center justify-between"
              >
                <div>
                  <div className="text-ops-text text-[12px]">{r.label}</div>
                  <div className="text-ops-dim text-[11px]">{r.sub}</div>
                </div>
                <span className="badge badge-dim">{r.kind}</span>
              </button>
            ))}
          </div>
        )}
        {open && q.trim() && results.length === 0 && (
          <div className="absolute z-[60] mt-1 w-full panel p-3 text-ops-dim text-[12px]">NO RESULTS FOR "{q}"</div>
        )}
      </div>

      {loading && <div className="panel p-3 text-ops-dim text-[12px]">LOADING CUSTOMER RECORD...</div>}
      {notFound && <div className="panel p-3 text-ops-red text-[12px]">ERROR [OPS-404] — RECORD NOT FOUND</div>}

      {profile && (
        <BookingWorkspace
          booking={profile.booking}
          timeline={profile.timeline}
          connectionAlert={profile.connectionAlert}
          onChange={refresh}
        />
      )}
    </div>
  );
}
