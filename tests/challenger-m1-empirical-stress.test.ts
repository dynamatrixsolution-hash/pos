import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Prisma } from "@dynapos/db";
import { isolatedDatabaseUrl } from "../scripts/database-verification.mjs";

describe("Challenger 2 Empirical Stress Harness: Multi-Tenant Composite Isolation & Decimal Precision", () => {
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

  // =========================================================================
  // 1. DMMF Schema Static Verification
  // =========================================================================
  describe("1. DMMF Model Unique Identifiers & Monetary Field Types", () => {
    it("ensures every Phase 3 model declares @@unique([businessId, id])", () => {
      const models = Prisma.dmmf.datamodel.models;
      for (const tableName of phase3Tables) {
        const model = models.find((m) => m.name === tableName);
        expect(model, `Model ${tableName} missing from DMMF`).toBeDefined();

        const hasCompositeUnique = model!.uniqueFields.some(
          (fields) => fields.length === 2 && fields.includes("businessId") && fields.includes("id")
        ) || model!.primaryKey?.fields.includes("businessId");

        // Check @@unique compound constraints
        const hasCompoundUnique = model!.uniqueFields.some(
          (u) => JSON.stringify(u.sort()) === JSON.stringify(["businessId", "id"])
        );

        expect(
          hasCompoundUnique,
          `Model ${tableName} must enforce @@unique([businessId, id]) for composite multi-tenant isolation`
        ).toBe(true);
      }
    });

    it("verifies monetary amount and price delta fields use Decimal in DMMF", () => {
      const models = Prisma.dmmf.datamodel.models;
      const monetaryFields: { model: string; field: string }[] = [
        { model: "MenuItem", field: "basePrice" },
        { model: "ModifierOption", field: "priceDelta" },
        { model: "RestaurantOrder", field: "subtotal" },
        { model: "RestaurantOrder", field: "discountTotal" },
        { model: "RestaurantOrder", field: "taxTotal" },
        { model: "RestaurantOrder", field: "totalAmount" },
        { model: "RestaurantOrder", field: "paidAmount" },
        { model: "OrderLine", field: "basePrice" },
        { model: "OrderLine", field: "unitPrice" },
        { model: "OrderLine", field: "taxAmount" },
        { model: "OrderLine", field: "subtotal" },
        { model: "OrderLine", field: "total" },
      ];

      for (const { model: modelName, field: fieldName } of monetaryFields) {
        const model = models.find((m) => m.name === modelName)!;
        const field = model.fields.find((f) => f.name === fieldName);
        expect(field, `Field ${modelName}.${fieldName} not found`).toBeDefined();
        expect(field!.type).toBe("Decimal");
      }
    });
  });

  // =========================================================================
  // 2. Migration SQL Static Audit
  // =========================================================================
  describe("2. Migration SQL Static Audit: Composite FKs & Decimal(12, 2)", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");

    it("verifies all 12 Phase 3 tables are created with PRIMARY KEY (id) and composite unique index", () => {
      for (const table of phase3Tables) {
        expect(sql).toContain(`CREATE TABLE "${table}"`);
        expect(sql).toContain(`CONSTRAINT "${table}_pkey" PRIMARY KEY ("id")`);
        expect(sql).toContain(`CREATE UNIQUE INDEX "${table}_businessId_id_key" ON "${table}"("businessId", "id")`);
      }
    });

    it("verifies all monetary fields are strictly DECIMAL(12, 2)", () => {
      const decimalPatterns = [
        /"basePrice"\s+DECIMAL\(12,\s*2\)/,
        /"priceDelta"\s+DECIMAL\(12,\s*2\)/,
        /"subtotal"\s+DECIMAL\(12,\s*2\)/,
        /"discountTotal"\s+DECIMAL\(12,\s*2\)/,
        /"taxTotal"\s+DECIMAL\(12,\s*2\)/,
        /"totalAmount"\s+DECIMAL\(12,\s*2\)/,
        /"paidAmount"\s+DECIMAL\(12,\s*2\)/,
        /"unitPrice"\s+DECIMAL\(12,\s*2\)/,
        /"taxAmount"\s+DECIMAL\(12,\s*2\)/,
        /"total"\s+DECIMAL\(12,\s*2\)/,
      ];

      for (const pattern of decimalPatterns) {
        expect(sql).toMatch(pattern);
      }
    });

    it("verifies all 14 PostgreSQL composite tenant foreign keys exist in migration SQL", () => {
      const compositeFkNames = [
        "Floor_businessId_branchId_fkey",
        "RestaurantTable_businessId_branchId_fkey",
        "RestaurantTable_businessId_floorId_fkey",
        "TableSession_businessId_branchId_fkey",
        "TableSession_businessId_tableId_fkey",
        "MenuSection_businessId_menuId_fkey",
        "MenuItem_businessId_sectionId_fkey",
        "ModifierOption_businessId_modifierGroupId_fkey",
        "MenuItemModifierGroup_businessId_menuItemId_fkey",
        "MenuItemModifierGroup_businessId_modifierGroupId_fkey",
        "RestaurantOrder_businessId_branchId_fkey",
        "OrderRound_businessId_orderId_fkey",
        "OrderLine_businessId_orderId_fkey",
        "OrderLine_businessId_roundId_fkey",
      ];

      for (const fkName of compositeFkNames) {
        expect(sql).toContain(`CONSTRAINT "${fkName}"`);
      }
    });
  });

  // =========================================================================
  // 3. Live Database Verification & Adversarial Stress Tests
  // =========================================================================
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const describeLiveDb = dbUrl ? describe : describe.skip;

  describeLiveDb("3. Live PostgreSQL Engine Composite FK Enforcement & Adversarial Attacks", () => {
    let client: import("@dynapos/db").PrismaClient;

    beforeAll(async () => {
      const { PrismaClient } = await import("@dynapos/db");
      client = new PrismaClient({ datasourceUrl: dbUrl });
      await client.$connect();
    });

    afterAll(async () => {
      if (client) await client.$disconnect();
    });

    it("verifies live PostgreSQL information_schema has exact Decimal(12, 2) on monetary columns", async () => {
      const expectedDecimals: { table: string; column: string; precision: number; scale: number }[] = [
        { table: "MenuItem", column: "basePrice", precision: 12, scale: 2 },
        { table: "ModifierOption", column: "priceDelta", precision: 12, scale: 2 },
        { table: "RestaurantOrder", column: "subtotal", precision: 12, scale: 2 },
        { table: "RestaurantOrder", column: "discountTotal", precision: 12, scale: 2 },
        { table: "RestaurantOrder", column: "taxTotal", precision: 12, scale: 2 },
        { table: "RestaurantOrder", column: "totalAmount", precision: 12, scale: 2 },
        { table: "RestaurantOrder", column: "paidAmount", precision: 12, scale: 2 },
        { table: "OrderLine", column: "basePrice", precision: 12, scale: 2 },
        { table: "OrderLine", column: "unitPrice", precision: 12, scale: 2 },
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
        expect(row, `Column ${def.table}.${def.column} not found in database`).toBeDefined();
        expect(row.data_type).toBe("numeric");
        expect(row.numeric_precision).toBe(def.precision);
        expect(row.numeric_scale).toBe(def.scale);
      }
    });

    it("verifies live PostgreSQL catalog binds all 14 composite foreign keys ordinally", async () => {
      const compositeFKs = [
        { name: "Floor_businessId_branchId_fkey", table: "Floor", foreignTable: "Branch", col: "branchId" },
        { name: "RestaurantTable_businessId_branchId_fkey", table: "RestaurantTable", foreignTable: "Branch", col: "branchId" },
        { name: "RestaurantTable_businessId_floorId_fkey", table: "RestaurantTable", foreignTable: "Floor", col: "floorId" },
        { name: "TableSession_businessId_branchId_fkey", table: "TableSession", foreignTable: "Branch", col: "branchId" },
        { name: "TableSession_businessId_tableId_fkey", table: "TableSession", foreignTable: "RestaurantTable", col: "tableId" },
        { name: "MenuSection_businessId_menuId_fkey", table: "MenuSection", foreignTable: "Menu", col: "menuId" },
        { name: "MenuItem_businessId_sectionId_fkey", table: "MenuItem", foreignTable: "MenuSection", col: "sectionId" },
        { name: "ModifierOption_businessId_modifierGroupId_fkey", table: "ModifierOption", foreignTable: "ModifierGroup", col: "modifierGroupId" },
        { name: "MenuItemModifierGroup_businessId_menuItemId_fkey", table: "MenuItemModifierGroup", foreignTable: "MenuItem", col: "menuItemId" },
        { name: "MenuItemModifierGroup_businessId_modifierGroupId_fkey", table: "MenuItemModifierGroup", foreignTable: "ModifierGroup", col: "modifierGroupId" },
        { name: "RestaurantOrder_businessId_branchId_fkey", table: "RestaurantOrder", foreignTable: "Branch", col: "branchId" },
        { name: "OrderRound_businessId_orderId_fkey", table: "OrderRound", foreignTable: "RestaurantOrder", col: "orderId" },
        { name: "OrderLine_businessId_orderId_fkey", table: "OrderLine", foreignTable: "RestaurantOrder", col: "orderId" },
        { name: "OrderLine_businessId_roundId_fkey", table: "OrderLine", foreignTable: "OrderRound", col: "roundId" },
      ];

      for (const fk of compositeFKs) {
        const rows = await client.$queryRawUnsafe<
          { source_column: string; target_table: string; target_column: string }[]
        >(`
          SELECT
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
            AND con.conname = '${fk.name}'
          ORDER BY u.ord;
        `);

        expect(rows).toHaveLength(2);
        expect(rows[0].source_column).toBe("businessId");
        expect(rows[0].target_column).toBe("businessId");
        expect(rows[0].target_table).toBe(fk.foreignTable);
        expect(rows[1].source_column).toBe(fk.col);
        expect(rows[1].target_column).toBe("id");
      }
    });

    it("ADVERSARIAL ATTACK: proves PostgreSQL composite FK constraints strictly block cross-tenant boundary insertions", async () => {
      const busA = randomUUID();
      const busB = randomUUID();
      const branchA = randomUUID();
      const branchB = randomUUID();

      await client.$transaction(async (tx) => {
        // Seed Tenants A & B
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

        // Fixtures for Tenant A
        const floorA = randomUUID(), menuA = randomUUID(), sectionA = randomUUID(), itemA = randomUUID(), modGroupA = randomUUID(), orderA = randomUUID(), roundA = randomUUID();
        await tx.$executeRawUnsafe(`INSERT INTO "Floor" ("id", "businessId", "branchId", "name", "updatedAt") VALUES ('${floorA}', '${busA}', '${branchA}', 'F1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchA}', '${floorA}', 'T1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "Menu" ("id", "businessId", "branchId", "name", "updatedAt") VALUES ('${menuA}', '${busA}', '${branchA}', 'M1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "MenuSection" ("id", "businessId", "menuId", "name", "updatedAt") VALUES ('${sectionA}', '${busA}', '${menuA}', 'S1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "MenuItem" ("id", "businessId", "sectionId", "name", "basePrice", "updatedAt") VALUES ('${itemA}', '${busA}', '${sectionA}', 'Item1', 10.00, NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "ModifierGroup" ("id", "businessId", "name", "updatedAt") VALUES ('${modGroupA}', '${busA}', 'G1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "RestaurantOrder" ("id", "businessId", "branchId", "orderNumber", "updatedAt") VALUES ('${orderA}', '${busA}', '${branchA}', 'ORD-1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "OrderRound" ("id", "businessId", "orderId", "roundNumber", "updatedAt") VALUES ('${roundA}', '${busA}', '${orderA}', 1, NOW())`);

        // Fixtures for Tenant B
        const floorB = randomUUID(), tableB = randomUUID(), menuB = randomUUID(), sectionB = randomUUID(), itemB = randomUUID(), modGroupB = randomUUID(), orderB = randomUUID(), roundB = randomUUID();
        await tx.$executeRawUnsafe(`INSERT INTO "Floor" ("id", "businessId", "branchId", "name", "updatedAt") VALUES ('${floorB}', '${busB}', '${branchB}', 'FB', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt") VALUES ('${tableB}', '${busB}', '${branchB}', '${floorB}', 'TB1', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "Menu" ("id", "businessId", "branchId", "name", "updatedAt") VALUES ('${menuB}', '${busB}', '${branchB}', 'MB', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "MenuSection" ("id", "businessId", "menuId", "name", "updatedAt") VALUES ('${sectionB}', '${busB}', '${menuB}', 'SB', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "MenuItem" ("id", "businessId", "sectionId", "name", "basePrice", "updatedAt") VALUES ('${itemB}', '${busB}', '${sectionB}', 'ItemB', 15.00, NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "ModifierGroup" ("id", "businessId", "name", "updatedAt") VALUES ('${modGroupB}', '${busB}', 'GB', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "RestaurantOrder" ("id", "businessId", "branchId", "orderNumber", "updatedAt") VALUES ('${orderB}', '${busB}', '${branchB}', 'ORD-B', NOW())`);
        await tx.$executeRawUnsafe(`INSERT INTO "OrderRound" ("id", "businessId", "orderId", "roundNumber", "updatedAt") VALUES ('${roundB}', '${busB}', '${orderB}', 1, NOW())`);

        async function expectAttackFails(statement: string) {
          await tx.$executeRawUnsafe(`SAVEPOINT atk_sp`);
          let succeeded = false;
          try {
            await tx.$executeRawUnsafe(statement);
            succeeded = true;
          } catch (err: unknown) {
            expect(String(err)).toMatch(/foreign key constraint|23503|fkey/i);
          } finally {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT atk_sp`);
          }
          expect(succeeded, `Attack succeeded but was expected to fail FK constraint: ${statement}`).toBe(false);
        }

        // Test Cross-Tenant attacks across all levels of the restaurant hierarchy
        await expectAttackFails(`INSERT INTO "Floor" ("id", "businessId", "branchId", "name", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchB}', 'Rogue', NOW())`);
        await expectAttackFails(`INSERT INTO "RestaurantTable" ("id", "businessId", "branchId", "floorId", "tableNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchA}', '${floorB}', 'T9', NOW())`);
        await expectAttackFails(`INSERT INTO "TableSession" ("id", "businessId", "branchId", "tableId", "sessionNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchA}', '${tableB}', 'S9', NOW())`);
        await expectAttackFails(`INSERT INTO "MenuSection" ("id", "businessId", "menuId", "name", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${menuB}', 'S9', NOW())`);
        await expectAttackFails(`INSERT INTO "MenuItem" ("id", "businessId", "sectionId", "name", "basePrice", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${sectionB}', 'I9', 5.00, NOW())`);
        await expectAttackFails(`INSERT INTO "ModifierOption" ("id", "businessId", "modifierGroupId", "name", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${modGroupB}', 'O9', NOW())`);
        await expectAttackFails(`INSERT INTO "MenuItemModifierGroup" ("id", "businessId", "menuItemId", "modifierGroupId") VALUES ('${randomUUID()}', '${busA}', '${itemB}', '${modGroupA}')`);
        await expectAttackFails(`INSERT INTO "RestaurantOrder" ("id", "businessId", "branchId", "orderNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${branchB}', 'ORD-R', NOW())`);
        await expectAttackFails(`INSERT INTO "OrderRound" ("id", "businessId", "orderId", "roundNumber", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${orderB}', 1, NOW())`);
        await expectAttackFails(`INSERT INTO "OrderLine" ("id", "businessId", "orderId", "roundId", "itemName", "basePrice", "appliedModifiers", "unitPrice", "subtotal", "total", "updatedAt") VALUES ('${randomUUID()}', '${busA}', '${orderB}', '${roundA}', 'L9', 5.00, '[]', 5.00, 5.00, 5.00, NOW())`);

        // Roll back the entire test transaction cleanly
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      }).catch((e) => {
        if (e.message !== "ROLLBACK_TEST_TRANSACTION") throw e;
      });
    });
  });
});
