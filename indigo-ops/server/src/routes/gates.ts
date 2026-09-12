import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const gatesRouter = Router();

gatesRouter.get("/", async (_req, res) => {
  const gates = await prisma.gate.findMany({
    orderBy: { code: "asc" },
    include: { flights: { where: { status: { notIn: ["DEPARTED", "CANCELLED", "CLOSED", "COMPLETED"] } } } },
  });
  res.json(gates);
});
