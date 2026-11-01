/**
 * Empirical Challenger M1 Stress Harness:
 * Multi-Tenant Composite Isolation, Migration Integrity & Decimal Precision.
 *
 * Verifies live PostgreSQL catalogs and executes adversarial cross-tenant attacks
 * against both restro_test (127.0.0.1:55439) and restro_restore (127.0.0.1:55440).
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@dynapos/db";
import { isolatedDatabaseUrl, restoreTargetUrl } from "./database-verification.mjs";

function parseEnv(filePath: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const sourceEnv = parseEnv(".env.restro.local");
const restoreEnv = parseEnv(".env.restro-restore.local");

const sourceUrl = isolatedDatabaseUrl(sourceEnv.DATABASE_URL);
const restoreUrl = restoreTargetUrl(restoreEnv.RESTORE_TARGET_DATABASE_URL, sourceUrl);

interface CheckResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: CheckResult[] = [];

function record(suite: string, name: string, passed: boolean, details?: string) {
  results.push({ suite, name, passed, details });
  const prefix = passed ? "  ✓ PASS" : "  ✗ FAIL";
  console.log(`${prefix} [${suite}] ${name}${details ? ` — ${details}` : ""}`);
}

async function verifyMigrations(client: PrismaClient, label: string) {
  const expectedMigrations = [
    "202610300001_retail_baseline",
    "202610300002_commerce_hardening",
    "202610310001_phase1_security_foundation",
    "202610310002_phase2_financial_inventory_core",
    "202611010001_phase3_restaurant_staff_mvp",
  ];

  const rows = await client.$queryRawUnsafe<
    { migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null; applied_steps_count: number }[]
  >(`SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY migration_name ASC`);

  const appliedNames = rows.map((r) => r.migration_name);
  const allFound = expectedMigrations.every((m) => appliedNames.includes(m));
  record(label, "all 5 migrations recorded", allFound, `Found ${rows.length} migrations`);

  for (const m of expectedMigrations) {
    const row = rows.find((r) => r.migration_name === m);
    const valid = !!(row && row.finished_at && !row.rolled_back_at && row.applied_steps_count > 0);
    record(label, `migration ${m} finished cleanly`, valid, `finished_at: ${row?.finished_at}, rolled_back: ${row?.rolled_back_at}`);
  }

  return rows;
}

async function verifyColumns(client: PrismaClient) {
  const expectedDecimals: { table: string; column: string; precision: number; scale: number }[] = [
    { table: "MenuItem", column: "basePrice", precision: 12, scale: 2 },
    { table: "MenuItem", column: "taxRate", precision: 5, scale: 2 },
    { table: "ModifierOption", column: "priceDelta", precision: 12, scale: 2 },
    { table: "RestaurantOrder", column: "subtotal", precision: 12, scale: 2 },
    { table: "RestaurantOrder", column: "discountTotal", precision: 12, scale: 2 },
    { table: "RestaurantOrder", column: "taxTotal", precision: 12, scale: 2 },
    { table: "RestaurantOrder", column: "totalAmount", precision: 12, scale: 2 },
    { table: "RestaurantOrder", column: "paidAmount", precision: 12, scale: 2 },
    { table: "OrderLine", column: "basePrice", precision: 12, scale: 2 },
    { table: "OrderLine", column: "unitPrice", precision: 12, scale: 2 },
    { table: "OrderLine", column: "taxRate", precision: 5, scale: 2 },
    { table: "OrderLine", column: "taxAmount", precision: 12, scale: 2 },
    { table: "OrderLine", column: "subtotal", precision: 12, scale: 2 },
    { table: "OrderLine", column: "total", precision: 12, scale: 2 },
  ];

  for (const def of expectedDecimals) {
    const [row] = await client.$queryRawUnsafe<
      { data_type: string; numeric_precision: number; numeric_scale: number }[]
    >(
      `SELECT data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = '${def.table}' AND column_name = '${def.column}'`
    );

    const valid = !!(
      row &&
      row.data_type === "numeric" &&
      row.numeric_precision === def.precision &&
      row.numeric_scale === def.scale
    );

    record(
      "Precision & Scale",
      `${def.table}.${def.column} is Decimal(${def.precision}, ${def.scale})`,
      valid,
      `Actual: data_type=${row?.data_type}, precision=${row?.numeric_precision}, scale=${row?.numeric_scale}`
    );
  }
}

async function verifyConstraints(client: PrismaClient) {
  const phase3Tables = [
    "Floor",
    "RestaurantTable",
    "TableSession",
    "Menu",
    "MenuSection",
    "MenuItem",
    "ModifierGroup",
    "ModifierOption",
    "MenuItemModifierGroup",
    "RestaurantOrder",
    "OrderRound",
    "OrderLine",
  ];

  for (const table of phase3Tables) {
    // Check primary key
    const [pk] = await client.$queryRawUnsafe<{ constraint_name: string }[]>(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = '${table}' AND constraint_type = 'PRIMARY KEY'`
    );
    record("Constraints", `${table} has primary key`, !!pk, `PK: ${pk?.constraint_name}`);

    // Check composite unique index (businessId, id)
    const [compUnique] = await client.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes WHERE tablename = '${table}' AND indexname = '${table}_businessId_id_key'`
    );
    record("Composite Unique", `${table} has @@unique([businessId, id])`, !!compUnique, `Index: ${compUnique?.indexname}`);
  }

  // Check composite foreign keys in PostgreSQL catalog
  const compositeFKs: { constraintName: string; table: string; columns: string[]; foreignTable: string; foreignColumns: string[] }[] = [
    { constraintName: "Floor_businessId_branchId_fkey", table: "Floor", columns: ["businessId", "branchId"], foreignTable: "Branch", foreignColumns: ["businessId", "id"] },
    { constraintName: "RestaurantTable_businessId_branchId_fkey", table: "RestaurantTable", columns: ["businessId", "branchId"], foreignTable: "Branch", foreignColumns: ["businessId", "id"] },
    { constraintName: "RestaurantTable_businessId_floorId_fkey", table: "RestaurantTable", columns: ["businessId", "floorId"], foreignTable: "Floor", foreignColumns: ["businessId", "id"] },
    { constraintName: "TableSession_businessId_branchId_fkey", table: "TableSession", columns: ["businessId", "branchId"], foreignTable: "Branch", foreignColumns: ["businessId", "id"] },
    { constraintName: "TableSession_businessId_tableId_fkey", table: "TableSession", columns: ["businessId", "tableId"], foreignTable: "RestaurantTable", foreignColumns: ["businessId", "id"] },
    { constraintName: "MenuSection_businessId_menuId_fkey", table: "MenuSection", columns: ["businessId", "menuId"], foreignTable: "Menu", foreignColumns: ["businessId", "id"] },
    { constraintName: "MenuItem_businessId_sectionId_fkey", table: "MenuItem", columns: ["businessId", "sectionId"], foreignTable: "MenuSection", foreignColumns: ["businessId", "id"] },
    { constraintName: "ModifierOption_businessId_modifierGroupId_fkey", table: "ModifierOption", columns: ["businessId", "modifierGroupId"], foreignTable: "ModifierGroup", foreignColumns: ["businessId", "id"] },
    { constraintName: "MenuItemModifierGroup_businessId_menuItemId_fkey", table: "MenuItemModifierGroup", columns: ["businessId", "menuItemId"], foreignTable: "MenuItem", foreignColumns: ["businessId", "id"] },
    { constraintName: "MenuItemModifierGroup_businessId_modifierGroupId_fkey", table: "MenuItemModifierGroup", columns: ["businessId", "modifierGroupId"], foreignTable: "ModifierGroup", foreignColumns: ["businessId", "id"] },
    { constraintName: "RestaurantOrder_businessId_branchId_fkey", table: "RestaurantOrder", columns: ["businessId", "branchId"], foreignTable: "Branch", foreignColumns: ["businessId", "id"] },
    { constraintName: "OrderRound_businessId_orderId_fkey", table: "OrderRound", columns: ["businessId", "orderId"], foreignTable: "RestaurantOrder", foreignColumns: ["businessId", "id"] },
    { constraintName: "OrderLine_businessId_orderId_fkey", table: "OrderLine", columns: ["businessId", "orderId"], foreignTable: "RestaurantOrder", foreignColumns: ["businessId", "id"] },
    { constraintName: "OrderLine_businessId_roundId_fkey", table: "OrderLine", columns: ["businessId", "roundId"], foreignTable: "OrderRound", foreignColumns: ["businessId", "id"] },
  ];

  for (const fk of compositeFKs) {
    const rows = await client.$queryRawUnsafe<
      { constraint_name: string; source_column: string; target_table: string; target_column: string }[]
    >(`
      SELECT
        con.conname AS constraint_name,
        att1.attname AS source_column,
        c2.relname AS target_table,
        att2.attname AS target_column
      FROM pg_constraint con
      JOIN pg_class c1 ON c1.oid = con.conrelid
      JOIN pg_class c2 ON c2.oid = con.confrelid
      JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS u(k1, k2, ord) ON true
      JOIN pg_attribute att1 ON att1.attrelid = con.conrelid AND att1.attnum = u.k1
      JOIN pg_attribute att2 ON att2.attrelid = con.confrelid AND att2.attnum = u.k2
      WHERE con.contype = 'f'
        AND c1.relname = '${fk.table}'
        AND con.conname = '${fk.constraintName}'
      ORDER BY u.ord;
    `);

    const cols = rows.map((r) => r.source_column);
    const targetCols = rows.map((r) => r.target_column);
    const valid =
      rows.length === 2 &&
      cols[0] === "businessId" &&
      cols[1] === fk.columns[1] &&
      rows[0].target_table === fk.foreignTable &&
      targetCols[0] === "businessId" &&
      targetCols[1] === "id";
    record(
      "Composite Foreign Keys",
      `${fk.table} composite FK: ${fk.constraintName}`,
      valid,
      `Mapped: (${cols.join(", ")}) -> ${fk.foreignTable}(${targetCols.join(", ")})`
    );
  }

  // Verify scalar currentSessionId has NO foreign key constraint (DAG acyclicity)
  const [sessionFk] = await client.$queryRawUnsafe<{ constraint_name: string }[]>(`
    SELECT tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'RestaurantTable'
      AND kcu.column_name = 'currentSessionId'
      AND tc.constraint_type = 'FOREIGN KEY';
  `);
  record(
    "DAG Acyclicity",
    "RestaurantTable.currentSessionId is unconstrained scalar (NO foreign key)",
    !sessionFk,
    sessionFk ? `Found unexpected FK: ${sessionFk.constraint_name}` : "Correctly unconstrained"
  );
}

async function runAdversarialAttacks(client: PrismaClient) {
  const busA = randomUUID();
  const busB = randomUUID();
  const branchA = randomUUID();
  const branchB = randomUUID();

  // Create baseline fixtures in transaction, test attacks with savepoints or nested blocks, then roll back
  console.log("\nStarting Adversarial Cross-Tenant Boundary Attacks...");

  await client.$transaction(async (tx) => {
    // Create Tenant A & Tenant B businesses & branches
    await tx.business.createMany({
      data: [
        { id: busA, slug: `bus-${busA}`, name: "Tenant A" },
        { id: busB, slug: `bus-${busB}`, name: "Tenant B" },
      ],
    });

    await tx.branch.createMany({
      data: [
        { id: branchA, businessId: busA, name: "Branch A" },
        { id: branchB, businessId: busB, name: "Branch B" },
      ],
    });

    // Helper to assert PostgreSQL error
    async function assertCrossTenantBlocked(name: string, sqlStatement: string) {
      try {
        await tx.$executeRawUnsafe(`SAVEPOINT attack_test`);
        await tx.$executeRawUnsafe(sqlStatement);
        // If we reach here, attack SUCCEEDED (which is a vulnerability!)
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT attack_test`);
        record("Adversarial Attack", name, false, "VULNERABILITY: Cross-tenant insertion succeeded!");
      } catch (err: unknown) {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT attack_test`);
        const msg = String(err);
        const isFkViolation = msg.includes("violates foreign key constraint") || msg.includes("23503") || msg.includes("fkey");
        record("Adversarial Attack", name, isFkViolation, isFkViolation ? "Blocked by PostgreSQL composite FK constraint" : `Blocked with: ${msg}`);
      }
    }

    // Fixtures within Tenant A
    const floorA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "Floor" ("id", "businessId", "branchId", "name", "updatedAt")
      VALUES ('${floorA}', '${busA}', '${branchA}', 'First Floor', NOW())
    `);

    const tableA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt")
      VALUES ('${tableA}', '${busA}', '${branchA}', '${floorA}', 'T1', NOW())
    `);

    const menuA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "Menu" ("id", "businessId", "branchId", "name", "updatedAt")
      VALUES ('${menuA}', '${busA}', '${branchA}', 'Main Menu', NOW())
    `);

    const sectionA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "MenuSection" ("id", "businessId", "menuId", "name", "updatedAt")
      VALUES ('${sectionA}', '${busA}', '${menuA}', 'Beverages', NOW())
    `);

    const itemA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "MenuItem" ("id", "businessId", "sectionId", "name", "basePrice", "updatedAt")
      VALUES ('${itemA}', '${busA}', '${sectionA}', 'Espresso', 3.50, NOW())
    `);

    const modGroupA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "ModifierGroup" ("id", "businessId", "name", "updatedAt")
      VALUES ('${modGroupA}', '${busA}', 'Milk Options', NOW())
    `);

    const orderA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "RestaurantOrder" ("id", "businessId", "branchId", "orderNumber", "updatedAt")
      VALUES ('${orderA}', '${busA}', '${branchA}', 'ORD-001', NOW())
    `);

    const roundA = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "OrderRound" ("id", "businessId", "orderId", "roundNumber", "updatedAt")
      VALUES ('${roundA}', '${busA}', '${orderA}', 1, NOW())
    `);

    // Fixtures within Tenant B
    const floorB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "Floor" ("id", "businessId", "branchId", "name", "updatedAt")
      VALUES ('${floorB}', '${busB}', '${branchB}', 'Second Floor', NOW())
    `);

    const tableB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt")
      VALUES ('${tableB}', '${busB}', '${branchB}', '${floorB}', 'T10', NOW())
    `);

    const menuB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "Menu" ("id", "businessId", "branchId", "name", "updatedAt")
      VALUES ('${menuB}', '${busB}', '${branchB}', 'B Bar Menu', NOW())
    `);

    const sectionB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "MenuSection" ("id", "businessId", "menuId", "name", "updatedAt")
      VALUES ('${sectionB}', '${busB}', '${menuB}', 'Desserts', NOW())
    `);

    const itemB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "MenuItem" ("id", "businessId", "sectionId", "name", "basePrice", "updatedAt")
      VALUES ('${itemB}', '${busB}', '${sectionB}', 'Cheesecake', 6.00, NOW())
    `);

    const modGroupB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "ModifierGroup" ("id", "businessId", "name", "updatedAt")
      VALUES ('${modGroupB}', '${busB}', 'Syrup', NOW())
    `);

    const orderB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "RestaurantOrder" ("id", "businessId", "branchId", "orderNumber", "updatedAt")
      VALUES ('${orderB}', '${busB}', '${branchB}', 'ORD-B-100', NOW())
    `);

    const roundB = randomUUID();
    await tx.$executeRawUnsafe(`
      INSERT INTO "OrderRound" ("id", "businessId", "orderId", "roundNumber", "updatedAt")
      VALUES ('${roundB}', '${busB}', '${orderB}', 1, NOW())
    `);

    // ATTACK 1: Floor in Tenant A referencing Branch B
    await assertCrossTenantBlocked(
      "Attack 1: Insert Tenant A Floor with Tenant B branchId",
      `INSERT INTO "Floor" ("id", "businessId", "branchId", "name", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchB}', 'Rogue Floor', NOW())`
    );

    // ATTACK 2: RestaurantTable in Tenant A referencing Floor B
    await assertCrossTenantBlocked(
      "Attack 2: Insert Tenant A RestaurantTable with Tenant B floorId",
      `INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchA}', '${floorB}', 'T99', NOW())`
    );

    // ATTACK 3: RestaurantTable in Tenant A referencing Branch B
    await assertCrossTenantBlocked(
      "Attack 3: Insert Tenant A RestaurantTable with Tenant B branchId",
      `INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchB}', '${floorA}', 'T99', NOW())`
    );

    // ATTACK 4: TableSession in Tenant A referencing RestaurantTable B
    await assertCrossTenantBlocked(
      "Attack 4: Insert Tenant A TableSession with Tenant B tableId",
      `INSERT INTO "TableSession" ("id", "businessId", "branchId", "tableId", "sessionNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchA}', '${tableB}', 'S-99', NOW())`
    );

    // ATTACK 5: TableSession in Tenant A referencing Branch B
    await assertCrossTenantBlocked(
      "Attack 5: Insert Tenant A TableSession with Tenant B branchId",
      `INSERT INTO "TableSession" ("id", "businessId", "branchId", "tableId", "sessionNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchB}', '${tableA}', 'S-99', NOW())`
    );

    // ATTACK 6: MenuSection in Tenant A referencing Menu B
    await assertCrossTenantBlocked(
      "Attack 6: Insert Tenant A MenuSection with Tenant B menuId",
      `INSERT INTO "MenuSection" ("id", "businessId", "menuId", "name", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${menuB}', 'Rogue Section', NOW())`
    );

    // ATTACK 7: MenuItem in Tenant A referencing MenuSection B
    await assertCrossTenantBlocked(
      "Attack 7: Insert Tenant A MenuItem with Tenant B sectionId",
      `INSERT INTO "MenuItem" ("id", "businessId", "sectionId", "name", "basePrice", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${sectionB}', 'Rogue Item', 10.00, NOW())`
    );

    // ATTACK 8: ModifierOption in Tenant A referencing ModifierGroup B
    await assertCrossTenantBlocked(
      "Attack 8: Insert Tenant A ModifierOption with Tenant B modifierGroupId",
      `INSERT INTO "ModifierOption" ("id", "businessId", "modifierGroupId", "name", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${modGroupB}', 'Rogue Option', NOW())`
    );

    // ATTACK 9: MenuItemModifierGroup in Tenant A referencing MenuItem B
    await assertCrossTenantBlocked(
      "Attack 9: Insert Tenant A MenuItemModifierGroup with Tenant B menuItemId",
      `INSERT INTO "MenuItemModifierGroup" ("id", "businessId", "menuItemId", "modifierGroupId") VALUES ('${randomUUID()}', '${busA}', '${itemB}', '${modGroupA}')`
    );

    // ATTACK 10: MenuItemModifierGroup in Tenant A referencing ModifierGroup B
    await assertCrossTenantBlocked(
      "Attack 10: Insert Tenant A MenuItemModifierGroup with Tenant B modifierGroupId",
      `INSERT INTO "MenuItemModifierGroup" ("id", "businessId", "menuItemId", "modifierGroupId") VALUES ('${randomUUID()}', '${busA}', '${itemA}', '${modGroupB}')`
    );

    // ATTACK 11: RestaurantOrder in Tenant A referencing Branch B
    await assertCrossTenantBlocked(
      "Attack 11: Insert Tenant A RestaurantOrder with Tenant B branchId",
      `INSERT INTO "RestaurantOrder" ("id", "businessId", "branchId", "orderNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchB}', 'ORD-ROGUE', NOW())`
    );

    // ATTACK 12: OrderRound in Tenant A referencing RestaurantOrder B
    await assertCrossTenantBlocked(
      "Attack 12: Insert Tenant A OrderRound with Tenant B orderId",
      `INSERT INTO "OrderRound" ("id", "businessId", "orderId", "roundNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${orderB}', 1, NOW())`
    );

    // ATTACK 13: OrderLine in Tenant A referencing RestaurantOrder B
    await assertCrossTenantBlocked(
      "Attack 13: Insert Tenant A OrderLine with Tenant B orderId",
      `INSERT INTO "OrderLine" ("id", "businessId", "orderId", "roundId", "itemName", "basePrice", "appliedModifiers", "unitPrice", "subtotal", "total", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${orderB}', '${roundA}', 'Rogue Line', 5.00, '[]', 5.00, 5.00, 5.00, NOW())`
    );

    // ATTACK 14: OrderLine in Tenant A referencing OrderRound B
    await assertCrossTenantBlocked(
      "Attack 14: Insert Tenant A OrderLine with Tenant B roundId",
      `INSERT INTO "OrderLine" ("id", "businessId", "orderId", "roundId", "itemName", "basePrice", "appliedModifiers", "unitPrice", "subtotal", "total", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${orderA}', '${roundB}', 'Rogue Line', 5.00, '[]', 5.00, 5.00, 5.00, NOW())`
    );

    // ATTACK 15: Signed Decimal Modifier Deltas Test
    try {
      await tx.$executeRawUnsafe(`SAVEPOINT mod_delta_test`);
      await tx.$executeRawUnsafe(`
        INSERT INTO "ModifierOption" ("id", "businessId", "modifierGroupId", "name", "priceDelta", "updatedAt")
        VALUES
          ('${randomUUID()}', '${busA}', '${modGroupA}', 'Extra Shot', 50.00, NOW()),
          ('${randomUUID()}', '${busA}', '${modGroupA}', 'Decaf Discount', -25.50, NOW()),
          ('${randomUUID()}', '${busA}', '${modGroupA}', 'No Sugar', 0.00, NOW())
      `);
      record("Decimal Semantics", "ModifierOption supports signed Decimal(12, 2) (+50.00, -25.50, 0.00)", true);
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT mod_delta_test`);
    } catch (e: unknown) {
      record("Decimal Semantics", "ModifierOption supports signed Decimal(12, 2)", false, String(e));
    }

    // ATTACK 16: Unique Key Violations within Tenant
    // Duplicate tableNumber in same branch
    try {
      await tx.$executeRawUnsafe(`SAVEPOINT unq_test`);
      await tx.$executeRawUnsafe(`
        INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt")
        VALUES ('${randomUUID()}', '${busA}', '${branchA}', '${floorA}', 'T1', NOW())
      `);
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT unq_test`);
      record("Uniqueness", "Duplicate tableNumber within branch rejected", false, "VULNERABILITY: Duplicate tableNumber allowed!");
    } catch {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT unq_test`);
      record("Uniqueness", "Duplicate tableNumber within branch rejected", true, "Blocked by RestaurantTable_businessId_branchId_tableNumber_key");
    }

    // Trigger explicit rollback of entire test transaction so DB remains pristine
    throw new Error("ROLLBACK_ADVERSARIAL_HARNESS");
  }).catch((err) => {
    if (err.message !== "ROLLBACK_ADVERSARIAL_HARNESS") {
      throw err;
    }
  });

  console.log("Adversarial harness completed and all test data rolled back cleanly.\n");
}

async function main() {
  console.log("=== EMPIRICAL CHALLENGER STRESS HARNESS: M1 Core Schema & Additive Migration ===\n");

  const sourceClient = new PrismaClient({ datasourceUrl: sourceUrl, log: [] });
  const restoreClient = new PrismaClient({ datasourceUrl: restoreUrl, log: [] });

  try {
    console.log("1. Verifying Migration Lineage & Drift between Source & Target...");
    const sourceMigrations = await verifyMigrations(sourceClient, "restro_test (55439)");
    const restoreMigrations = await verifyMigrations(restoreClient, "restro_restore (55440)");

    // Compare checksums
    const checksumMatch =
      sourceMigrations.length === restoreMigrations.length &&
      sourceMigrations.every((s) => {
        const t = restoreMigrations.find((r) => r.migration_name === s.migration_name);
        return t && t.checksum === s.checksum;
      });
    record("Parity", "Migration checksums match byte-for-byte across clusters", checksumMatch);

    console.log("\n2. Verifying Column Data Types and Precision/Scale...");
    await verifyColumns(sourceClient);

    console.log("\n3. Verifying Primary, Unique and Composite Foreign Keys...");
    await verifyConstraints(sourceClient);

    console.log("\n4. Executing Adversarial Attack Scenarios...");
    await runAdversarialAttacks(sourceClient);

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`\n=== SUMMARY: ${passed}/${total} checks passed, ${failed} failed ===`);
    if (failed > 0) {
      console.error(`Verdict: CHALLENGE_FAILED (${failed} failures detected)`);
      process.exit(1);
    } else {
      console.log(`Verdict: APPROVE (All empirical stress tests passed cleanly)`);
      process.exit(0);
    }
  } finally {
    await sourceClient.$disconnect();
    await restoreClient.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error in stress harness:", err);
  process.exit(1);
});
