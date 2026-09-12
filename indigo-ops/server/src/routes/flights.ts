import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import * as flightService from "../services/flightService.js";
import { checkIn } from "../services/bookingService.js";
import { generateBoardingPass } from "../services/boardingService.js";
import { audit } from "../lib/audit.js";
import { OpsError } from "../lib/errors.js";
import { handle } from "../lib/handle.js";

export const flightsRouter = Router();

async function flightWithCounters(flightId: string) {
  const flight = await prisma.flight.findUnique({
    where: { id: flightId },
    include: { aircraft: true, gate: true, bookings: { include: { baggage: true } } },
  });
  if (!flight) return null;
  const active = flight.bookings.filter((b) => b.status !== "CANCELLED");
  return {
    ...flight,
    passengerCount: active.length,
    checkedInCount: active.filter((b) => b.checkedIn).length,
    boardedCount: active.filter((b) => b.boarded).length,
    bagCount: active.flatMap((b) => b.baggage).length,
    bookings: undefined,
  };
}

flightsRouter.get(
  "/",
  handle(async (req, res) => {
    const { date, status } = req.query as { date?: string; status?: string };
    const flights = await prisma.flight.findMany({
      where: {
        ...(date ? { departureDate: date } : {}),
        ...(status ? { status } : {}),
      },
      include: { aircraft: true, gate: true, bookings: { include: { baggage: true } } },
      orderBy: [{ departureDate: "asc" }, { std: "asc" }],
    });
    const enriched = flights.map((f) => {
      const active = f.bookings.filter((b) => b.status !== "CANCELLED");
      return {
        ...f,
        passengerCount: active.length,
        checkedInCount: active.filter((b) => b.checkedIn).length,
        boardedCount: active.filter((b) => b.boarded).length,
        bagCount: active.flatMap((b) => b.baggage).length,
        bookings: undefined,
      };
    });
    res.json(enriched);
  })
);

flightsRouter.get(
  "/:id",
  handle(async (req, res) => {
    const flight = await flightWithCounters(req.params.id);
    if (!flight) return res.status(404).json({ error: { code: "OPS-404", title: "NOT FOUND", message: "Flight not found." } });
    res.json(flight);
  })
);

flightsRouter.get(
  "/:id/seatmap",
  handle(async (req, res) => {
    const seats = await prisma.seat.findMany({
      where: { flightId: req.params.id },
      orderBy: { seatNumber: "asc" },
      include: { booking: { include: { passenger: true } } },
    });
    res.json(seats);
  })
);

flightsRouter.get(
  "/:id/checklist",
  handle(async (req, res) => {
    res.json(await flightService.departureChecklist(req.params.id));
  })
);

flightsRouter.post(
  "/",
  handle(async (req, res) => {
    const flight = await flightService.createFlight(req.body);
    res.status(201).json(flight);
  })
);

flightsRouter.patch(
  "/:id",
  handle(async (req, res) => {
    const flight = await prisma.flight.update({ where: { id: req.params.id }, data: req.body });
    res.json(flight);
  })
);

flightsRouter.post(
  "/:id/aircraft",
  handle(async (req, res) => {
    res.json(await flightService.assignAircraft(req.params.id, req.body.aircraftId));
  })
);

flightsRouter.post(
  "/:id/gate",
  handle(async (req, res) => {
    res.json(await flightService.assignGate(req.params.id, req.body.gateId));
  })
);

flightsRouter.post(
  "/:id/gate/change",
  handle(async (req, res) => {
    res.json(await flightService.changeGate(req.params.id, req.body.gateId));
  })
);

flightsRouter.post(
  "/:id/delay",
  handle(async (req, res) => {
    res.json(await flightService.delayFlight(req.params.id, req.body.minutes ?? 15, req.body.etd));
  })
);

flightsRouter.post(
  "/:id/cancel",
  handle(async (req, res) => {
    res.json(await flightService.cancelFlight(req.params.id));
  })
);

flightsRouter.post(
  "/:id/checkin/open",
  handle(async (req, res) => {
    res.json(await flightService.openCheckin(req.params.id));
  })
);

flightsRouter.post(
  "/:id/checkin/close",
  handle(async (req, res) => {
    res.json(await flightService.closeCheckin(req.params.id));
  })
);

flightsRouter.post(
  "/:id/boarding/open",
  handle(async (req, res) => {
    res.json(await flightService.openBoarding(req.params.id));
  })
);

flightsRouter.post(
  "/:id/boarding/final-call",
  handle(async (req, res) => {
    res.json(await flightService.finalCall(req.params.id));
  })
);

flightsRouter.post(
  "/:id/gate/close",
  handle(async (req, res) => {
    res.json(await flightService.closeGate(req.params.id));
  })
);

flightsRouter.post(
  "/:id/departed",
  handle(async (req, res) => {
    res.json(await flightService.markDeparted(req.params.id));
  })
);

flightsRouter.post(
  "/:id/landed",
  handle(async (req, res) => {
    res.json(await flightService.markLanded(req.params.id));
  })
);

flightsRouter.post(
  "/:id/arrival-gate",
  handle(async (req, res) => {
    res.json(await flightService.assignArrivalGate(req.params.id, req.body.gateId));
  })
);

flightsRouter.post(
  "/:id/disembark/start",
  handle(async (req, res) => {
    res.json(await flightService.startDisembarkation(req.params.id));
  })
);

flightsRouter.post(
  "/:id/disembark/all",
  handle(async (req, res) => {
    const count = await flightService.deplaneAll(req.params.id);
    res.json({ deplaned: count });
  })
);

flightsRouter.post(
  "/:id/arrival/close",
  handle(async (req, res) => {
    res.json(await flightService.closeArrival(req.params.id));
  })
);

flightsRouter.post(
  "/:id/close",
  handle(async (req, res) => {
    res.json(await flightService.closeFlight(req.params.id));
  })
);

// ---- Universal bulk operations (one-click ops for large passenger loads) ----

flightsRouter.post(
  "/:id/checkin-all",
  handle(async (req, res) => {
    const flightId = req.params.id;
    const bookings = await prisma.booking.findMany({
      where: { flightId, status: { not: "CANCELLED" }, checkedIn: false },
    });
    let checkedIn = 0;
    const failed: { pnr: string; message: string }[] = [];
    for (const b of bookings) {
      try {
        await checkIn(b.id);
        checkedIn++;
      } catch (err) {
        failed.push({ pnr: b.pnr, message: err instanceof OpsError ? err.message : "Failed" });
        if (err instanceof OpsError) break; // flight-level gate (e.g. check-in not open) — no point retrying the rest
      }
    }
    await audit("CHECKIN", `BULK CHECK-IN — ${checkedIn} PASSENGER(S) CHECKED IN`, undefined);
    res.json({ checkedIn, alreadyDone: 0, skipped: failed.length, failed });
  })
);

flightsRouter.post(
  "/:id/security-clear-all",
  handle(async (req, res) => {
    const flightId = req.params.id;
    const { count } = await prisma.baggage.updateMany({
      where: { flightId, status: { in: ["CREATED", "ACCEPTED"] } },
      data: { status: "SECURITY_CLEARED" },
    });
    const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
    await audit("BAGGAGE", `BULK SECURITY CLEARANCE — ${count} BAG(S) CLEARED`, flight.flightNumber);
    res.json({ cleared: count });
  })
);

flightsRouter.get(
  "/:id/customers",
  handle(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { flightId: req.params.id, status: { not: "CANCELLED" } },
      include: { passenger: true, seat: true, baggage: true, boardingPasses: true },
      orderBy: [{ sequenceNumber: "asc" }],
    });
    res.json(
      bookings.map((b) => ({
        bookingId: b.id,
        pnr: b.pnr,
        name: b.passenger.name,
        seat: b.seat?.seatNumber ?? "-",
        checkedIn: b.checkedIn,
        boarded: b.boarded,
        noShow: b.noShow,
        securityCleared: b.baggage.length === 0 || b.baggage.every((bg) => bg.status !== "CREATED" && bg.status !== "ACCEPTED"),
        boardingPass: b.boardingPasses.some((bp) => bp.status === "VALID"),
      }))
    );
  })
);
