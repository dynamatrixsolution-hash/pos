import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../packages/db/client");

const envConfig = Object.fromEntries(
  readFileSync(".env.restro.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const db = new PrismaClient({ datasourceUrl: envConfig.DATABASE_URL });

async function main() {
  const owner = await db.user.findUnique({
    where: { email: "owner@restroinn.com" },
    include: { business: { include: { branches: true } } },
  });

  if (!owner) {
    throw new Error("owner@restroinn.com not found in database.");
  }

  const businessId = owner.businessId;
  const branchId = owner.branchId || owner.business.branches[0]?.id;
  const userId = owner.id;

  if (!branchId) {
    throw new Error("No branch found for owner@restroinn.com.");
  }

  console.log(`Seeding rich hospitality demo data for ${owner.email} (businessId=${businessId}, branchId=${branchId})...`);

  // 1. Ensure UserBranchMembership for all users in this business
  const users = await db.user.findMany({ where: { businessId } });
  for (const u of users) {
    if (!u.branchId) {
      await db.user.update({ where: { id: u.id }, data: { branchId } });
    }
    await db.userBranchMembership.upsert({
      where: {
        userId_branchId: {
          userId: u.id,
          branchId,
        },
      },
      update: { isActive: true, isDefault: true },
      create: {
        businessId,
        userId: u.id,
        branchId,
        role: u.role,
        isActive: true,
        isDefault: true,
      },
    });
  }

  // 2. Floors & Tables (Phase 3)
  let mainFloor = await db.floor.findFirst({
    where: { businessId, branchId, name: "Grand Courtyard Dining" },
  });
  if (!mainFloor) {
    mainFloor = await db.floor.create({
      data: {
        businessId,
        branchId,
        name: "Grand Courtyard Dining",
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  let rooftopFloor = await db.floor.findFirst({
    where: { businessId, branchId, name: "Rooftop Sky Lounge" },
  });
  if (!rooftopFloor) {
    rooftopFloor = await db.floor.create({
      data: {
        businessId,
        branchId,
        name: "Rooftop Sky Lounge",
        displayOrder: 2,
        isActive: true,
      },
    });
  }

  const tableSpecs = [
    { floorId: mainFloor.id, tableNumber: "T-01", capacity: 2 },
    { floorId: mainFloor.id, tableNumber: "T-02", capacity: 4 },
    { floorId: mainFloor.id, tableNumber: "T-03", capacity: 4 },
    { floorId: mainFloor.id, tableNumber: "T-04", capacity: 6 },
    { floorId: rooftopFloor.id, tableNumber: "R-01", capacity: 4 },
    { floorId: rooftopFloor.id, tableNumber: "R-02", capacity: 8 },
  ];

  const tables = {};
  for (const spec of tableSpecs) {
    const tbl = await db.restaurantTable.upsert({
      where: {
        businessId_branchId_tableNumber: {
          businessId,
          branchId,
          tableNumber: spec.tableNumber,
        },
      },
      update: { capacity: spec.capacity, floorId: spec.floorId, isActive: true },
      create: {
        businessId,
        branchId,
        floorId: spec.floorId,
        tableNumber: spec.tableNumber,
        capacity: spec.capacity,
        status: "AVAILABLE",
        isActive: true,
      },
    });
    tables[spec.tableNumber] = tbl;
  }

  // 3. Kitchen Stations (Phase 4)
  const stationSpecs = [
    { code: "HOT", name: "Main Hot Kitchen", printerIp: "192.168.1.201", displayOrder: 1 },
    { code: "GRILL", name: "Tandoor & Wood Grill", printerIp: "192.168.1.202", displayOrder: 2 },
    { code: "BAR", name: "Artisan Bar & Beverage", printerIp: "192.168.1.203", displayOrder: 3 },
  ];
  const stations = {};
  for (const s of stationSpecs) {
    const st = await db.kitchenStation.upsert({
      where: {
        businessId_branchId_code: {
          businessId,
          branchId,
          code: s.code,
        },
      },
      update: { name: s.name, printerIp: s.printerIp, isActive: true },
      create: {
        businessId,
        branchId,
        code: s.code,
        name: s.name,
        printerIp: s.printerIp,
        printerPort: 9100,
        displayOrder: s.displayOrder,
        isActive: true,
      },
    });
    stations[s.code] = st;
  }

  // 4. Menu, Sections, Items & Modifiers (Phase 3 & 4)
  let menu = await db.menu.findFirst({
    where: { businessId, branchId, name: "RestroInn All-Day Heritage Menu" },
  });
  if (!menu) {
    menu = await db.menu.create({
      data: {
        businessId,
        branchId,
        name: "RestroInn All-Day Heritage Menu",
        description: "Signature Nepali, Continental & Wood-Fired specialties",
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  let spiceGroup = await db.modifierGroup.findFirst({
    where: { businessId, name: "Spice & Preparation Level" },
  });
  if (!spiceGroup) {
    spiceGroup = await db.modifierGroup.create({
      data: {
        businessId,
        name: "Spice & Preparation Level",
        minSelections: 0,
        maxSelections: 2,
        isActive: true,
        options: {
          create: [
            { businessId, name: "Mild Heritage Spice", priceDelta: 0, displayOrder: 1 },
            { businessId, name: "Extra Timur Pepper", priceDelta: 50, displayOrder: 2 },
            { businessId, name: "Organic Ghee Drizzle", priceDelta: 120, displayOrder: 3 },
          ],
        },
      },
    });
  }

  const sectionSpecs = [
    {
      name: "Appetizers & Momos",
      displayOrder: 1,
      stationCode: "HOT",
      items: [
        { name: "Himalayan Jhol Momo", basePrice: 480, prepTime: 12, desc: "Steamed dumplings in roasted sesame & timur soup" },
        { name: "Crispy Mustang Alu", basePrice: 360, prepTime: 10, desc: "Spiced mountain potatoes tempered with jimbu" },
      ],
    },
    {
      name: "Signature Mains & Thalis",
      displayOrder: 2,
      stationCode: "GRILL",
      items: [
        { name: "Royal Thakali Mutton Thali", basePrice: 1150, prepTime: 18, desc: "Complete brass platter with black lentils, buckwheat greens & gundruk" },
        { name: "Trisuli Grilled Rainbow Trout", basePrice: 1450, prepTime: 20, desc: "Whole river trout grilled with lemon butter & herbs" },
      ],
    },
    {
      name: "Craft Beverages & Bar",
      displayOrder: 3,
      stationCode: "BAR",
      items: [
        { name: "Ilam Orthodox Masala Chai", basePrice: 220, prepTime: 6, desc: "Slow-brewed spiced milk tea" },
        { name: "Himalayan Rhododendron Spritz", basePrice: 450, prepTime: 5, desc: "Sparkling botanical refresher with fresh mint" },
      ],
    },
  ];

  for (const secSpec of sectionSpecs) {
    let sec = await db.menuSection.findFirst({
      where: { businessId, menuId: menu.id, name: secSpec.name },
    });
    if (!sec) {
      sec = await db.menuSection.create({
        data: {
          businessId,
          menuId: menu.id,
          name: secSpec.name,
          displayOrder: secSpec.displayOrder,
        },
      });
    }

    for (const itemSpec of secSpec.items) {
      let item = await db.menuItem.findFirst({
        where: { businessId, sectionId: sec.id, name: itemSpec.name },
      });
      if (!item) {
        item = await db.menuItem.create({
          data: {
            businessId,
            sectionId: sec.id,
            name: itemSpec.name,
            description: itemSpec.desc,
            basePrice: itemSpec.basePrice,
            taxRate: 13,
            prepTimeMinutes: itemSpec.prepTime,
            isAvailable: true,
          },
        });
        await db.menuItemModifierGroup.create({
          data: {
            businessId,
            menuItemId: item.id,
            modifierGroupId: spiceGroup.id,
            displayOrder: 1,
          },
        });
        await db.stationRoute.create({
          data: {
            businessId,
            stationId: stations[secSpec.stationCode].id,
            menuItemId: item.id,
            priority: 1,
          },
        });
      }
    }
  }

  // 5. Room Types & Rooms (Phase 5)
  const roomTypeSpecs = [
    { code: "DLX", name: "Heritage Deluxe King", baseRate: 8500, maxOccupancy: 2 },
    { code: "EXE", name: "Executive Mountain View Suite", baseRate: 14500, maxOccupancy: 3 },
    { code: "PRS", name: "Presidential Durbar Suite", baseRate: 25000, maxOccupancy: 4 },
  ];

  const roomTypes = {};
  for (const rt of roomTypeSpecs) {
    const record = await db.roomType.upsert({
      where: {
        businessId_branchId_code: {
          businessId,
          branchId,
          code: rt.code,
        },
      },
      update: { name: rt.name, baseRate: rt.baseRate, isActive: true },
      create: {
        businessId,
        branchId,
        code: rt.code,
        name: rt.name,
        baseRate: rt.baseRate,
        maxOccupancy: rt.maxOccupancy,
        isActive: true,
      },
    });
    roomTypes[rt.code] = record;
  }

  const roomSpecs = [
    { roomNumber: "101", capacity: 2, typeCode: "DLX", status: "VACANT_CLEAN" },
    { roomNumber: "102", capacity: 2, typeCode: "DLX", status: "VACANT_CLEAN" },
    { roomNumber: "103", capacity: 2, typeCode: "DLX", status: "VACANT_DIRTY" },
    { roomNumber: "201", capacity: 3, typeCode: "EXE", status: "VACANT_CLEAN" },
    { roomNumber: "202", capacity: 3, typeCode: "EXE", status: "VACANT_CLEAN" },
    { roomNumber: "301", capacity: 4, typeCode: "PRS", status: "VACANT_CLEAN" },
  ];

  const rooms = {};
  for (const r of roomSpecs) {
    const room = await db.room.upsert({
      where: {
        businessId_branchId_roomNumber: {
          businessId,
          branchId,
          roomNumber: r.roomNumber,
        },
      },
      update: { roomTypeId: roomTypes[r.typeCode].id, capacity: r.capacity, isActive: true },
      create: {
        businessId,
        branchId,
        roomTypeId: roomTypes[r.typeCode].id,
        roomNumber: r.roomNumber,
        capacity: r.capacity,
        status: r.status,
        isActive: true,
      },
    });
    rooms[r.roomNumber] = room;
  }

  // 6. Active Guest Stay, Reservation, Folio & Room Night Charge (Phase 5 & 6)
  let activeStay = await db.stay.findFirst({
    where: { businessId, branchId, status: "ACTIVE" },
  });

  if (!activeStay) {
    const now = new Date();
    const tomorrow = new Date(Date.now() + 2 * 86400_000);
    const stayNumber = `STY-DEMO-101`;

    activeStay = await db.stay.create({
      data: {
        businessId,
        branchId,
        roomId: rooms["101"].id,
        stayNumber,
        guestName: "Aarav Sharma",
        guestPhone: "9841228899",
        guestEmail: "aarav.sharma@example.com",
        checkInTime: now,
        expectedCheckOut: tomorrow,
        ratePerNight: 8500,
        totalAmount: 17000,
        paidAmount: 0,
        status: "ACTIVE",
        checkedInById: userId,
      },
    });

    await db.room.update({
      where: { id: rooms["101"].id },
      data: { status: "OCCUPIED_CLEAN", currentStayId: activeStay.id },
    });

    await db.roomAllocation.create({
      data: {
        businessId,
        branchId,
        roomId: rooms["101"].id,
        stayId: activeStay.id,
        status: "CHECKED_IN",
        startDate: now,
        endDate: tomorrow,
        isBlocking: true,
      },
    });

    // Upcoming confirmed reservation for Room 201
    const nextWeekStart = new Date(Date.now() + 3 * 86400_000);
    const nextWeekEnd = new Date(Date.now() + 5 * 86400_000);
    await db.reservation.create({
      data: {
        businessId,
        branchId,
        roomTypeId: roomTypes["EXE"].id,
        roomId: rooms["201"].id,
        reservationNumber: "RES-DEMO-201",
        guestName: "Priya Adhikari",
        guestPhone: "9801998877",
        guestEmail: "priya@example.com",
        checkInDate: nextWeekStart,
        checkOutDate: nextWeekEnd,
        adults: 2,
        children: 1,
        nightlyRate: 14500,
        totalAmount: 29000,
        depositAmount: 5000,
        status: "CONFIRMED",
        createdById: userId,
      },
    });

    // Folio for Room 101 Stay
    const folio = await db.guestFolio.create({
      data: {
        businessId,
        branchId,
        stayId: activeStay.id,
        folioNumber: "FOL-DEMO-101",
        windowName: "PRIMARY",
        guestName: "Aarav Sharma",
        status: "OPEN",
        chargesTotal: 9605,
        creditsTotal: 0,
        paymentsTotal: 0,
        balance: 9605,
      },
    });

    const rnc = await db.roomNightCharge.create({
      data: {
        businessId,
        branchId,
        stayId: activeStay.id,
        folioId: folio.id,
        roomId: rooms["101"].id,
        chargeDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        baseRate: 8500,
        taxAmount: 1105,
        totalAmount: 9605,
        postedById: userId,
      },
    });

    await db.folioEntry.create({
      data: {
        businessId,
        branchId,
        folioId: folio.id,
        stayId: activeStay.id,
        entryNumber: "FE-DEMO-001",
        postingKind: "CHARGE",
        direction: "DEBIT",
        category: "ROOM",
        description: "Room 101 Nightly Accommodation (Heritage Deluxe King)",
        amount: 8500,
        taxAmount: 1105,
        totalAmount: 9605,
        sourceType: "ROOM_NIGHT",
        sourceId: rnc.id,
        isRevenueRecognizedHere: true,
        postedById: userId,
      },
    });
  }

  // 7. Housekeeping Task (Phase 5)
  const existingHk = await db.housekeepingTask.findFirst({
    where: { businessId, branchId, roomId: rooms["103"].id },
  });
  if (!existingHk) {
    await db.housekeepingTask.create({
      data: {
        businessId,
        branchId,
        roomId: rooms["103"].id,
        taskType: "CHECK_OUT_CLEANING",
        status: "DIRTY",
        priority: "HIGH",
        notes: "Deep clean & fresh linen setup before 2 PM arrival",
        assignedToId: userId,
      },
    });
  }

  // 8. QR Locations & Sample Service Request (Phase 7)
  const qrRoom101 = await db.qrLocation.upsert({
    where: {
      businessId_roomId: {
        businessId,
        roomId: rooms["101"].id,
      },
    },
    update: { isActive: true },
    create: {
      businessId,
      branchId,
      locationType: "ROOM",
      roomId: rooms["101"].id,
      publicCode: "QRL-RM-DEMO101",
      label: "Room 101 — Heritage Deluxe King",
      isActive: true,
      createdById: userId,
    },
  });

  await db.qrLocation.upsert({
    where: {
      businessId_tableId: {
        businessId,
        tableId: tables["T-01"].id,
      },
    },
    update: { isActive: true },
    create: {
      businessId,
      branchId,
      locationType: "TABLE",
      tableId: tables["T-01"].id,
      publicCode: "QRL-TB-DEMOT01",
      label: "Table T-01 — Courtyard Window",
      isActive: true,
      createdById: userId,
    },
  });

  const existingSr = await db.serviceRequest.findFirst({
    where: { businessId, branchId },
  });
  if (!existingSr) {
    await db.serviceRequest.create({
      data: {
        businessId,
        branchId,
        qrLocationId: qrRoom101.id,
        stayId: activeStay.id,
        roomId: rooms["101"].id,
        requestNumber: "SR-DEMO-001",
        requestType: "EXTRA_TOWELS",
        category: "HOUSEKEEPING",
        priority: "NORMAL",
        status: "OPEN",
        notes: "2 fresh bath towels and mineral water bottles please",
      },
    });
  }

  // 9. Property Feature Flags (Phase 8)
  await db.propertyFeatureFlag.upsert({
    where: {
      businessId_branchId: {
        businessId,
        branchId,
      },
    },
    update: {
      hotelEnabled: true,
      restaurantEnabled: true,
      kdsEnabled: true,
      guestQrEnabled: true,
      folioBridgeEnabled: true,
      offlineDraftSyncEnabled: true,
      printerFailoverEnabled: true,
      pilotMode: true,
    },
    create: {
      businessId,
      branchId,
      hotelEnabled: true,
      restaurantEnabled: true,
      kdsEnabled: true,
      guestQrEnabled: true,
      folioBridgeEnabled: true,
      offlineDraftSyncEnabled: true,
      printerFailoverEnabled: true,
      pilotMode: true,
      updatedById: userId,
    },
  });

  // 10. Active Dining Session, Multi-Station Order & Live KDS Tickets on Table T-02
  const existingTicket = await db.kitchenTicket.findFirst({
    where: { businessId, branchId },
  });
  if (!existingTicket) {
    let sess = await db.tableSession.findFirst({
      where: { businessId, branchId, tableId: tables["T-02"].id, status: "ACTIVE" },
    });
    if (!sess) {
      sess = await db.tableSession.create({
        data: {
          businessId,
          branchId,
          tableId: tables["T-02"].id,
          sessionNumber: `SESS-DEMO-${Date.now()}`,
          guestCount: 4,
          status: "ACTIVE",
          openedById: userId,
        },
      });
    }
    await db.restaurantTable.update({
      where: { id: tables["T-02"].id },
      data: { status: "OCCUPIED", currentSessionId: sess.id },
    });

    const momoItem = await db.menuItem.findFirst({
      where: { businessId, name: "Himalayan Jhol Momo" },
    });
    const thaliItem = await db.menuItem.findFirst({
      where: { businessId, name: "Royal Thakali Mutton Thali" },
    });

    if (momoItem && thaliItem) {
      await db.restaurantOrder.deleteMany({
        where: { businessId, branchId, orderNumber: "RO-DEMO-T02" },
      });
      const demoOrder = await db.restaurantOrder.create({
        data: {
          businessId,
          branchId,
          tableId: tables["T-02"].id,
          tableSessionId: sess.id,
          orderNumber: "RO-DEMO-T02",
          orderType: "DINE_IN",
          acceptanceStatus: "ACCEPTED",
          fulfillmentStatus: "PREPARING",
          settlementStatus: "UNPAID",
          subtotal: 3260,
          taxTotal: 423.8,
          totalAmount: 3683.8,
          createdById: userId,
        },
      });

      const demoRound = await db.orderRound.create({
        data: {
          businessId,
          orderId: demoOrder.id,
          roundNumber: 1,
          status: "SUBMITTED",
          submittedById: userId,
        },
      });

      const line1 = await db.orderLine.create({
        data: {
          businessId,
          orderId: demoOrder.id,
          roundId: demoRound.id,
          menuItemId: momoItem.id,
          itemName: momoItem.name,
          basePrice: 480,
          unitPrice: 480,
          quantity: 2,
          appliedModifiers: [],
          subtotal: 960,
          taxRate: 13,
          taxAmount: 124.8,
          total: 1084.8,
          acceptanceStatus: "ACCEPTED",
          fulfillmentStatus: "PREPARING",
        },
      });

      const line2 = await db.orderLine.create({
        data: {
          businessId,
          orderId: demoOrder.id,
          roundId: demoRound.id,
          menuItemId: thaliItem.id,
          itemName: thaliItem.name,
          basePrice: 1150,
          unitPrice: 1150,
          quantity: 2,
          appliedModifiers: [],
          subtotal: 2300,
          taxRate: 13,
          taxAmount: 299,
          total: 2599,
          acceptanceStatus: "ACCEPTED",
          fulfillmentStatus: "QUEUED",
          notes: "Extra ghee on buckwheat greens, no nuts",
        },
      });

      const kTicket1 = await db.kitchenTicket.create({
        data: {
          businessId,
          branchId,
          stationId: stations["HOT"].id,
          orderId: demoOrder.id,
          roundId: demoRound.id,
          ticketNumber: "KOT-DEMO-HOT-01",
          status: "PREPARING",
        },
      });
      await db.kitchenTicketLine.create({
        data: {
          businessId,
          ticketId: kTicket1.id,
          orderLineId: line1.id,
          itemName: line1.itemName,
          quantity: 2,
          modifiersSnapshot: [],
          dietaryAlerts: [],
          status: "PREPARING",
        },
      });

      const kTicket2 = await db.kitchenTicket.create({
        data: {
          businessId,
          branchId,
          stationId: stations["GRILL"].id,
          orderId: demoOrder.id,
          roundId: demoRound.id,
          ticketNumber: "KOT-DEMO-GRL-01",
          status: "QUEUED",
        },
      });
      await db.kitchenTicketLine.create({
        data: {
          businessId,
          ticketId: kTicket2.id,
          orderLineId: line2.id,
          itemName: line2.itemName,
          quantity: 2,
          modifiersSnapshot: [],
          notes: "Extra ghee on buckwheat greens, no nuts",
          dietaryAlerts: ["NO_NUTS"],
          status: "QUEUED",
        },
      });
    }
  }

  console.log("Hospitality demo seed completed! Public QR Codes:");
  console.log("  - Room 101 QR Portal: /guest/qr/QRL-RM-DEMO101 (Guest: Sharma, Phone Last 4: 8899)");
  console.log("  - Table T-01 QR Portal: /guest/qr/QRL-TB-DEMOT01");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
