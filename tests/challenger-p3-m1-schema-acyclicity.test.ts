import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, db } from "@dynapos/db";
import { backupModels, excludedModels, schemaHash } from "../backend/src/lib/backup-format";

describe("Challenger Adversarial Stress Harness: Schema Acyclicity & Topological Sort", () => {
  const dmmfModels = Prisma.dmmf.datamodel.models;
  const phase3Models = [
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
  // 1. Dynamic Resolution & Model Completeness
  // =========================================================================
  describe("1. Dynamic Model Resolution & Completeness", () => {
    it("dynamically resolves tenant models in backupModels", () => {
      expect(backupModels.length).toBeGreaterThanOrEqual(60);
      expect(excludedModels).toEqual(["BusinessRegistrationRequest"]);
      expect(dmmfModels.length).toBeGreaterThanOrEqual(61);
    });

    it("includes every non-excluded Prisma model in backupModels", () => {
      const expectedNames = dmmfModels
        .map(m => m.name)
        .filter(name => !excludedModels.includes(name))
        .sort();
      const actualNames = backupModels.map(m => m.name).sort();
      expect(actualNames).toEqual(expectedNames);
    });

    it("includes all 12 Phase 3 restaurant hospitality models in backupModels", () => {
      const backupNames = new Set(backupModels.map(m => m.name));
      for (const name of phase3Models) {
        expect(backupNames.has(name)).toBe(true);
      }
    });

    it("verifies schemaHash is a deterministic 64-character SHA-256 hex digest", () => {
      expect(schemaHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // =========================================================================
  // 2. Strict Topological Invariant (Acyclic DAG Verification)
  // =========================================================================
  describe("2. Strict Topological Invariant (Acyclic DAG Verification)", () => {
    it("ensures for every model at index i, all FK parent models strictly appear at index j < i", () => {
      const modelIndexMap = new Map<string, number>();
      backupModels.forEach((model, index) => {
        modelIndexMap.set(model.name, index);
      });

      for (let i = 0; i < backupModels.length; i++) {
        const model = backupModels[i];
        const fkFields = model.fields.filter(
          f => f.relationFromFields && f.relationFromFields.length > 0
        );

        for (const fkField of fkFields) {
          const parentName = fkField.type;
          const parentIndex = modelIndexMap.get(parentName);

          expect(
            parentIndex,
            `Model ${model.name} (index ${i}) references parent ${parentName}, but parent was not found in backupModels`
          ).toBeDefined();

          expect(
            parentIndex,
            `Model ${model.name} (index ${i}) references parent ${parentName} (index ${parentIndex}), which violates DAG order (must be < ${i})`
          ).toBeLessThan(i);
        }
      }
    });

    it("verifies the strict topological progression across the hospitality hierarchy", () => {
      const indexOf = (name: string) => backupModels.findIndex(m => m.name === name);

      // Floor must precede RestaurantTable
      expect(indexOf("Floor")).toBeLessThan(indexOf("RestaurantTable"));

      // RestaurantTable must precede TableSession
      expect(indexOf("RestaurantTable")).toBeLessThan(indexOf("TableSession"));

      // TableSession and RestaurantTable must precede RestaurantOrder
      expect(indexOf("RestaurantTable")).toBeLessThan(indexOf("RestaurantOrder"));
      expect(indexOf("TableSession")).toBeLessThan(indexOf("RestaurantOrder"));

      // RestaurantOrder must precede OrderRound
      expect(indexOf("RestaurantOrder")).toBeLessThan(indexOf("OrderRound"));

      // OrderRound and MenuItem must precede OrderLine
      expect(indexOf("OrderRound")).toBeLessThan(indexOf("OrderLine"));
      expect(indexOf("MenuItem")).toBeLessThan(indexOf("OrderLine"));

      // Menu hierarchy progression
      expect(indexOf("Menu")).toBeLessThan(indexOf("MenuSection"));
      expect(indexOf("MenuSection")).toBeLessThan(indexOf("MenuItem"));
      expect(indexOf("ModifierGroup")).toBeLessThan(indexOf("ModifierOption"));
      expect(indexOf("ModifierGroup")).toBeLessThan(indexOf("MenuItemModifierGroup"));
      expect(indexOf("MenuItem")).toBeLessThan(indexOf("MenuItemModifierGroup"));
    });
  });

  // =========================================================================
  // 3. RestaurantTable and TableSession Acyclicity Constraint
  // =========================================================================
  describe("3. RestaurantTable vs TableSession Acyclicity Invariant", () => {
    it("proves RestaurantTable.currentSessionId is a pure scalar without @relation attribute", () => {
      const tableModel = dmmfModels.find(m => m.name === "RestaurantTable");
      expect(tableModel).toBeDefined();

      const currentSessionIdField = tableModel!.fields.find(f => f.name === "currentSessionId");
      expect(currentSessionIdField).toBeDefined();
      expect(currentSessionIdField!.kind).toBe("scalar");
      expect(currentSessionIdField!.type).toBe("String");
      expect(currentSessionIdField!.isList).toBe(false);
      expect(currentSessionIdField!.isRequired).toBe(false);
      expect(currentSessionIdField!.relationFromFields).toBeUndefined();

      // Ensure NO relation field exists on RestaurantTable with type TableSession having foreign keys
      const outgoingRelationsToSession = tableModel!.fields.filter(
        f => f.type === "TableSession" && f.relationFromFields && f.relationFromFields.length > 0
      );
      expect(outgoingRelationsToSession).toHaveLength(0);
    });

    it("verifies TableSession has a direct foreign key to RestaurantTable", () => {
      const sessionModel = dmmfModels.find(m => m.name === "TableSession");
      expect(sessionModel).toBeDefined();

      const tableRelation = sessionModel!.fields.find(
        f => f.type === "RestaurantTable" && f.relationFromFields?.includes("tableId")
      );
      expect(tableRelation).toBeDefined();
      expect(tableRelation!.relationToFields).toEqual(["id"]);
    });

    it("confirms RestaurantTable appears before TableSession in backupModels", () => {
      const tableIndex = backupModels.findIndex(m => m.name === "RestaurantTable");
      const sessionIndex = backupModels.findIndex(m => m.name === "TableSession");

      expect(tableIndex).toBeGreaterThan(-1);
      expect(sessionIndex).toBeGreaterThan(-1);
      expect(tableIndex).toBeLessThan(sessionIndex);
    });
  });

  // =========================================================================
  // 4. Adversarial Cycle Injection Oracle
  // =========================================================================
  describe("4. Adversarial Cycle Injection Oracle", () => {
    function topologicalSort(models: typeof Prisma.dmmf.datamodel.models) {
      const sorted: typeof models = [];
      const pending = [...models];
      while (pending.length) {
        const index = pending.findIndex(model =>
          model.fields
            .filter(field => field.relationFromFields?.length)
            .every(field => sorted.some(parent => parent.name === field.type))
        );
        if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
        sorted.push(pending.splice(index, 1)[0]);
      }
      return sorted;
    }

    it("passes cleanly with the authentic schema models", () => {
      const models = dmmfModels.filter(m => !excludedModels.includes(m.name));
      const result = topologicalSort(models);
      expect(result.map(m => m.name)).toEqual(backupModels.map(m => m.name));
    });

    it("ADVERSARIAL ATTACK: throws cycle error when RestaurantTable.currentSessionId is given an @relation to TableSession", () => {
      const models = JSON.parse(
        JSON.stringify(dmmfModels.filter(m => !excludedModels.includes(m.name)))
      ) as typeof dmmfModels;

      const tableModel = models.find(m => m.name === "RestaurantTable")!;
      // Inject circular relation field: RestaurantTable -> TableSession
      tableModel.fields.push({
        name: "currentSession",
        kind: "object",
        isList: false,
        isRequired: false,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        type: "TableSession",
        hasDefaultValue: false,
        relationName: "RestaurantTableCurrentSession",
        relationFromFields: ["currentSessionId"],
        relationToFields: ["id"],
      } as any);

      expect(() => topologicalSort(models)).toThrowError(
        "Backup schema has unsupported dependency cycle"
      );
    });

    it("ADVERSARIAL ATTACK: throws cycle error on direct self-referential cycle", () => {
      const models = JSON.parse(
        JSON.stringify(dmmfModels.filter(m => !excludedModels.includes(m.name)))
      ) as typeof dmmfModels;

      const floorModel = models.find(m => m.name === "Floor")!;
      // Inject self-loop: Floor -> Floor
      floorModel.fields.push({
        name: "parentFloor",
        kind: "object",
        isList: false,
        isRequired: true,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        type: "Floor",
        hasDefaultValue: false,
        relationName: "FloorSelfRelation",
        relationFromFields: ["parentFloorId"],
        relationToFields: ["id"],
      } as any);

      expect(() => topologicalSort(models)).toThrowError(
        "Backup schema has unsupported dependency cycle"
      );
    });

    it("ADVERSARIAL ATTACK: throws cycle error on 3-node cycle (Floor -> Table -> Session -> Floor)", () => {
      const models = JSON.parse(
        JSON.stringify(dmmfModels.filter(m => !excludedModels.includes(m.name)))
      ) as typeof dmmfModels;

      const floorModel = models.find(m => m.name === "Floor")!;
      // Inject backward relation: Floor -> TableSession
      floorModel.fields.push({
        name: "activeSession",
        kind: "object",
        isList: false,
        isRequired: true,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        type: "TableSession",
        hasDefaultValue: false,
        relationName: "FloorActiveSession",
        relationFromFields: ["activeSessionId"],
        relationToFields: ["id"],
      } as any);

      expect(() => topologicalSort(models)).toThrowError(
        "Backup schema has unsupported dependency cycle"
      );
    });
  });

  // =========================================================================
  // 5. Migration SQL Audit
  // =========================================================================
  describe("5. Migration SQL Audit: Additive & Acyclic DDL", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");

    it("verifies migration SQL creates all 12 Phase 3 tables without dropping any table", () => {
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/TRUNCATE/i);

      for (const table of phase3Models) {
        expect(sql).toContain(`CREATE TABLE "${table}"`);
      }
    });

    it("verifies RestaurantTable DDL contains currentSessionId as TEXT without a foreign key", () => {
      expect(sql).toMatch(/"currentSessionId"\s+TEXT/);

      // Verify no constraint references currentSessionId
      expect(sql).not.toMatch(/FOREIGN\s+KEY\s*\([^)]*"currentSessionId"[^)]*\)/i);
      expect(sql).not.toMatch(/REFERENCES\s+"TableSession"\s*\([^)]*currentSessionId/i);
    });

    it("verifies TableSession DDL establishes foreign key to RestaurantTable", () => {
      // Standard Prisma FK
      expect(sql).toContain(
        'ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id")'
      );

      // PostgreSQL composite tenant FK
      expect(sql).toContain(
        'ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_tableId_fkey"'
      );
      expect(sql).toContain(
        'FOREIGN KEY ("businessId", "tableId") REFERENCES "RestaurantTable"("businessId", "id")'
      );
    });
  });

  // =========================================================================
  // 6. Live PostgreSQL Engine Foreign Key Enforcement
  // =========================================================================
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const describeLiveDb = dbUrl ? describe : describe.skip;

  describeLiveDb("6. Live PostgreSQL Engine Foreign Key Verification", () => {
    it("confirms PostgreSQL information_schema has no FK on RestaurantTable.currentSessionId and has FK on TableSession.tableId", async () => {
      const { PrismaClient } = await import("@dynapos/db");
      const client = new PrismaClient({ datasourceUrl: dbUrl! });
      try {
        const fkQuery = await client.$queryRaw<
          Array<{
            constraint_name: string;
            table_name: string;
            column_name: string;
            foreign_table_name: string;
            foreign_column_name: string;
          }>
        >`
          SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN ('RestaurantTable', 'TableSession')
          ORDER BY tc.table_name, kcu.column_name;
        `;

        // 1. Ensure NO foreign key exists on RestaurantTable.currentSessionId
        const currentSessionFk = fkQuery.find(
          r => r.table_name === "RestaurantTable" && r.column_name === "currentSessionId"
        );
        expect(currentSessionFk).toBeUndefined();

        // 2. Ensure foreign key exists on TableSession.tableId -> RestaurantTable.id
        const tableIdFk = fkQuery.find(
          r =>
            r.table_name === "TableSession" &&
            r.column_name === "tableId" &&
            r.foreign_table_name === "RestaurantTable" &&
            r.foreign_column_name === "id"
        );
        expect(tableIdFk).toBeDefined();

        // 3. Ensure RestaurantTable only references Business, Branch, Floor
        const tableFkTargets = new Set(
          fkQuery.filter(r => r.table_name === "RestaurantTable").map(r => r.foreign_table_name)
        );
        expect(tableFkTargets).toEqual(new Set(["Business", "Branch", "Floor"]));
      } finally {
        await client.$disconnect();
      }
    });
  });
});
