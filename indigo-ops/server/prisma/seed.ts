// Seed script — mock/fictional data only. Prototype/simulation, not a real airline system.
import { PrismaClient } from "@prisma/client";
import { generatePNR, generateBagTag, generateDocumentId, generateVoucherNo, generateLoungePassId, generateBoardingPassNo } from "../src/lib/ids.js";

const prisma = new PrismaClient();

const STATIONS = ["DEL", "BOM", "BLR", "CCU", "HYD", "MAA"];

const FIRST_NAMES = [
  "Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Rohan", "Kavita", "Arjun", "Neha",
  "Sanjay", "Divya", "Karan", "Pooja", "Aditya", "Meera", "Rajesh", "Shalini", "Vivek", "Ritu",
  "Nikhil", "Swati", "Manoj", "Deepika", "Suresh", "Anita", "Gaurav", "Nisha", "Ashok", "Preeti",
  "Varun", "Simran", "Harsh", "Komal", "Yash", "Bhavna", "Naveen", "Isha", "Rakesh", "Tanvi",
];
const LAST_NAMES = [
  "Sharma", "Mukherjee", "Patel", "Reddy", "Iyer", "Singh", "Gupta", "Nair", "Rao", "Kapoor",
  "Verma", "Das", "Chatterjee", "Menon", "Joshi", "Malhotra", "Chauhan", "Bose", "Pillai", "Agarwal",
];

const AIRCRAFT = [
  { registration: "VT-IFA", type: "A320neo", configuration: "180Y", seatCapacity: 180 },
  { registration: "VT-IFB", type: "A321neo", configuration: "222Y", seatCapacity: 222 },
  { registration: "VT-IFC", type: "A320", configuration: "174Y", seatCapacity: 174 },
  { registration: "VT-IFD", type: "A320neo", configuration: "180Y", seatCapacity: 180 },
  { registration: "VT-IFE", type: "ATR72", configuration: "78Y", seatCapacity: 78 },
];

const GATES = [
  { code: "A12", terminal: "T2" },
  { code: "B04", terminal: "T2" },
  { code: "C07", terminal: "T3" },
  { code: "A05", terminal: "T2" },
  { code: "D02", terminal: "T1" },
  { code: "B11", terminal: "T2" },
];

const FLIGHT_DEFS: { num: string; from: string; to: string; std: string; sta: string; status: string }[] = [
  { num: "6E101", from: "DEL", to: "BOM", std: "06:10", sta: "08:10", status: "BOARDING" },
  { num: "6E204", from: "BOM", to: "BLR", std: "08:30", sta: "10:00", status: "CHECK-IN OPEN" },
  { num: "6E501", from: "DEL", to: "BLR", std: "10:15", sta: "13:00", status: "SCHEDULED" },
  { num: "6E312", from: "BLR", to: "CCU", std: "11:45", sta: "14:15", status: "SCHEDULED" },
  { num: "6E720", from: "CCU", to: "DEL", std: "13:20", sta: "15:40", status: "DELAYED" },
  { num: "6E845", from: "HYD", to: "DEL", std: "07:00", sta: "09:10", status: "DEPARTED" },
  { num: "6E933", from: "MAA", to: "BOM", std: "05:45", sta: "07:50", status: "ARRIVED" },
  { num: "6E162", from: "DEL", to: "HYD", std: "15:30", sta: "17:45", status: "SCHEDULED" },
  { num: "6E278", from: "BOM", to: "MAA", std: "16:50", sta: "18:55", status: "CANCELLED" },
  { num: "6E410", from: "BLR", to: "HYD", std: "18:10", sta: "19:20", status: "SCHEDULED" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomMobile() {
  return "9" + Math.floor(100000000 + Math.random() * 899999999);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  console.log("Seeding INDIGO OPS mock data...");
  await prisma.auditLog.deleteMany();
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
  await prisma.passenger.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.aircraft.deleteMany();

  const aircraft = await Promise.all(
    AIRCRAFT.map((a) => prisma.aircraft.create({ data: { ...a, status: "ACTIVE" } }))
  );
  const gates = await Promise.all(GATES.map((g) => prisma.gate.create({ data: g })));

  const date = today();
  const flights = [];
  for (let i = 0; i < FLIGHT_DEFS.length; i++) {
    const def = FLIGHT_DEFS[i];
    const ac = aircraft[i % aircraft.length];
    const gate = gates[i % gates.length];
    const flight = await prisma.flight.create({
      data: {
        flightNumber: def.num,
        origin: def.from,
        destination: def.to,
        departureDate: date,
        std: def.std,
        etd: def.status === "DELAYED" ? "13:45" : def.std,
        sta: def.sta,
        eta: def.sta,
        aircraftId: ac.id,
        gateId: gate.id,
        terminal: gate.terminal,
        status: def.status,
        delayMinutes: def.status === "DELAYED" ? 25 : 0,
        checkinOpen: ["CHECK-IN OPEN", "BOARDING", "FINAL CALL"].includes(def.status),
        boardingOpen: def.status === "BOARDING",
        departedAt: ["DEPARTED", "ARRIVED"].includes(def.status) ? new Date() : null,
        landedAt: def.status === "ARRIVED" ? new Date() : null,
      },
    });
    flights.push(flight);

    // seat map
    const cols = ["A", "B", "C", "D", "E", "F"];
    const rows = Math.ceil(ac.seatCapacity / cols.length);
    const seatData = [];
    let made = 0;
    for (let r = 1; r <= rows && made < ac.seatCapacity; r++) {
      for (const c of cols) {
        if (made >= ac.seatCapacity) break;
        seatData.push({ flightId: flight.id, seatNumber: `${r}${c}`, cabin: r <= 2 ? "BUSINESS" : "ECONOMY" });
        made++;
      }
    }
    await prisma.seat.createMany({ data: seatData });
  }

  console.log(`Created ${flights.length} flights, ${aircraft.length} aircraft, ${gates.length} gates.`);

  // Passengers + bookings
  let totalPassengers = 0;
  let totalBookings = 0;
  let totalBaggage = 0;

  for (const flight of flights) {
    if (flight.status === "CANCELLED") continue;
    const seats = await prisma.seat.findMany({ where: { flightId: flight.id }, orderBy: { seatNumber: "asc" } });
    const paxCount = Math.min(seats.length, 8 + Math.floor(Math.random() * 8)); // 8-15 per flight -> 60-100+ total

    for (let p = 0; p < paxCount; p++) {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const passenger = await prisma.passenger.create({
        data: {
          name,
          dob: `19${80 + Math.floor(Math.random() * 20)}-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`,
          gender: pick(["M", "F"]),
          mobile: randomMobile(),
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        },
      });
      totalPassengers++;

      let pnr = generatePNR();
      // simple uniqueness retry
      while (await prisma.booking.findUnique({ where: { pnr } })) pnr = generatePNR();

      const isBoardingFlight = ["BOARDING", "DEPARTED", "ARRIVED"].includes(flight.status);
      const isCheckinOpenFlight = ["CHECK-IN OPEN", "BOARDING", "FINAL CALL", "DEPARTED", "ARRIVED"].includes(flight.status);
      const checkedIn = isCheckinOpenFlight && Math.random() < 0.85;
      const boarded = isBoardingFlight && checkedIn && Math.random() < 0.8;
      const noShow = isBoardingFlight && checkedIn && !boarded && Math.random() < 0.3;

      const booking = await prisma.booking.create({
        data: {
          pnr,
          passengerId: passenger.id,
          flightId: flight.id,
          fareType: pick(["SAVER", "FLEXI", "SUPER6E"]),
          baggageAllowanceKg: 15,
          mealSelection: Math.random() < 0.4 ? pick(["VEGETARIAN", "NON_VEGETARIAN"]) : null,
          checkedIn,
          checkedInAt: checkedIn ? new Date() : null,
          sequenceNumber: checkedIn ? p + 1 : null,
          boarded,
          boardedAt: boarded ? new Date() : null,
          noShow,
          deplaned: flight.status === "ARRIVED" && boarded,
          deplanedAt: flight.status === "ARRIVED" && boarded ? new Date() : null,
          boardingGroup: pick(["1", "2", "3"]),
        },
      });
      totalBookings++;

      const seat = seats[p];
      if (seat) {
        await prisma.seat.update({
          where: { id: seat.id },
          data: { status: boarded || checkedIn ? "CHECKED-IN" : "BOOKED", bookingId: booking.id },
        });
      }

      // Special services ~10%
      if (Math.random() < 0.1) {
        await prisma.specialService.create({
          data: {
            bookingId: booking.id,
            serviceType: pick([
              "WHEELCHAIR",
              "UNACCOMPANIED_MINOR",
              "SPECIAL_MEAL",
              "INFANT",
              "MEDICAL",
              "PRIORITY_BOARDING",
              "EXTRA_BAGGAGE",
              "SPORTS_EQUIPMENT",
            ]),
          },
        });
      }

      // Baggage for checked-in passengers
      if (checkedIn) {
        const weight = Math.round((10 + Math.random() * 18) * 10) / 10;
        const tagNumber = generateBagTag(flight.flightNumber, flight.origin, flight.destination, pnr);
        const bagStatus = flight.status === "ARRIVED" ? "CLAIMED" : boarded ? "LOADED" : "ACCEPTED";
        await prisma.baggage.create({
          data: {
            tagNumber,
            bookingId: booking.id,
            flightId: flight.id,
            weightKg: weight,
            destination: flight.destination,
            status: bagStatus,
          },
        });
        totalBaggage++;

        if (weight > 15) {
          const excessKg = Math.round((weight - 15) * 10) / 10;
          const totalCharge = Math.round(excessKg * 600);
          await prisma.baggageCharge.create({
            data: {
              bookingId: booking.id,
              allowanceKg: 15,
              actualKg: weight,
              excessKg,
              ratePerKg: 600,
              totalCharge,
              paymentStatus: Math.random() < 0.7 ? "PAID" : "PENDING",
              transactionId: Math.random() < 0.7 ? `TXN${Date.now().toString(36).toUpperCase()}${p}` : null,
            },
          });
        }

        if (Math.random() < 0.3) {
          await prisma.mealVoucher.create({
            data: {
              voucherNo: generateVoucherNo(),
              bookingId: booking.id,
              flightId: flight.id,
              mealType: pick(["STANDARD", "VEGETARIAN", "NON_VEGETARIAN", "SNACK", "BEVERAGE"]),
              validity: flight.departureDate,
              status: pick(["ISSUED", "ISSUED", "REDEEMED"]),
              qrPayload: `6E|MV|${pnr}|${generateVoucherNo()}`,
            },
          });
        }

        if (Math.random() < 0.15) {
          await prisma.loungePass.create({
            data: {
              passId: generateLoungePassId(),
              bookingId: booking.id,
              flightId: flight.id,
              airport: flight.origin,
              terminal: flight.terminal,
              accessType: pick(["COMPLIMENTARY", "PAID", "ELIGIBILITY_BASED"]),
              validity: flight.departureDate,
              status: pick(["ISSUED", "USED"]),
              qrPayload: `6E|LP|${pnr}|${generateLoungePassId()}`,
            },
          });
        }

        if (boarded || checkedIn) {
          await prisma.boardingPass.create({
            data: {
              documentNo: generateBoardingPassNo(),
              bookingId: booking.id,
              flightId: flight.id,
              seatNumber: seat?.seatNumber ?? "UNASSIGNED",
              boardingGroup: booking.boardingGroup,
              sequenceNumber: booking.sequenceNumber ?? 0,
              gate: null,
              boardingTime: flight.std,
              qrPayload: `6E|BP|${pnr}|${String(booking.sequenceNumber ?? 0).padStart(3, "0")}`,
            },
          });
        }
      }

      await prisma.document.create({
        data: {
          documentId: generateDocumentId("BKG"),
          type: "BOOKING_CONFIRMATION",
          bookingId: booking.id,
          flightNumber: flight.flightNumber,
          payload: JSON.stringify({ pnr, passenger: name, flight: flight.flightNumber }),
        },
      });
    }
  }

  // A couple of transfer passengers for demo of connection alerts
  const inbound = flights.find((f) => f.flightNumber === "6E845");
  const outbound = flights.find((f) => f.flightNumber === "6E162");
  if (inbound && outbound) {
    const passenger = await prisma.passenger.create({
      data: { name: "Arvind Menon", mobile: randomMobile(), email: "arvind.menon@example.com" },
    });
    let pnr = generatePNR();
    while (await prisma.booking.findUnique({ where: { pnr } })) pnr = generatePNR();
    const booking = await prisma.booking.create({
      data: { pnr, passengerId: passenger.id, flightId: outbound.id, checkedIn: true, checkedInAt: new Date() },
    });
    await prisma.transferPassenger.create({
      data: { bookingId: booking.id, inboundFlightId: inbound.id, outboundFlightId: outbound.id, connectionMinutes: 42 },
    });
  }

  await prisma.auditLog.create({ data: { category: "SYSTEM", message: "SEED DATA LOADED — INDIGO OPS PROTOTYPE INITIALIZED" } });

  console.log(`Passengers: ${totalPassengers}, Bookings: ${totalBookings}, Baggage: ${totalBaggage}`);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
