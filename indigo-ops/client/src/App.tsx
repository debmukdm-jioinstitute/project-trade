import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { TerminalHeader } from "./components/TerminalHeader";
import { CommandConsole } from "./components/CommandConsole";
import { GlobalSearch } from "./components/GlobalSearch";
import { ToastProvider } from "./components/Toast";

import Dashboard from "./pages/Dashboard";
import Flights from "./pages/Flights";
import FlightDetail from "./pages/FlightDetail";
import Checkin from "./pages/Checkin";
import Baggage from "./pages/Baggage";
import Vouchers from "./pages/Vouchers";
import Lounge from "./pages/Lounge";
import Boarding from "./pages/Boarding";
import Gates from "./pages/Gates";
import Aircraft from "./pages/Aircraft";
import Departure from "./pages/Departure";
import Arrival from "./pages/Arrival";
import Reports from "./pages/Reports";
import AuditPage from "./pages/AuditPage";
import SystemStatus from "./pages/SystemStatus";
import Verify from "./pages/Verify";
import Transfers from "./pages/Transfers";
import PassengerSearch from "./pages/PassengerSearch";

function AppShell() {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const resolveTarget = useCallback(
    (target: string) => {
      if (target.startsWith("pnr:")) return navigate(`/checkin?pnr=${target.slice(4)}`);
      if (target.startsWith("flight:")) return navigate(`/flights/${target.slice(7)}`);
      if (target.startsWith("search:")) return navigate(`/passengers?q=${encodeURIComponent(target.slice(7))}`);
      if (target.startsWith("verify:")) return navigate(`/verify?payload=${encodeURIComponent(target.slice(7))}`);
      navigate(target);
    },
    [navigate]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setConsoleOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const map: Record<string, string> = {
          F1: "/",
          F2: "/flights",
          F3: "/checkin",
          F4: "/baggage",
          F5: "/boarding",
          F6: "/vouchers",
          F7: "/lounge",
          F8: "/reports",
        };
        if (map[e.key]) {
          e.preventDefault();
          navigate(map[e.key]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <TerminalHeader onNav={navigate} current={location.pathname} />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/flights" element={<Flights />} />
          <Route path="/flights/:id" element={<FlightDetail />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/baggage" element={<Baggage />} />
          <Route path="/vouchers" element={<Vouchers />} />
          <Route path="/lounge" element={<Lounge />} />
          <Route path="/boarding" element={<Boarding />} />
          <Route path="/gates" element={<Gates />} />
          <Route path="/aircraft" element={<Aircraft />} />
          <Route path="/departure" element={<Departure />} />
          <Route path="/arrival" element={<Arrival />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/system-status" element={<SystemStatus />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/passengers" element={<PassengerSearch />} />
        </Routes>
      </div>
      <div className="border-t border-ops-border bg-ops-panel px-3 py-1.5 text-[10px] text-ops-dim flex items-center justify-between">
        <span>INDIGO OPS PROTOTYPE — LOCAL SIMULATION — NO REAL AIRLINE SYSTEMS CONNECTED</span>
        <span>[/] SEARCH &nbsp; [CTRL+K] TERMINAL &nbsp; [F1-F8] MODULES &nbsp; [ESC] CLOSE</span>
      </div>
      {consoleOpen && <CommandConsole onClose={() => setConsoleOpen(false)} onNavigate={(t) => { setConsoleOpen(false); resolveTarget(t); }} />}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={(t) => { setSearchOpen(false); resolveTarget(t); }} />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
