import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "../../../packages/db/client";
import * as format from "../../../backend/src/lib/backup-format";

const primaryUrl = "postgresql://restro_dev:3e0c38bc16116ed5e530270067a32f28ab59656a39dddd60@127.0.0.1:55439/restro_test";
const source = new PrismaClient({ datasourceUrl: primaryUrl });

const model = (client: any, name: string) => client[name[0].toLowerCase() + name.slice(1)];
const tableNames = [...format.backupModels.map(entity => entity.name), "BusinessRegistrationRequest"];
const ident = (name: string) => `"${name}"`;

type Fingerprint = Record<string, string>;
async function fingerprint(client: any): Promise<Fingerprint> {
  const result: Fingerprint = {};
  for (const name of tableNames) {
    const [row] = await client.$queryRawUnsafe(`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t."id")), '') AS h FROM ${ident(name)} t`);
    result[name] = `${row.n}:${row.h}`;
  }
  return result;
}

type Row = Record<string, unknown>;
interface Tenant { businessId: string; ids: Record<string, string>; created: Map<string, string[]> }

async function seedTenant(client: any, label: string, withExtras: boolean): Promise<Tenant> {
  const businessId = randomUUID();
  const ids: Record<string, string> = {};
  const created = new Map<string, string[]>();
  for (const entity of format.backupModels) ids[entity.name] = entity.name === "Business" ? businessId : randomUUID();

  function row(entityName: string, id: string, tag: string, overrides: Row = {}): Row {
    const entity = format.backupModels.find(candidate => candidate.name === entityName)!;
    const data: Row = { id };
    for (const field of entity.fields.filter(field => field.kind !== "object" && field.name !== "id")) {
      const relation = entity.fields.find(parent => parent.relationFromFields?.includes(field.name));
      if (relation) data[field.name] = ids[relation.type];
      else if (field.name === "businessId") data[field.name] = businessId;
      else if (field.name === "productId") data[field.name] = ids.Product;
      else if (field.name === "branchId") data[field.name] = ids.Branch;
      else if (field.type === "Json") data[field.name] = field.isRequired ? { response: "synthetic", label, financialTotal: 125.25 } : Prisma.DbNull;
      else if (field.name === "deletedAt" && ["Customer", "Product"].includes(entityName)) data[field.name] = new Date("2025-01-02T03:04:05.000Z");
      else if (!field.isRequired || field.hasDefaultValue) continue;
      else data[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : (field.type === "Float" || field.type === "Decimal") ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entityName}-${field.name}-${tag}`;
    }
    if (entityName === "Business") data.settings = Prisma.JsonNull;
    if (entityName === "Sale") Object.assign(data, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
    if (entityName === "Payment") Object.assign(data, { amount: 25.25, method: "CASH" });
    if (entityName === "Customer") data.balance = 100;
    if (entityName === "CustomerLedger") Object.assign(data, { debit: 100, balance: 100 });
    if (entityName === "Supplier") data.balance = 75.5;
    if (entityName === "SupplierLedger") Object.assign(data, { credit: 75.5, balance: 75.5 });
    if (["ProductStock", "Batch"].includes(entityName)) data.quantity = 7.5;
    if (entityName === "PaymentAllocation") Object.assign(data, { amount: 25.25, saleId: ids.Sale, purchaseId: null });
    if (entityName === "PaymentReversal") Object.assign(data, { reason: "Synthetic payment reversal" });
    if (entityName === "Refund") Object.assign(data, { amount: 25.25, reason: "Synthetic customer return", method: "CASH", status: "COMPLETED" });
    if (entityName === "StockMovement") Object.assign(data, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
    if (entityName === "OutboxEvent") Object.assign(data, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", label, financialTotal: 125.25 }, status: "PENDING" });
    if (entityName === "Reservation") Object.assign(data, {
      checkInDate: new Date("2025-01-02T14:00:00.000Z"),
      checkOutDate: new Date("2025-01-05T11:00:00.000Z"),
      totalAmount: 300,
      depositAmount: 100,
    });
    if (entityName === "Stay") Object.assign(data, {
      checkInTime: new Date("2025-01-02T14:00:00.000Z"),
      expectedCheckOut: new Date("2025-01-05T11:00:00.000Z"),
      ratePerNight: 100,
      totalAmount: 300,
      paidAmount: 100,
    });
    if (entityName === "RoomAllocation") Object.assign(data, {
      startDate: new Date("2025-01-02T14:00:00.000Z"),
      endDate: new Date("2025-01-05T11:00:00.000Z"),
      maintenanceTicketId: null,
    });
    if (entityName === "MaintenanceTicket") Object.assign(data, {
      startDate: new Date("2025-01-10T10:00:00.000Z"),
      endDate: new Date("2025-01-12T18:00:00.000Z"),
    });
    return { ...data, ...overrides };
  }

  async function insert(tx: any, entityName: string, data: Row) {
    await model(tx, entityName).createMany({ data: [data] });
    created.set(entityName, [...(created.get(entityName) || []), data.id as string]);
  }

  await client.$transaction(async (tx: any) => {
    for (const entity of format.backupModels) await insert(tx, entity.name, row(entity.name, ids[entity.name], businessId));
  });

  return { businessId, ids, created };
}

async function removeTenant(client: any, tenant: Tenant) {
  await client.$transaction(async (tx: any) => {
    for (const entity of [...format.backupModels].reverse()) {
      const created = tenant.created.get(entity.name);
      if (created?.length) await model(tx, entity.name).deleteMany({ where: { id: { in: created } } });
    }
  });
}

async function run() {
  const baseline = await fingerprint(source);
  console.log("Seeding test tenant...");
  const t = await seedTenant(source, "diag", false);
  console.log("Removing test tenant...");
  await removeTenant(source, t);
  const after = await fingerprint(source);

  const diff = Object.keys(baseline).filter(k => baseline[k] !== after[k]);
  console.log("Diff count:", diff.length);
  if (diff.length > 0) {
    console.log("Diff tables:", diff);
    for (const k of diff.slice(0, 5)) {
      console.log(`Table ${k}: baseline=${baseline[k]}, after=${after[k]}`);
    }
  } else {
    console.log("PERFECT MATCH: baseline equals after!");
  }
  await source.$disconnect();
}

run().catch(console.error);
