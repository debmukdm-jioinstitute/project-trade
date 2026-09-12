import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const aircraftRouter = Router();

aircraftRouter.get("/", async (_req, res) => {
  const aircraft = await prisma.aircraft.findMany({ orderBy: { registration: "asc" } });
  res.json(aircraft);
});

