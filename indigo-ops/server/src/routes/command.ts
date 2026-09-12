import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";
import { OpsError } from "../lib/errors.js";
import { searchPnr, checkIn, assignSeat } from "../services/bookingService.js";
import { boardPassenger, undoBoard, markNoShow, generateBoardingPass } from "../services/boardingService.js";
import { acceptBaggage, markChargePaid } from "../services/baggageService.js";
import { issueMealVoucher, issueLoungePass } from "../services/voucherService.js";
import * as flightService from "../services/flightService.js";

export const commandRouter = Router();

const HELP_LINES = [
  "OPERATIONS COMMAND TERMINAL — FULL COMMAND REFERENCE",
  "",
  "NAVIGATION",
  "  HELP                            Show this list",
  "  DASHBOARD                       Open operations dashboard",
  "  FLIGHTS                         List today's flights",
  "  CHECKIN                         Open check-in module",
  "  BAGGAGE                         Open baggage module",
  "  VOUCHER                         Open meal voucher module",
  "  LOUNGE                          Open lounge pass module",
  "  BOARDING                        Open boarding management",
  "  GATE                            Open gate management",
  "  AIRCRAFT                        List aircraft",
  "  DEPARTURE                       Open departure control",
  "  ARRIVAL                         Open arrival operations",
  "  REPORT                          Open reports",
  "  SYSTEM STATUS                   Show engine status",
  "  CLEAR                           Clear terminal",
  "",
  "LOOKUP",
  "  PNR SEARCH <PNR>                Look up a booking",
  "  PASSENGER SEARCH <TEXT>         Universal passenger search",
  "  FLIGHT STATUS <NUM>             Show flight status",
  "  VERIFY <PAYLOAD>                Verify a document QR reference",
  "  AUDIT <REF>                     Show audit trail for a PNR/flight",
  "",
  "PASSENGER ACTIONS",
  "  CHECKIN <PNR>                   Check in a passenger",
  "  SEAT <PNR> <SEAT>               Assign a seat",
  "  BAGGAGE ADD <PNR> <KG>          Accept baggage, auto-calc excess",
  "  BAGGAGE PAY <PNR>               Mark pending excess baggage paid",
  "  VOUCHER ISSUE <PNR> [TYPE]      Issue a meal voucher",
  "  LOUNGE ISSUE <PNR>              Issue a lounge pass",
  "  BOARDING PASS <PNR>             Generate boarding pass",
  "  BOARD <PNR>                     Board a passenger",
  "  UNDO BOARD <PNR>                Undo boarding",
  "  NOSHOW <PNR>                    Mark passenger no-show",
  "",
  "FLIGHT ACTIONS",
  "  CHECKIN OPEN <NUM>              Open check-in for a flight",
  "  CHECKIN CLOSE <NUM>             Close check-in for a flight",
  "  BOARDING OPEN <NUM>             Open boarding for a flight",
  "  BOARDING FINAL CALL <NUM>       Issue final call",
  "  GATE ASSIGN <NUM> <GATE>        Assign a gate to a flight",
  "  GATE CLOSE <NUM>                Close the gate",
  "  FLIGHT DELAY <NUM> [MIN]        Delay a flight (default 15 min)",
  "  FLIGHT CANCEL <NUM>             Cancel a flight",
  "  FLIGHT DEPART <NUM>             Mark flight departed",
  "  FLIGHT LAND <NUM>               Mark flight landed",
  "  FLIGHT CLOSE <NUM>              Close flight & generate summary",
];

function errorLines(err: unknown): string[] {
  if (err instanceof OpsError) {
    return [`ERROR [${err.code}]`, "", err.title, "", err.message];
  }
  return ["ERROR", "", (err as Error).message ?? "Unknown error"];
}

async function bookingSummaryLines(pnr: string): Promise<string[]> {
  const booking = await searchPnr(pnr);
  if (!booking) {
    return [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
  }
  const excess = booking.baggageCharges[booking.baggageCharges.length - 1];
  return [
    `PNR: ${booking.pnr}`,
    `PASSENGER: ${booking.passenger.name.toUpperCase()}`,
    `FLIGHT: ${booking.flight.flightNumber}`,
    `ROUTE: ${booking.flight.origin} -> ${booking.flight.destination}`,
    `SEAT: ${booking.seat?.seatNumber ?? "NOT ASSIGNED"}`,
    `CHECK-IN: ${booking.checkedIn ? "COMPLETE" : "PENDING"}`,
    `BAGGAGE: ${booking.baggage.reduce((s, b) => s + b.weightKg, 0)} KG`,
    `EXCESS: ${excess ? excess.excessKg + " KG (₹" + excess.totalCharge + ", " + excess.paymentStatus + ")" : "NONE"}`,
    `MEAL VOUCHERS: ${booking.mealVouchers.length}`,
    `LOUNGE PASSES: ${booking.loungePasses.length}`,
    `BOARDING PASS: ${booking.boardingPasses.find((b) => b.status === "VALID") ? "VALID" : "NONE"}`,
    `BOARDING: ${booking.boarded ? "COMPLETE" : booking.noShow ? "NO-SHOW" : "PENDING"}`,
  ];
}

async function findFlightByNumber(num: string) {
  return prisma.flight.findFirst({ where: { flightNumber: num.toUpperCase() }, include: { gate: true, aircraft: true } });
}

function flightNotFound(num: string): string[] {
  return [`ERROR [OPS-404]`, "", "FLIGHT NOT FOUND", "", `No flight ${num.toUpperCase()} found.`];
}

function flightStatusLines(flight: NonNullable<Awaited<ReturnType<typeof findFlightByNumber>>>): string[] {
  return [
    `FLIGHT: ${flight.flightNumber}`,
    `ROUTE: ${flight.origin} -> ${flight.destination}`,
    `AIRCRAFT: ${flight.aircraft?.registration ?? "UNASSIGNED"}`,
    `STD: ${flight.std}   ETD: ${flight.etd ?? "-"}`,
    `GATE: ${flight.gate?.code ?? "UNASSIGNED"}`,
    `STATUS: ${flight.status}`,
  ];
}

commandRouter.post(
  "/",
  handle(async (req, res) => {
    const raw = String(req.body.command ?? "").trim();
    if (!raw) return res.json({ lines: [], navigate: null });

    const words = raw.split(/\s+/);
    const w = words.map((x) => x.toUpperCase());
    const rest = (n: number) => words.slice(n).join(" ");

    let lines: string[] = [];
    let navigate: string | null = null;

    try {
      if (w[0] === "HELP") {
        lines = HELP_LINES;
      } else if (w[0] === "CLEAR") {
        return res.json({ lines: [], navigate: null, clear: true });
      } else if (w[0] === "SYSTEM" && w[1] === "STATUS") {
        navigate = "/system-status";
        lines = ["OPENING SYSTEM STATUS..."];
      } else if (w[0] === "PNR" && w[1] === "SEARCH") {
        const pnr = words[2] ?? "";
        lines = await bookingSummaryLines(pnr);
        if (!lines[0].startsWith("ERROR")) navigate = `pnr:${pnr.toUpperCase()}`;
      } else if (w[0] === "PASSENGER" && w[1] === "SEARCH") {
        const term = rest(2);
        navigate = `search:${term}`;
        lines = [`SEARCHING FOR "${term}"...`];
      } else if (w[0] === "FLIGHT" && w[1] === "STATUS") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          lines = flightStatusLines(flight);
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "FLIGHT" && w[1] === "DELAY") {
        const num = words[2] ?? "";
        const minutes = Number(words[3] ?? 15) || 15;
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.delayFlight(flight.id, minutes);
          lines = [`FLIGHT ${flight.flightNumber} DELAYED ${minutes} MIN.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "FLIGHT" && w[1] === "CANCEL") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.cancelFlight(flight.id);
          lines = [`FLIGHT ${flight.flightNumber} CANCELLED.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "FLIGHT" && w[1] === "DEPART") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.markDeparted(flight.id);
          lines = [`FLIGHT ${flight.flightNumber} MARKED DEPARTED.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "FLIGHT" && w[1] === "LAND") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.markLanded(flight.id);
          lines = [`FLIGHT ${flight.flightNumber} MARKED LANDED.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "FLIGHT" && w[1] === "CLOSE") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          const summary = await flightService.closeFlight(flight.id);
          lines = [
            `FLIGHT ${summary.flightNumber} CLOSED.`,
            "",
            `ROUTE: ${summary.route}`,
            `PASSENGERS: ${summary.totalPassengers}   BOARDED: ${summary.boarded}   NO-SHOW: ${summary.noShow}`,
            `BAGS: ${summary.totalBags}   CLAIMED: ${summary.bagsClaimed}`,
          ];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "CHECKIN" && w[1] === "OPEN") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.openCheckin(flight.id);
          lines = [`CHECK-IN OPENED FOR ${flight.flightNumber}.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "CHECKIN" && w[1] === "CLOSE") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.closeCheckin(flight.id);
          lines = [`CHECK-IN CLOSED FOR ${flight.flightNumber}.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "CHECKIN" && words.length >= 2) {
        const pnr = words[1];
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await checkIn(booking.id);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "CHECKIN") {
        navigate = "/checkin";
        lines = ["OPENING CHECK-IN..."];
      } else if (w[0] === "BOARDING" && w[1] === "OPEN") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.openBoarding(flight.id);
          lines = [`BOARDING OPENED FOR ${flight.flightNumber}.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "BOARDING" && w[1] === "FINAL" && w[2] === "CALL") {
        const num = words[3] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.finalCall(flight.id);
          lines = [`FINAL CALL ISSUED — ${flight.flightNumber}.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "BOARDING" && w[1] === "PASS") {
        const pnr = words[2] ?? "";
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await generateBoardingPass(booking.id);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "BOARDING") {
        navigate = "/boarding";
        lines = ["OPENING BOARDING..."];
      } else if (w[0] === "BOARD" && words.length >= 2) {
        const pnr = words[1];
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await boardPassenger(booking.id);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "UNDO" && w[1] === "BOARD") {
        const pnr = words[2] ?? "";
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await undoBoard(booking.id);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "NOSHOW" && words.length >= 2) {
        const pnr = words[1];
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await markNoShow(booking.id);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "SEAT" && words.length >= 3) {
        const pnr = words[1];
        const seat = words[2].toUpperCase();
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await assignSeat(booking.id, seat);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "GATE" && w[1] === "ASSIGN") {
        const num = words[2] ?? "";
        const gateCode = (words[3] ?? "").toUpperCase();
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          const gate = await prisma.gate.findFirst({ where: { code: gateCode } });
          if (!gate) lines = [`ERROR [OPS-404]`, "", "GATE NOT FOUND", "", `No gate ${gateCode} found.`];
          else {
            await (flight.gateId ? flightService.changeGate(flight.id, gate.id) : flightService.assignGate(flight.id, gate.id));
            lines = [`GATE ${gate.code} ASSIGNED TO ${flight.flightNumber}.`];
            navigate = `flight:${flight.id}`;
          }
        }
      } else if (w[0] === "GATE" && w[1] === "CLOSE") {
        const num = words[2] ?? "";
        const flight = await findFlightByNumber(num);
        if (!flight) lines = flightNotFound(num);
        else {
          await flightService.closeGate(flight.id);
          lines = [`GATE CLOSED — ${flight.flightNumber}.`];
          navigate = `flight:${flight.id}`;
        }
      } else if (w[0] === "GATE") {
        navigate = "/gates";
        lines = ["OPENING GATE MANAGEMENT..."];
      } else if (w[0] === "BAGGAGE" && w[1] === "ADD") {
        const pnr = words[2] ?? "";
        const kg = Number(words[3]);
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else if (!kg || kg <= 0) lines = ["ERROR", "", "INVALID WEIGHT", "", "Usage: BAGGAGE ADD <PNR> <KG>"];
        else {
          await acceptBaggage(booking.id, kg);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "BAGGAGE" && w[1] === "PAY") {
        const pnr = words[2] ?? "";
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          const pending = booking.baggageCharges.find((c) => c.paymentStatus === "PENDING");
          if (!pending) lines = ["NO PENDING EXCESS BAGGAGE CHARGE FOR THIS PNR."];
          else {
            await markChargePaid(pending.id);
            lines = await bookingSummaryLines(pnr);
          }
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "BAGGAGE") {
        navigate = "/baggage";
        lines = ["OPENING BAGGAGE..."];
      } else if (w[0] === "VOUCHER" && w[1] === "ISSUE") {
        const pnr = words[2] ?? "";
        const mealType = (words[3] ?? "STANDARD").toUpperCase();
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await issueMealVoucher(booking.id, mealType);
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "VOUCHER") {
        navigate = "/vouchers";
        lines = ["OPENING VOUCHER MODULE..."];
      } else if (w[0] === "LOUNGE" && w[1] === "ISSUE") {
        const pnr = words[2] ?? "";
        const booking = await searchPnr(pnr);
        if (!booking) lines = [`ERROR [OPS-404]`, "", "PNR NOT FOUND", "", `No booking found for PNR ${pnr.toUpperCase()}.`];
        else {
          await issueLoungePass(booking.id, {});
          lines = await bookingSummaryLines(pnr);
          navigate = `pnr:${pnr.toUpperCase()}`;
        }
      } else if (w[0] === "LOUNGE") {
        navigate = "/lounge";
        lines = ["OPENING LOUNGE MODULE..."];
      } else if (w[0] === "AIRCRAFT") {
        navigate = "/aircraft";
        lines = ["OPENING AIRCRAFT..."];
      } else if (w[0] === "DEPARTURE") {
        navigate = "/departure";
        lines = ["OPENING DEPARTURE CONTROL..."];
      } else if (w[0] === "ARRIVAL") {
        navigate = "/arrival";
        lines = ["OPENING ARRIVAL OPERATIONS..."];
      } else if (w[0] === "VERIFY") {
        const payload = rest(1);
        navigate = `verify:${payload}`;
        lines = [`VERIFYING "${payload}"...`];
      } else if (w[0] === "AUDIT" && words.length >= 2) {
        const ref = words[1];
        const logs = await prisma.auditLog.findMany({
          where: { reference: { contains: ref.toUpperCase() } },
          orderBy: { timestamp: "desc" },
          take: 15,
        });
        lines =
          logs.length === 0
            ? [`NO AUDIT ENTRIES FOR "${ref.toUpperCase()}".`]
            : logs.map((l) => `${l.timestamp.toISOString().slice(11, 19)}  ${l.category.padEnd(10)}  ${l.message}`);
      } else if (w[0] === "REPORT") {
        navigate = "/reports";
        lines = ["OPENING REPORTS..."];
      } else if (w[0] === "FLIGHTS") {
        navigate = "/flights";
        lines = ["OPENING FLIGHTS..."];
      } else if (w[0] === "DASHBOARD") {
        navigate = "/";
        lines = ["OPENING DASHBOARD..."];
      } else {
        lines = [`ERROR [OPS-000]`, "", "UNKNOWN COMMAND", "", `"${raw}" is not recognized. Type HELP for a list of commands.`];
      }
    } catch (err) {
      lines = errorLines(err);
    }

    res.json({ lines, navigate });
  })
);
