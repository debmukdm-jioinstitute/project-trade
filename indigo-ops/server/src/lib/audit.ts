import { prisma } from "./prisma.js";

export async function audit(category: string, message: string, reference?: string) {
  return prisma.auditLog.create({
    data: { category, message, reference: reference ?? null },
  });
}
