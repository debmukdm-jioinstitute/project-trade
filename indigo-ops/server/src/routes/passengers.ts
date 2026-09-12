import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const passengersRouter = Router();

function timelineFor(b: {
  status: string;
  checkedIn: boolean;
  baggage: { status: string }[];
  loungePasses: { status: string }[];
  boarded: boolean;
  deplaned: boolean;
}) {
  const steps = ["BOOKED", "CHECK-IN", "BAG DROP", "SECURITY", "LOUNGE", "GATE", "BOARDING", "ONBOARD", "DEPLANED"];
  const reached = {
    "BOOKED": b.status !== "CANCELLED",
    "CHECK-IN": b.checkedIn,
    "BAG DROP": b.baggage.some((bg) => bg.status !== "CREATED"),
    "SECURITY": b.baggage.some((bg) => bg.status === "SECURITY_CLEARED" || bg.status === "SORTED" || bg.status === "LOADED"),
    "LOUNGE": b.loungePasses.some((l) => l.status === "USED"),
    "GATE": b.checkedIn,
    "BOARDING": b.boarded,
    "ONBOARD": b.boarded && !b.deplaned,
    "DEPLANED": b.deplaned,
  } as Record<string, boolean>;
  return steps.map((s) => ({ step: s, reached: reached[s] }));
}

// Universal passenger search: PNR, name, booking id, mobile, bag tag, boarding pass no.
passengersRouter.get(
  "/search",
  handle(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const qUpper = q.toUpperCase();
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { pnr: qUpper },
          { id: q },
          { passenger: { name: { contains: q } } },
          { passenger: { mobile: { contains: q } } },
          { passenger: { passportNo: { contains: qUpper } } },
          { baggage: { some: { tagNumber: { contains: qUpper } } } },
          { boardingPasses: { some: { documentNo: { contains: qUpper } } } },
        ],
      },
      include: { passenger: true, flight: true, seat: true },
      take: 20,
    });
    res.json(bookings);
  })
);

passengersRouter.get(
  "/:bookingId/profile",
  handle(async (req, res) => {
    const b = await prisma.booking.findUniqueOrThrow({
      where: { id: req.params.bookingId },
      include: {
        passenger: true,
        flight: { include: { gate: true } },
        seat: true,
        baggage: true,
        baggageCharges: true,
        mealVouchers: true,
        loungePasses: true,
        boardingPasses: { orderBy: { createdAt: "desc" } },
        specialServices: true,
        transfer: { include: { outboundFlight: { include: { gate: true } } } },
      },
    });

    let connectionAlert = null;
    if (b.transfer) {
      const short = b.transfer.connectionMinutes < 60;
      if (short) {
        connectionAlert = `CONNECTION ALERT — Passenger has ${b.transfer.connectionMinutes} minutes to next departure.`;
      }
    }

    res.json({
      booking: b,
      timeline: timelineFor(b),
      connectionAlert,
    });
  })
);

export const transfersRouter = Router();

transfersRouter.get(
  "/",
  handle(async (req, res) => {
    const transfers = await prisma.transferPassenger.findMany({
      include: {
        booking: { include: { passenger: true } },
        inboundFlight: true,
        outboundFlight: { include: { gate: true } },
      },
    });
    res.json(
      transfers.map((t) => ({
        pnr: t.booking.pnr,
        passenger: t.booking.passenger.name,
        inboundFlight: t.inboundFlight.flightNumber,
        outboundFlight: t.outboundFlight.flightNumber,
        connectionMinutes: t.connectionMinutes,
        nextGate: t.outboundFlight.gate?.code ?? "-",
        shortConnection: t.connectionMinutes < 60,
        boardingStatus: t.booking.boarded ? "BOARDED" : t.booking.checkedIn ? "CHECKED-IN" : "PENDING",
      }))
    );
  })
);
