import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const searchRouter = Router();

// Universal search across: customer name, phone, email, PNR, baggage tag,
// boarding pass / voucher / lounge pass number, booking id, document id,
// and flight number. Every non-flight result carries a bookingId so the
// caller can fetch full passenger/booking detail in one follow-up request
// (GET /api/passengers/:bookingId/profile).
searchRouter.get(
  "/",
  handle(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ query: q, results: [] });
    const qUpper = q.toUpperCase();

    const [
      bookingsByPnr,
      bookingsByName,
      bookingsByMobile,
      bookingsByEmail,
      bookingsByPassport,
      bookingsById,
      bags,
      boardingPasses,
      vouchers,
      lounge,
      documents,
      flights,
    ] = await Promise.all([
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
      prisma.booking.findMany({
        where: { passenger: { email: { contains: q } } },
        include: { passenger: true, flight: true },
        take: 15,
      }),
      prisma.booking.findMany({
        where: { passenger: { passportNo: { contains: qUpper } } },
        include: { passenger: true, flight: true },
        take: 15,
      }),
      prisma.booking.findMany({
        where: { id: { contains: q } },
        include: { passenger: true, flight: true },
        take: 5,
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
      prisma.document.findMany({
        where: { documentId: { contains: qUpper } },
        include: { booking: { include: { passenger: true, flight: true } } },
        take: 10,
      }),
      prisma.flight.findMany({ where: { flightNumber: { contains: qUpper } }, take: 10 }),
    ]);

    const bookingMap = new Map<string, (typeof bookingsByPnr)[number]>();
    for (const b of [
      ...bookingsByPnr,
      ...bookingsByName,
      ...bookingsByMobile,
      ...bookingsByEmail,
      ...bookingsByPassport,
      ...bookingsById,
    ]) {
      bookingMap.set(b.id, b);
    }

    const results = [
      ...[...bookingMap.values()].map((b) => ({
        kind: "CUSTOMER",
        label: `${b.passenger.name} — PNR ${b.pnr}`,
        sub: `${b.flight.flightNumber} ${b.flight.origin}->${b.flight.destination} · ${b.passenger.mobile ?? b.passenger.email ?? ""}`,
        bookingId: b.id,
        href: `pnr:${b.pnr}`,
      })),
      ...bags.map((b) => ({
        kind: "BAGGAGE TAG",
        label: b.tagNumber,
        sub: `${b.booking.passenger.name} — PNR ${b.booking.pnr}`,
        bookingId: b.bookingId,
        href: `pnr:${b.booking.pnr}`,
      })),
      ...boardingPasses.map((b) => ({
        kind: "BOARDING PASS",
        label: b.documentNo,
        sub: `${b.booking.passenger.name} — PNR ${b.booking.pnr}`,
        bookingId: b.bookingId,
        href: `pnr:${b.booking.pnr}`,
      })),
      ...vouchers.map((v) => ({
        kind: "VOUCHER",
        label: v.voucherNo,
        sub: `${v.booking.passenger.name} — PNR ${v.booking.pnr}`,
        bookingId: v.bookingId,
        href: `pnr:${v.booking.pnr}`,
      })),
      ...lounge.map((l) => ({
        kind: "LOUNGE PASS",
        label: l.passId,
        sub: `${l.booking.passenger.name} — PNR ${l.booking.pnr}`,
        bookingId: l.bookingId,
        href: `pnr:${l.booking.pnr}`,
      })),
      ...documents.map((d) => ({
        kind: "DOCUMENT",
        label: d.documentId,
        sub: `${d.type.replace(/_/g, " ")} — ${d.booking.passenger.name} (${d.booking.pnr})`,
        bookingId: d.bookingId,
        href: `pnr:${d.booking.pnr}`,
      })),
      ...flights.map((f) => ({
        kind: "FLIGHT",
        label: f.flightNumber,
        sub: `${f.origin} -> ${f.destination} (${f.departureDate})`,
        bookingId: null,
        href: `flight:${f.id}`,
      })),
    ];

    res.json({ query: q, results });
  })
);
