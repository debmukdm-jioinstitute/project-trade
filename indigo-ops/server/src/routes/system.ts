import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const systemRouter = Router();

systemRouter.get(
  "/status",
  handle(async (_req, res) => {
    let dbOnline = true;
    try {
      await prisma.flight.count();
    } catch {
      dbOnline = false;
    }
    res.json({
      DATABASE: dbOnline ? "ONLINE" : "OFFLINE",
      "FLIGHT ENGINE": "ONLINE",
      "BOOKING ENGINE": "ONLINE",
      "BAGGAGE ENGINE": "ONLINE",
      "BOARDING ENGINE": "ONLINE",
      "DOCUMENT ENGINE": "ONLINE",
      "QR SERVICE": "ONLINE",
      "BARCODE SERVICE": "ONLINE",
      mode: "PROTOTYPE / SIMULATION — NO LIVE AIRLINE SYSTEMS CONNECTED",
      timestamp: new Date().toISOString(),
    });
  })
);
