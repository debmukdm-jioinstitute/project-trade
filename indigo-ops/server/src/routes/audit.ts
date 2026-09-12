import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";

export const auditRouter = Router();

auditRouter.get(
  "/",
  handle(async (req, res) => {
    const { reference, category, limit } = req.query as { reference?: string; category?: string; limit?: string };
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(reference ? { reference: { contains: reference.toUpperCase() } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: limit ? Number(limit) : 200,
    });
    res.json(logs);
  })
);
