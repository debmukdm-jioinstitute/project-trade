// One-off: delete all flight records and everything that depends on them
// (bookings, seats, baggage, vouchers, lounge passes, boarding passes, etc).
// Aircraft, gates, and passenger records are left intact.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const flightCount = await prisma.flight.count();
  console.log(`Deleting ${flightCount} flight(s) and dependent records...`);

  await prisma.boardingRecord.deleteMany();
  await prisma.flightOperation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.baggageCharge.deleteMany();
  await prisma.baggage.deleteMany();
  await prisma.mealVoucher.deleteMany();
  await prisma.loungePass.deleteMany();
  await prisma.boardingPass.deleteMany();
  await prisma.specialService.deleteMany();
  await prisma.transferPassenger.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.booking.deleteMany();
  const { count } = await prisma.flight.deleteMany();

  await prisma.auditLog.create({
    data: { category: "SYSTEM", message: `ALL FLIGHT RECORDS DELETED (${count}) VIA MAINTENANCE SCRIPT` },
  });

  console.log(`Deleted ${count} flight(s). Aircraft, gates, and passengers left intact.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
