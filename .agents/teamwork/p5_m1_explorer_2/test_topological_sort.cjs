const { Prisma } = require('../../../packages/db/client/index.js');

function testTopologicalSort() {
  const existingModels = Prisma.dmmf.datamodel.models;
  console.log('Existing DMMF models count:', existingModels.length);

  // Define synthetic DMMF representations of the 8 Phase 5 models
  const phase5Models = [
    {
      name: "RoomType",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
      ]
    },
    {
      name: "Room",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
        { name: "roomTypeId", kind: "scalar", type: "String" },
        { name: "roomType", kind: "object", type: "RoomType", relationFromFields: ["roomTypeId"], relationToFields: ["id"] },
        { name: "floorId", kind: "scalar", type: "String" },
        { name: "floor", kind: "object", type: "Floor", relationFromFields: ["floorId"], relationToFields: ["id"] },
        { name: "currentStayId", kind: "scalar", type: "String" }, // Pure scalar, NO relationFromFields!
      ]
    },
    {
      name: "Reservation",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
        { name: "roomTypeId", kind: "scalar", type: "String" },
        { name: "roomType", kind: "object", type: "RoomType", relationFromFields: ["roomTypeId"], relationToFields: ["id"] },
        { name: "roomId", kind: "scalar", type: "String" },
        { name: "room", kind: "object", type: "Room", relationFromFields: ["roomId"], relationToFields: ["id"] },
        { name: "createdById", kind: "scalar", type: "String" },
        { name: "createdBy", kind: "object", type: "User", relationFromFields: ["createdById"], relationToFields: ["id"] },
      ]
    },
    {
      name: "ReservationGuest",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "reservationId", kind: "scalar", type: "String" },
        { name: "reservation", kind: "object", type: "Reservation", relationFromFields: ["reservationId"], relationToFields: ["id"] },
      ]
    },
    {
      name: "Stay",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
        { name: "reservationId", kind: "scalar", type: "String" },
        { name: "reservation", kind: "object", type: "Reservation", relationFromFields: ["reservationId"], relationToFields: ["id"] },
        { name: "roomId", kind: "scalar", type: "String" },
        { name: "room", kind: "object", type: "Room", relationFromFields: ["roomId"], relationToFields: ["id"] },
        { name: "checkedInById", kind: "scalar", type: "String" },
        { name: "checkedInBy", kind: "object", type: "User", relationFromFields: ["checkedInById"], relationToFields: ["id"] },
        { name: "checkedOutById", kind: "scalar", type: "String" },
        { name: "checkedOutBy", kind: "object", type: "User", relationFromFields: ["checkedOutById"], relationToFields: ["id"] },
      ]
    },
    {
      name: "MaintenanceTicket",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
        { name: "roomId", kind: "scalar", type: "String" },
        { name: "room", kind: "object", type: "Room", relationFromFields: ["roomId"], relationToFields: ["id"] },
        { name: "reportedById", kind: "scalar", type: "String" },
        { name: "reportedBy", kind: "object", type: "User", relationFromFields: ["reportedById"], relationToFields: ["id"] },
        { name: "assignedToId", kind: "scalar", type: "String" },
        { name: "assignedTo", kind: "object", type: "User", relationFromFields: ["assignedToId"], relationToFields: ["id"] },
        { name: "resolvedById", kind: "scalar", type: "String" },
        { name: "resolvedBy", kind: "object", type: "User", relationFromFields: ["resolvedById"], relationToFields: ["id"] },
      ]
    },
    {
      name: "RoomAllocation",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
        { name: "roomId", kind: "scalar", type: "String" },
        { name: "room", kind: "object", type: "Room", relationFromFields: ["roomId"], relationToFields: ["id"] },
        { name: "reservationId", kind: "scalar", type: "String" },
        { name: "reservation", kind: "object", type: "Reservation", relationFromFields: ["reservationId"], relationToFields: ["id"] },
        { name: "stayId", kind: "scalar", type: "String" },
        { name: "stay", kind: "object", type: "Stay", relationFromFields: ["stayId"], relationToFields: ["id"] },
        { name: "maintenanceTicketId", kind: "scalar", type: "String" },
        { name: "maintenanceTicket", kind: "object", type: "MaintenanceTicket", relationFromFields: ["maintenanceTicketId"], relationToFields: ["id"] },
      ]
    },
    {
      name: "HousekeepingTask",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "businessId", kind: "scalar", type: "String" },
        { name: "business", kind: "object", type: "Business", relationFromFields: ["businessId"], relationToFields: ["id"] },
        { name: "branchId", kind: "scalar", type: "String" },
        { name: "branch", kind: "object", type: "Branch", relationFromFields: ["branchId"], relationToFields: ["id"] },
        { name: "roomId", kind: "scalar", type: "String" },
        { name: "room", kind: "object", type: "Room", relationFromFields: ["roomId"], relationToFields: ["id"] },
        { name: "stayId", kind: "scalar", type: "String" },
        { name: "stay", kind: "object", type: "Stay", relationFromFields: ["stayId"], relationToFields: ["id"] },
        { name: "assignedToId", kind: "scalar", type: "String" },
        { name: "assignedTo", kind: "object", type: "User", relationFromFields: ["assignedToId"], relationToFields: ["id"] },
        { name: "completedById", kind: "scalar", type: "String" },
        { name: "completedBy", kind: "object", type: "User", relationFromFields: ["completedById"], relationToFields: ["id"] },
      ]
    }
  ];

  const allModels = [...existingModels, ...phase5Models];
  const excludedModels = ["BusinessRegistrationRequest"];
  const models = allModels.filter(m => !excludedModels.includes(m.name));
  const backupModels = [];
  const pending = [...models];

  while (pending.length) {
    const index = pending.findIndex(model =>
      model.fields
        .filter(field => field.relationFromFields?.length)
        .every(field => backupModels.some(parent => parent.name === field.type))
    );
    if (index < 0) {
      console.error('FAILED to resolve remaining pending models:', pending.map(m => m.name));
      throw new Error("Backup schema has unsupported dependency cycle");
    }
    backupModels.push(pending.splice(index, 1)[0]);
  }

  console.log('Topological sort SUCCEEDED! Total backup models:', backupModels.length);
  const phase5Indices = phase5Models.map(m => ({
    name: m.name,
    index: backupModels.findIndex(bm => bm.name === m.name)
  }));
  console.log('Phase 5 models indices in topological sort:', phase5Indices);

  // Now test adversarial cycle: what if Room.currentStayId had @relation to Stay?
  const cycleRoom = phase5Models.find(m => m.name === "Room");
  const roomWithCycle = {
    ...cycleRoom,
    fields: [
      ...cycleRoom.fields,
      { name: "currentStay", kind: "object", type: "Stay", relationFromFields: ["currentStayId"], relationToFields: ["id"] }
    ]
  };
  const adversarialModels = allModels.map(m => m.name === "Room" ? roomWithCycle : m).filter(m => !excludedModels.includes(m.name));
  const advBackup = [];
  const advPending = [...adversarialModels];
  let cycleDetected = false;
  while (advPending.length) {
    const index = advPending.findIndex(model =>
      model.fields
        .filter(field => field.relationFromFields?.length)
        .every(field => advBackup.some(parent => parent.name === field.type))
    );
    if (index < 0) {
      cycleDetected = true;
      console.log('Adversarial test: circular reference correctly detected and rejected! Cycle blocked:', advPending.map(m => m.name));
      break;
    }
    advBackup.push(advPending.splice(index, 1)[0]);
  }
  if (!cycleDetected) {
    throw new Error('Adversarial cycle was unexpectedly not detected!');
  }
}

testTopologicalSort();
