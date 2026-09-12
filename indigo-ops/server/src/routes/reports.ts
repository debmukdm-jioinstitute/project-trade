import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const reportsRouter = Router();

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function respond(req: any, res: any, rows: Record<string, unknown>[], filename: string) {
  if (req.query.format === "csv") {
    res.type("text/csv").attachment(`${filename}.csv`).send(toCsv(rows));
  } else {
    res.json(rows);
  }
}

reportsRouter.get(
  "/daily-flights",
  handle(async (req, res) => {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    const flights = await prisma.flight.findMany({
      where: { departureDate: date },
      include: { aircraft: true, gate: true, bookings: true },
      orderBy: { std: "asc" },
    });
    const rows = flights.map((f) => ({
      flightNumber: f.flightNumber,
      route: `${f.origin}-${f.destination}`,
      aircraft: f.aircraft?.registration ?? "-",
      std: f.std,
      etd: f.etd,
      gate: f.gate?.code ?? "-",
      status: f.status,
      passengers: f.bookings.filter((b) => b.status !== "CANCELLED").length,
    }));
    respond(req, res, rows, `daily-flights-${date}`);
  })
);

reportsRouter.get(
  "/passengers",
  handle(async (req, res) => {
    const { flightId } = req.query as { flightId?: string };
    const bookings = await prisma.booking.findMany({
      where: flightId ? { flightId } : {},
      include: { passenger: true, flight: true, seat: true },
    });
    const rows = bookings.map((b) => ({
      pnr: b.pnr,
      passenger: b.passenger.name,
      flight: b.flight.flightNumber,
      seat: b.seat?.seatNumber ?? "-",
      status: b.status,
      checkedIn: b.checkedIn,
      boarded: b.boarded,
      noShow: b.noShow,
    }));
    respond(req, res, rows, "passengers");
  })
);

reportsRouter.get(
  "/baggage",
  handle(async (req, res) => {
    const { flightId } = req.query as { flightId?: string };
    const bags = await prisma.baggage.findMany({
      where: flightId ? { flightId } : {},
      include: { booking: { include: { passenger: true } } },
    });
    const rows = bags.map((b) => ({
      tagNumber: b.tagNumber,
      passenger: b.booking.passenger.name,
      pnr: b.booking.pnr,
      weightKg: b.weightKg,
      destination: b.destination,
      status: b.status,
    }));
    respond(req, res, rows, "baggage");
  })
);

reportsRouter.get(
  "/excess-baggage-revenue",
  handle(async (req, res) => {
    const charges = await prisma.baggageCharge.findMany({
      include: { booking: { include: { passenger: true, flight: true } } },
      orderBy: { createdAt: "desc" },
    });
    const rows = charges.map((c) => ({
      pnr: c.booking.pnr,
      passenger: c.booking.passenger.name,
      flight: c.booking.flight.flightNumber,
      excessKg: c.excessKg,
      ratePerKg: c.ratePerKg,
      totalCharge: c.totalCharge,
      paymentStatus: c.paymentStatus,
    }));
    respond(req, res, rows, "excess-baggage-revenue");
  })
);

reportsRouter.get(
  "/meal-vouchers",
  handle(async (req, res) => {
    const vouchers = await prisma.mealVoucher.findMany({
      include: { booking: { include: { passenger: true } }, flight: true },
      orderBy: { createdAt: "desc" },
    });
    const rows = vouchers.map((v) => ({
      voucherNo: v.voucherNo,
      passenger: v.booking.passenger.name,
      pnr: v.booking.pnr,
      flight: v.flight.flightNumber,
      mealType: v.mealType,
      status: v.status,
    }));
    respond(req, res, rows, "meal-vouchers");
  })
);

reportsRouter.get(
  "/lounge-usage",
  handle(async (req, res) => {
    const passes = await prisma.loungePass.findMany({
      include: { booking: { include: { passenger: true } }, flight: true },
      orderBy: { createdAt: "desc" },
    });
    const rows = passes.map((p) => ({
      passId: p.passId,
      passenger: p.booking.passenger.name,
      pnr: p.booking.pnr,
      flight: p.flight.flightNumber,
      accessType: p.accessType,
      status: p.status,
    }));
    respond(req, res, rows, "lounge-usage");
  })
);

reportsRouter.get(
  "/boarding",
  handle(async (req, res) => {
    const { flightId } = req.query as { flightId?: string };
    const bookings = await prisma.booking.findMany({
      where: { ...(flightId ? { flightId } : {}), status: { not: "CANCELLED" } },
      include: { passenger: true, flight: true, seat: true },
      orderBy: { sequenceNumber: "asc" },
    });
    const rows = bookings.map((b) => ({
      pnr: b.pnr,
      passenger: b.passenger.name,
      flight: b.flight.flightNumber,
      seat: b.seat?.seatNumber ?? "-",
      sequenceNumber: b.sequenceNumber ?? "-",
      boarded: b.boarded,
      noShow: b.noShow,
    }));
    respond(req, res, rows, "boarding");
  })
);

reportsRouter.get(
  "/no-show",
  handle(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { noShow: true },
      include: { passenger: true, flight: true },
    });
    const rows = bookings.map((b) => ({
      pnr: b.pnr,
      passenger: b.passenger.name,
      flight: b.flight.flightNumber,
      departureDate: b.flight.departureDate,
    }));
    respond(req, res, rows, "no-show");
  })
);

reportsRouter.get(
  "/flight-closure",
  handle(async (req, res) => {
    const ops = await prisma.flightOperation.findMany({
      where: { event: "CLOSED" },
      include: { flight: true },
      orderBy: { timestamp: "desc" },
    });
    const rows = ops.map((o) => ({
      flightNumber: o.flight.flightNumber,
      departureDate: o.flight.departureDate,
      closedAt: o.timestamp,
      summary: o.detail,
    }));
    respond(req, res, rows, "flight-closure");
  })
);
