import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";
import { searchPnr } from "../services/bookingService.js";

export const commandRouter = Router();

const HELP_LINES = [
  "AVAILABLE COMMANDS",
  "",
  "HELP                       Show this list",
  "DASHBOARD                  Open operations dashboard",
  "FLIGHTS                    List today's flights",
  "FLIGHT STATUS <NUM>        Show flight status",
  "PNR SEARCH <PNR>           Look up a booking",
  "PASSENGER SEARCH <TEXT>    Universal passenger search",
  "CHECKIN                    Open check-in module",
  "BAGGAGE                    Open baggage module",
  "BAGGAGE EXCESS             Open excess baggage module",
  "VOUCHER                    Open meal voucher module",
  "LOUNGE                     Open lounge pass module",
  "BOARDING                   Open boarding management",
  "GATE                       Open gate management",
  "AIRCRAFT                   List aircraft",
  "DEPARTURE                  Open departure control",
  "ARRIVAL                    Open arrival operations",
  "VERIFY <PAYLOAD>           Verify a document QR reference",
  "REPORT                     Open reports",
  "SYSTEM STATUS              Show engine status",
  "CLEAR                      Clear terminal",
];

export function routeFor(cmd: string): { route: string; args: string } | null {
  const known: Record<string, string> = {
    DASHBOARD: "/",
    FLIGHTS: "/flights",
    CHECKIN: "/checkin",
    BAGGAGE: "/baggage",
    VOUCHER: "/vouchers",
    LOUNGE: "/lounge",
    BOARDING: "/boarding",
    GATE: "/gates",
    AIRCRAFT: "/aircraft",
    DEPARTURE: "/departure",
    ARRIVAL: "/arrival",
    REPORT: "/reports",
  };
  if (known[cmd]) return { route: known[cmd], args: "" };
  return null;
}

commandRouter.post(
  "/",
  handle(async (req, res) => {
    const raw = String(req.body.command ?? "").trim();
    const upper = raw.toUpperCase();
    const lines: string[] = [];
    let navigate: string | null = null;

    if (!raw) {
      res.json({ lines: [], navigate });
      return;
    }

    if (upper === "HELP") {
      lines.push(...HELP_LINES);
    } else if (upper === "CLEAR") {
      res.json({ lines: [], navigate: null, clear: true });
      return;
    } else if (upper === "SYSTEM STATUS") {
      navigate = "/system-status";
      lines.push("OPENING SYSTEM STATUS...");
    } else if (upper.startsWith("PNR SEARCH")) {
      const pnr = raw.split(/\s+/).slice(2).join("").toUpperCase();
      const booking = await searchPnr(pnr);
      if (!booking) {
        lines.push(`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr}.`);
      } else {
        const excess = booking.baggageCharges[0];
        lines.push(
          `PNR: ${booking.pnr}`,
          `PASSENGER: ${booking.passenger.name.toUpperCase()}`,
          `FLIGHT: ${booking.flight.flightNumber}`,
          `ROUTE: ${booking.flight.origin} -> ${booking.flight.destination}`,
          `SEAT: ${booking.seat?.seatNumber ?? "NOT ASSIGNED"}`,
          `CHECK-IN: ${booking.checkedIn ? "COMPLETE" : "PENDING"}`,
          `BAGGAGE: ${booking.baggage.reduce((s, b) => s + b.weightKg, 0)} KG`,
          `EXCESS: ${excess ? excess.excessKg + " KG (₹" + excess.totalCharge + ")" : "NONE"}`,
          `BOARDING: ${booking.boarded ? "COMPLETE" : "PENDING"}`
        );
        navigate = `pnr:${booking.pnr}`;
      }
    } else if (upper.startsWith("PASSENGER SEARCH")) {
      const term = raw.split(/\s+/).slice(2).join(" ");
      navigate = `search:${term}`;
      lines.push(`SEARCHING FOR "${term}"...`);
    } else if (upper.startsWith("FLIGHT STATUS")) {
      const num = raw.split(/\s+/).slice(2).join("").toUpperCase();
      const flight = await prisma.flight.findFirst({ where: { flightNumber: num }, include: { gate: true, aircraft: true } });
      if (!flight) {
        lines.push(`ERROR [OPS-404]`, "", "FLIGHT NOT FOUND", "", `No flight ${num} found.`);
      } else {
        lines.push(
          `FLIGHT: ${flight.flightNumber}`,
          `ROUTE: ${flight.origin} -> ${flight.destination}`,
          `AIRCRAFT: ${flight.aircraft?.registration ?? "UNASSIGNED"}`,
          `STD: ${flight.std}   ETD: ${flight.etd ?? "-"}`,
          `GATE: ${flight.gate?.code ?? "UNASSIGNED"}`,
          `STATUS: ${flight.status}`
        );
        navigate = `flight:${flight.id}`;
      }
    } else if (upper.startsWith("VERIFY")) {
      const payload = raw.split(/\s+/).slice(1).join(" ");
      navigate = `verify:${payload}`;
      lines.push(`VERIFYING "${payload}"...`);
    } else if (upper === "FLIGHTS" || routeFor(upper)) {
      const r = routeFor(upper);
      navigate = r ? r.route : "/flights";
      lines.push(`OPENING ${upper}...`);
    } else {
      lines.push(`ERROR [OPS-000]`, "", "UNKNOWN COMMAND", "", `"${raw}" is not recognized. Type HELP for a list of commands.`);
    }

    res.json({ lines, navigate });
  })
);
