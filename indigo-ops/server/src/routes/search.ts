import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const searchRouter = Router();

// Universal search across PNR, passenger name, flight number, bag tag,
// boarding pass number, voucher number, lounge pass id, mobile number.
searchRouter.get(
  "/",
  handle(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ query: q, results: [] });
    const qUpper = q.toUpperCase();

    const [bookingsByPnr, bookingsByName, bookingsByMobile, bags, boardingPasses, vouchers, lounge, flights] =
      await Promise.all([
        prisma.booking.findMany({ where: { pnr: qUpper }, include: { passenger: true, flight: true } }),
        prisma.booking.findMany({
          where: { passenger: { name: { contains: q } } },
          include: { passenger: true, flight: true },
          take: 15,
        }),
        prisma.booking.findMany({
          where: { passenger: { mobile: { contains: q } } },
          include: { passenger: true, flight: true },
          take: 15,
        }),
        prisma.baggage.findMany({
          where: { tagNumber: { contains: qUpper } },
          include: { booking: { include: { passenger: true } } },
          take: 10,
        }),
        prisma.boardingPass.findMany({
          where: { documentNo: { contains: qUpper } },
          include: { booking: { include: { passenger: true } } },
          take: 10,
        }),
        prisma.mealVoucher.findMany({
          where: { voucherNo: { contains: qUpper } },
          include: { booking: { include: { passenger: true } } },
          take: 10,
        }),
        prisma.loungePass.findMany({
          where: { passId: { contains: qUpper } },
          include: { booking: { include: { passenger: true } } },
          take: 10,
        }),
        prisma.flight.findMany({ where: { flightNumber: { contains: qUpper } }, take: 10 }),
      ]);

    const bookingMap = new Map<string, any>();
    for (const b of [...bookingsByPnr, ...bookingsByName, ...bookingsByMobile]) bookingMap.set(b.id, b);

    const results = [
      ...[...bookingMap.values()].map((b) => ({
        kind: "PNR",
        label: `${b.pnr} — ${b.passenger.name}`,
        sub: `${b.flight.flightNumber} ${b.flight.origin}->${b.flight.destination}`,
        href: `pnr:${b.pnr}`,
      })),
      ...bags.map((b) => ({
        kind: "BAGGAGE",
        label: b.tagNumber,
        sub: b.booking.passenger.name,
        href: `pnr:${b.booking.pnr}`,
      })),
      ...boardingPasses.map((b) => ({
        kind: "BOARDING PASS",
        label: b.documentNo,
        sub: b.booking.passenger.name,
        href: `pnr:${b.booking.pnr}`,
      })),
      ...vouchers.map((v) => ({
        kind: "VOUCHER",
        label: v.voucherNo,
        sub: v.booking.passenger.name,
        href: `pnr:${v.booking.pnr}`,
      })),
      ...lounge.map((l) => ({
        kind: "LOUNGE PASS",
        label: l.passId,
        sub: l.booking.passenger.name,
        href: `pnr:${l.booking.pnr}`,
      })),
      ...flights.map((f) => ({
        kind: "FLIGHT",
        label: f.flightNumber,
        sub: `${f.origin} -> ${f.destination} (${f.departureDate})`,
        href: `flight:${f.id}`,
      })),
    ];

    res.json({ query: q, results });
  })
);
