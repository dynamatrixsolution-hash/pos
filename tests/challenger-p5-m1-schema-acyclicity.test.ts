import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@dynapos/db";
import { backupModels, excludedModels, schemaHash } from "../backend/src/lib/backup-format";

describe("Challenger Adversarial Stress Harness: Phase 5 Schema Acyclicity & Topological Sort", () => {
  const dmmfModels = Prisma.dmmf.datamodel.models;
  const phase5Models = [
    "RoomType",
    "Room",
    "Reservation",
    "ReservationGuest",
    "Stay",
    "RoomAllocation",
    "HousekeepingTask",
    "MaintenanceTicket",
  ];

  // =========================================================================
  // 1. Dynamic Resolution & Model Completeness
  // =========================================================================
  describe("1. Dynamic Model Resolution & Completeness", () => {
    it("dynamically resolves tenant models in backupModels", () => {
      expect(backupModels.length).toBeGreaterThanOrEqual(74);
      expect(excludedModels).toEqual(["BusinessRegistrationRequest"]);
      expect(dmmfModels.length).toBeGreaterThanOrEqual(75);
    });

    it("includes every non-excluded Prisma model in backupModels", () => {
      const expectedNames = dmmfModels
        .map(m => m.name)
        .filter(name => !excludedModels.includes(name))
        .sort();
      const actualNames = backupModels.map(m => m.name).sort();
      expect(actualNames).toEqual(expectedNames);
    });

    it("includes all 8 Phase 5 hotel hospitality models in backupModels", () => {
      const backupNames = new Set(backupModels.map(m => m.name));
      for (const name of phase5Models) {
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

    it("verifies the strict topological progression across the hotel domain hierarchy", () => {
      const indexOf = (name: string) => backupModels.findIndex(m => m.name === name);

      // Business & Branch must precede RoomType
      expect(indexOf("Business")).toBeLessThan(indexOf("RoomType"));
      expect(indexOf("Branch")).toBeLessThan(indexOf("RoomType"));

      // RoomType and Floor must precede Room
      expect(indexOf("RoomType")).toBeLessThan(indexOf("Room"));
      expect(indexOf("Floor")).toBeLessThan(indexOf("Room"));

      // RoomType and Room must precede Reservation
      expect(indexOf("RoomType")).toBeLessThan(indexOf("Reservation"));
      expect(indexOf("Room")).toBeLessThan(indexOf("Reservation"));

      // Reservation must precede ReservationGuest
      expect(indexOf("Reservation")).toBeLessThan(indexOf("ReservationGuest"));

      // Room and Reservation must precede Stay
      expect(indexOf("Room")).toBeLessThan(indexOf("Stay"));
      expect(indexOf("Reservation")).toBeLessThan(indexOf("Stay"));

      // Room must precede MaintenanceTicket
      expect(indexOf("Room")).toBeLessThan(indexOf("MaintenanceTicket"));

      // Room, Reservation, Stay, MaintenanceTicket must precede RoomAllocation
      expect(indexOf("Room")).toBeLessThan(indexOf("RoomAllocation"));
      expect(indexOf("Reservation")).toBeLessThan(indexOf("RoomAllocation"));
      expect(indexOf("Stay")).toBeLessThan(indexOf("RoomAllocation"));
      expect(indexOf("MaintenanceTicket")).toBeLessThan(indexOf("RoomAllocation"));

      // Room and Stay must precede HousekeepingTask
      expect(indexOf("Room")).toBeLessThan(indexOf("HousekeepingTask"));
      expect(indexOf("Stay")).toBeLessThan(indexOf("HousekeepingTask"));
    });
  });

  // =========================================================================
  // 3. Room and Stay Acyclicity Constraint
  // =========================================================================
  describe("3. Room vs Stay Acyclicity Invariant", () => {
    it("proves Room.currentStayId is a pure scalar without @relation attribute", () => {
      const roomModel = dmmfModels.find(m => m.name === "Room");
      expect(roomModel).toBeDefined();

      const currentStayIdField = roomModel!.fields.find(f => f.name === "currentStayId");
      expect(currentStayIdField).toBeDefined();
      expect(currentStayIdField!.kind).toBe("scalar");
      expect(currentStayIdField!.type).toBe("String");
      expect(currentStayIdField!.isList).toBe(false);
      expect(currentStayIdField!.isRequired).toBe(false);
      expect(currentStayIdField!.relationFromFields).toBeUndefined();

      // Ensure NO relation field exists on Room with type Stay having foreign keys
      const outgoingRelationsToStay = roomModel!.fields.filter(
        f => f.type === "Stay" && f.relationFromFields && f.relationFromFields.length > 0
      );
      expect(outgoingRelationsToStay).toHaveLength(0);
    });

    it("verifies Stay has a direct foreign key to Room", () => {
      const stayModel = dmmfModels.find(m => m.name === "Stay");
      expect(stayModel).toBeDefined();

      const roomRelation = stayModel!.fields.find(
        f => f.type === "Room" && f.relationFromFields?.includes("roomId")
      );
      expect(roomRelation).toBeDefined();
      expect(roomRelation!.relationToFields).toEqual(["id"]);
    });

    it("confirms Room appears before Stay in backupModels", () => {
      const roomIndex = backupModels.findIndex(m => m.name === "Room");
      const stayIndex = backupModels.findIndex(m => m.name === "Stay");

      expect(roomIndex).toBeGreaterThan(-1);
      expect(stayIndex).toBeGreaterThan(-1);
      expect(roomIndex).toBeLessThan(stayIndex);
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

    it("ADVERSARIAL ATTACK: throws cycle error when Room.currentStayId is given an @relation to Stay", () => {
      const models = JSON.parse(
        JSON.stringify(dmmfModels.filter(m => !excludedModels.includes(m.name)))
      ) as typeof dmmfModels;

      const roomModel = models.find(m => m.name === "Room")!;
      // Inject circular relation field: Room -> Stay
      roomModel.fields.push({
        name: "currentStay",
        kind: "object",
        isList: false,
        isRequired: false,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        type: "Stay",
        hasDefaultValue: false,
        relationName: "RoomCurrentStay",
        relationFromFields: ["currentStayId"],
        relationToFields: ["id"],
      } as any);

      expect(() => topologicalSort(models)).toThrowError(
        "Backup schema has unsupported dependency cycle"
      );
    });

    it("ADVERSARIAL ATTACK: throws cycle error when Stay is injected with relation to RoomAllocation", () => {
      const models = JSON.parse(
        JSON.stringify(dmmfModels.filter(m => !excludedModels.includes(m.name)))
      ) as typeof dmmfModels;

      const stayModel = models.find(m => m.name === "Stay")!;
      // Inject backward relation: Stay -> RoomAllocation
      stayModel.fields.push({
        name: "primaryAllocation",
        kind: "object",
        isList: false,
        isRequired: true,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        type: "RoomAllocation",
        hasDefaultValue: false,
        relationName: "StayPrimaryAllocation",
        relationFromFields: ["primaryAllocationId"],
        relationToFields: ["id"],
      } as any);

      expect(() => topologicalSort(models)).toThrowError(
        "Backup schema has unsupported dependency cycle"
      );
    });

    it("ADVERSARIAL ATTACK: throws cycle error on 3-node cycle (Room -> Reservation -> Stay -> Room)", () => {
      const models = JSON.parse(
        JSON.stringify(dmmfModels.filter(m => !excludedModels.includes(m.name)))
      ) as typeof dmmfModels;

      const roomModel = models.find(m => m.name === "Room")!;
      // Inject backward relation: Room -> Stay
      roomModel.fields.push({
        name: "lastStay",
        kind: "object",
        isList: false,
        isRequired: true,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        type: "Stay",
        hasDefaultValue: false,
        relationName: "RoomLastStay",
        relationFromFields: ["lastStayId"],
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
      "../packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");

    it("verifies migration SQL creates all 8 Phase 5 tables without dropping any table", () => {
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/TRUNCATE/i);

      for (const table of phase5Models) {
        expect(sql).toContain(`CREATE TABLE "${table}"`);
      }
    });

    it("verifies Room DDL contains currentStayId as TEXT without a foreign key", () => {
      expect(sql).toMatch(/"currentStayId"\s+TEXT/);

      // Verify no constraint references currentStayId
      expect(sql).not.toMatch(/FOREIGN\s+KEY\s*\([^)]*"currentStayId"[^)]*\)/i);
      expect(sql).not.toMatch(/REFERENCES\s+"Stay"\s*\([^)]*currentStayId/i);
    });

    it("verifies Stay DDL establishes foreign key to Room", () => {
      expect(sql).toContain(
        'ALTER TABLE "Stay" ADD CONSTRAINT "Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id")'
      );
    });

    it("verifies btree_gist extension and GiST exclusion constraint on RoomAllocation", () => {
      expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist");
      expect(sql).toContain('ADD CONSTRAINT "RoomAllocation_room_period_overlap_excl"');
      expect(sql).toContain("EXCLUDE USING gist");
      expect(sql).toContain('tsrange("startDate", "endDate", \'[)\') WITH &&');
      expect(sql).toContain('WHERE ("isBlocking" = true)');
    });
  });

  // =========================================================================
  // 6. Live PostgreSQL Engine Foreign Key & GiST Enforcement
  // =========================================================================
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const describeLiveDb = dbUrl ? describe : describe.skip;

  describeLiveDb("6. Live PostgreSQL Engine Foreign Key & GiST Verification", () => {
    it("confirms PostgreSQL information_schema has no FK on Room.currentStayId and has FK on Stay.roomId", async () => {
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
            AND tc.table_name IN ('Room', 'Stay')
          ORDER BY tc.table_name, kcu.column_name;
        `;

        // 1. Ensure NO foreign key exists on Room.currentStayId
        const currentStayFk = fkQuery.find(
          r => r.table_name === "Room" && r.column_name === "currentStayId"
        );
        expect(currentStayFk).toBeUndefined();

        // 2. Ensure foreign key exists on Stay.roomId -> Room.id
        const roomIdFk = fkQuery.find(
          r =>
            r.table_name === "Stay" &&
            r.column_name === "roomId" &&
            r.foreign_table_name === "Room" &&
            r.foreign_column_name === "id"
        );
        expect(roomIdFk).toBeDefined();

        // 3. Ensure Room only references Business, Branch, RoomType, Floor
        const roomFkTargets = new Set(
          fkQuery.filter(r => r.table_name === "Room").map(r => r.foreign_table_name)
        );
        expect(roomFkTargets).toEqual(new Set(["Business", "Branch", "RoomType", "Floor"]));
      } finally {
        await client.$disconnect();
      }
    });

    it("confirms GiST exclusion constraint exists on RoomAllocation in pg_constraint", async () => {
      const { PrismaClient } = await import("@dynapos/db");
      const client = new PrismaClient({ datasourceUrl: dbUrl! });
      try {
        const exclConstraints = await client.$queryRaw<
          Array<{ conname: string; contype: string }>
        >`
          SELECT conname, contype
          FROM pg_constraint
          WHERE conname = 'RoomAllocation_room_period_overlap_excl';
        `;

        expect(exclConstraints).toHaveLength(1);
        expect(exclConstraints[0].contype).toBe("x"); // 'x' stands for EXCLUSION constraint in PostgreSQL
      } finally {
        await client.$disconnect();
      }
    });

    it("empirically verifies that overlapping blocking allocations on the same room raise PostgreSQL error 23P01", async () => {
      const { PrismaClient } = await import("@dynapos/db");
      const client = new PrismaClient({ datasourceUrl: dbUrl! });
      const testTag = `emp-gist-${Date.now()}`;
      const businessId = `b-${testTag}`;
      const branchId = `br-${testTag}`;
      const roomTypeId = `rt-${testTag}`;
      const roomId = `rm-${testTag}`;

      try {
        // Create prerequisite entities
        await client.business.create({
          data: {
            id: businessId,
            name: "Empirical GiST Test Hotel",
            slug: testTag,
          },
        });
        await client.branch.create({
          data: {
            id: branchId,
            businessId,
            name: "Main Branch",
          },
        });
        await client.roomType.create({
          data: {
            id: roomTypeId,
            businessId,
            branchId,
            name: "Deluxe King",
            code: `DK-${testTag.slice(-4)}`,
            baseRate: 150,
          },
        });
        await client.room.create({
          data: {
            id: roomId,
            businessId,
            branchId,
            roomTypeId,
            roomNumber: `101-${testTag.slice(-4)}`,
          },
        });

        // 1. Initial blocking booking [2026-12-01 14:00, 2026-12-05 11:00) -> SUCCESS
        await client.roomAllocation.create({
          data: {
            id: `alloc-1-${testTag}`,
            businessId,
            branchId,
            roomId,
            startDate: new Date("2026-12-01T14:00:00.000Z"),
            endDate: new Date("2026-12-05T11:00:00.000Z"),
            isBlocking: true,
          },
        });

        // 2. Adjacent turnover booking [2026-12-05 11:00, 2026-12-08 11:00) -> SUCCESS (half-open [) disjoint)
        await client.roomAllocation.create({
          data: {
            id: `alloc-2-${testTag}`,
            businessId,
            branchId,
            roomId,
            startDate: new Date("2026-12-05T11:00:00.000Z"),
            endDate: new Date("2026-12-08T11:00:00.000Z"),
            isBlocking: true,
          },
        });

        // 3. Competing overlapping booking [2026-12-03 14:00, 2026-12-06 11:00) -> MUST FAIL WITH 23P01
        let errorCaught: any = null;
        try {
          await client.roomAllocation.create({
            data: {
              id: `alloc-3-${testTag}`,
              businessId,
              branchId,
              roomId,
              startDate: new Date("2026-12-03T14:00:00.000Z"),
              endDate: new Date("2026-12-06T11:00:00.000Z"),
              isBlocking: true,
            },
          });
        } catch (err: any) {
          errorCaught = err;
        }

        expect(errorCaught).not.toBeNull();
        expect(errorCaught.message).toMatch(/23P01|conflicting key value violates exclusion constraint/i);
      } finally {
        await client.business.deleteMany({ where: { id: businessId } }).catch(() => undefined);
        await client.$disconnect();
      }
    });
  });
});
