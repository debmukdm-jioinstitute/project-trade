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
    const { flightId, date } = req.query as { flightId?: string; date?: string };
    const bookings = await prisma.booking.findMany({
      where: {
        ...(flightId ? { flightId } : {}),
        ...(date ? { flight: { departureDate: date } } : {}),
      },
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
    const { flightId, date } = req.query as { flightId?: string; date?: string };
    const bags = await prisma.baggage.findMany({
      where: {
        ...(flightId ? { flightId } : {}),
        ...(date ? { flight: { departureDate: date } } : {}),
      },
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
    const { date } = req.query as { date?: string };
    const charges = await prisma.baggageCharge.findMany({
      where: date ? { booking: { flight: { departureDate: date } } } : {},
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
    const { date } = req.query as { date?: string };
    const vouchers = await prisma.mealVoucher.findMany({
      where: date ? { flight: { departureDate: date } } : {},
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
    const { date } = req.query as { date?: string };
    const passes = await prisma.loungePass.findMany({
      where: date ? { flight: { departureDate: date } } : {},
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

// Full flight manifest / data report — flight data, customer checkpoints,
// baggage, meal (food choice) vouchers, and lounge usage — for the Flight
// Data Report module (view on screen + dot-matrix courier download).
reportsRouter.get(
  "/flight/:flightId/manifest",
  handle(async (req, res) => {
    const flight = await prisma.flight.findUnique({
      where: { id: req.params.flightId },
      include: {
        aircraft: true,
        gate: true,
        bookings: {
          include: {
            passenger: true,
            seat: true,
            baggage: true,
            baggageCharges: true,
            mealVouchers: true,
            loungePasses: true,
            specialServices: true,
            boardingPasses: true,
          },
          orderBy: { sequenceNumber: "asc" },
        },
      },
    });
    if (!flight) {
      return res.status(404).json({ error: { code: "OPS-404", title: "FLIGHT NOT FOUND", message: "Flight not found." } });
    }

    const activeBookings = flight.bookings.filter((b) => b.status !== "CANCELLED");

    const passengers = activeBookings.map((b) => ({
      pnr: b.pnr,
      name: b.passenger.name,
      mobile: b.passenger.mobile,
      email: b.passenger.email,
      seat: b.seat?.seatNumber ?? null,
      fareType: b.fareType,
      checkedIn: b.checkedIn,
      bagDrop: b.baggage.length > 0,
      securityCleared: b.baggage.some((bg) => ["SECURITY_CLEARED", "SORTED", "LOADED", "ARRIVED", "CLAIMED"].includes(bg.status)),
      loungeUsed: b.loungePasses.some((l) => l.status === "USED"),
      boarded: b.boarded,
      noShow: b.noShow,
      offloaded: b.offloaded,
      deplaned: b.deplaned,
      boardingPass: b.boardingPasses.some((bp) => bp.status === "VALID"),
      specialServices: b.specialServices.map((s) => s.serviceType),
    }));

    const baggage = activeBookings.flatMap((b) =>
      b.baggage.map((bg) => ({
        tagNumber: bg.tagNumber,
        pnr: b.pnr,
        passenger: b.passenger.name,
        weightKg: bg.weightKg,
        bagType: bg.bagType,
        destination: bg.destination,
        status: bg.status,
      }))
    );

    const excessCharges = activeBookings.flatMap((b) =>
      b.baggageCharges.map((c) => ({
        pnr: b.pnr,
        passenger: b.passenger.name,
        excessKg: c.excessKg,
        ratePerKg: c.ratePerKg,
        totalCharge: c.totalCharge,
        paymentStatus: c.paymentStatus,
      }))
    );

    const mealVouchers = activeBookings.flatMap((b) =>
      b.mealVouchers.map((v) => ({
        voucherNo: v.voucherNo,
        pnr: b.pnr,
        passenger: b.passenger.name,
        mealType: v.mealType,
        status: v.status,
      }))
    );

    const loungePasses = activeBookings.flatMap((b) =>
      b.loungePasses.map((l) => ({
        passId: l.passId,
        pnr: b.pnr,
        passenger: b.passenger.name,
        lounge: l.lounge,
        accessType: l.accessType,
        status: l.status,
      }))
    );

    const checkpoints = {
      totalPax: activeBookings.length,
      checkedIn: activeBookings.filter((b) => b.checkedIn).length,
      bagDrop: activeBookings.filter((b) => b.baggage.length > 0).length,
      securityCleared: passengers.filter((p) => p.securityCleared).length,
      loungeUsed: passengers.filter((p) => p.loungeUsed).length,
      boarded: activeBookings.filter((b) => b.boarded).length,
      noShow: activeBookings.filter((b) => b.noShow).length,
      offloaded: activeBookings.filter((b) => b.offloaded).length,
      deplaned: activeBookings.filter((b) => b.deplaned).length,
      bagsTotal: baggage.length,
      bagsLoaded: baggage.filter((bg) => ["LOADED", "ARRIVED", "CLAIMED"].includes(bg.status)).length,
      excessBaggageRevenue: excessCharges.filter((c) => c.paymentStatus === "PAID").reduce((s, c) => s + c.totalCharge, 0),
    };

    res.json({
      flight: {
        flightNumber: flight.flightNumber,
        origin: flight.origin,
        destination: flight.destination,
        departureDate: flight.departureDate,
        std: flight.std,
        etd: flight.etd,
        sta: flight.sta,
        eta: flight.eta,
        status: flight.status,
        terminal: flight.terminal,
        crew: flight.crew,
        delayMinutes: flight.delayMinutes,
        aircraft: flight.aircraft
          ? { registration: flight.aircraft.registration, type: flight.aircraft.type, configuration: flight.aircraft.configuration, seatCapacity: flight.aircraft.seatCapacity }
          : null,
        gate: flight.gate ? { code: flight.gate.code, terminal: flight.gate.terminal } : null,
      },
      checkpoints,
      passengers,
      baggage,
      excessCharges,
      mealVouchers,
      loungePasses,
      generatedAt: new Date().toISOString(),
    });
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
