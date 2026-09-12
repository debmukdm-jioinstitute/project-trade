import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  handle(async (req, res) => {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    const flights = await prisma.flight.findMany({
      where: { departureDate: date },
      include: { aircraft: true, gate: true, bookings: { include: { baggage: true, baggageCharges: true } } },
      orderBy: { std: "asc" },
    });

    let flightsBoarding = 0,
      flightsDeparted = 0,
      flightsArrived = 0,
      delayed = 0,
      cancelled = 0,
      paxCheckedIn = 0,
      paxBoarded = 0,
      bagsChecked = 0,
      bagsLoaded = 0,
      excessRevenue = 0;

    const board = flights.map((f) => {
      const active = f.bookings.filter((b) => b.status !== "CANCELLED");
      const checkedIn = active.filter((b) => b.checkedIn).length;
      const boarded = active.filter((b) => b.boarded).length;
      const bags = active.flatMap((b) => b.baggage);
      const loaded = bags.filter((b) => b.status === "LOADED" || b.status === "ARRIVED" || b.status === "CLAIMED");

      if (["BOARDING", "FINAL CALL"].includes(f.status)) flightsBoarding++;
      if (["DEPARTED", "AIRBORNE", "LANDED", "AT GATE", "DISEMBARKATION", "COMPLETED", "CLOSED"].includes(f.status)) flightsDeparted++;
      if (["LANDED", "AT GATE", "DISEMBARKATION", "COMPLETED", "CLOSED"].includes(f.status)) flightsArrived++;
      if (f.status === "DELAYED") delayed++;
      if (f.status === "CANCELLED") cancelled++;
      paxCheckedIn += checkedIn;
      paxBoarded += boarded;
      bagsChecked += bags.length;
      bagsLoaded += loaded.length;
      excessRevenue += active.flatMap((b) => b.baggageCharges).reduce((s, c) => s + (c.paymentStatus === "PAID" ? c.totalCharge : 0), 0);

      return {
        id: f.id,
        flightNumber: f.flightNumber,
        origin: f.origin,
        destination: f.destination,
        aircraft: f.aircraft?.type ?? "-",
        registration: f.aircraft?.registration ?? "-",
        std: f.std,
        etd: f.etd,
        gate: f.gate?.code ?? "-",
        terminal: f.terminal,
        passengers: active.length,
        checkedIn,
        boarded,
        bags: bags.length,
        status: f.status,
      };
    });

    const mealVouchers = await prisma.mealVoucher.count({ where: { flight: { departureDate: date } } });
    const loungePasses = await prisma.loungePass.count({ where: { flight: { departureDate: date } } });

    const alerts: { level: "warn" | "ok"; message: string }[] = [];
    for (const f of flights) {
      const active = f.bookings.filter((b) => b.status !== "CANCELLED");
      const notBoarded = active.filter((b) => b.checkedIn && !b.boarded && !b.noShow);
      if (["GATE CLOSED", "DEPARTED"].includes(f.status) && notBoarded.length > 0) {
        alerts.push({ level: "warn", message: `${notBoarded.length} passenger(s) not boarded on ${f.flightNumber}` });
      }
      const mismatches = active.flatMap((b) =>
        !b.boarded && b.baggage.some((bg) => bg.status === "LOADED") ? [b] : []
      );
      if (mismatches.length > 0) {
        alerts.push({ level: "warn", message: `${mismatches.length} baggage mismatch(es) on ${f.flightNumber}` });
      }
      if (f.status === "DELAYED") {
        alerts.push({ level: "warn", message: `${f.flightNumber} delayed ${f.delayMinutes} minutes` });
      }
    }
    if (alerts.length === 0) alerts.push({ level: "ok", message: "All operations nominal" });

    res.json({
      date,
      stats: {
        flightsScheduled: flights.length,
        flightsBoarding,
        flightsDeparted,
        flightsArrived,
        delayed,
        cancelled,
        paxCheckedIn,
        paxBoarded,
        bagsChecked,
        bagsLoaded,
        excessRevenue,
        mealVouchers,
        loungePasses,
      },
      board,
      alerts,
    });
  })
);
