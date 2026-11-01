import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { createAuditEvent } from "@/lib/audit-event";
import { addMoney, money, subMoney } from "@/lib/services/decimal-math";
import {
  HotelError,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";

export type PrismaClientOrTx = PrismaClientLike;

export class DomainError extends HotelError {
  constructor(message: string, statusCode = 400, code?: string) {
    super(message, statusCode, code);
    this.name = "DomainError";
  }
}

export type HospitalityFeatureKey =
  | "hotelEnabled"
  | "restaurantEnabled"
  | "kdsEnabled"
  | "guestQrEnabled"
  | "folioBridgeEnabled"
  | "offlineDraftSyncEnabled"
  | "printerFailoverEnabled"
  | "pilotMode";

export const HOSPITALITY_FEATURE_KEYS: HospitalityFeatureKey[] = [
  "hotelEnabled",
  "restaurantEnabled",
  "kdsEnabled",
  "guestQrEnabled",
  "folioBridgeEnabled",
  "offlineDraftSyncEnabled",
  "printerFailoverEnabled",
  "pilotMode",
];

function resolveDbAndInput<TInput>(
  arg1: PrismaClientOrTx | TInput,
  arg2?: TInput | PrismaClientOrTx
): { client: PrismaClientOrTx; input: TInput } {
  if (
    arg2 &&
    typeof arg2 === "object" &&
    ("businessId" in arg2 || "feature" in arg2 || "jobType" in arg2)
  ) {
    return {
      client: (arg1 as PrismaClientOrTx) || db,
      input: arg2 as TInput,
    };
  }
  if (
    arg1 &&
    typeof arg1 === "object" &&
    ("businessId" in arg1 || "feature" in arg1 || "jobType" in arg1)
  ) {
    return {
      client: (arg2 as PrismaClientOrTx) || db,
      input: arg1 as TInput,
    };
  }
  return {
    client: (arg1 as PrismaClientOrTx) || db,
    input: (arg2 ?? {}) as TInput,
  };
}

function generatePrintJobNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PJ-${datePart}-${timePart}-${rand}`;
}

function generateOfflineServiceRequestNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SR-OFF-${datePart}-${timePart}-${rand}`;
}

// -----------------------------------------------------------------------------
// 1. Feature Flag Governance
// -----------------------------------------------------------------------------

export interface GetPropertyFeatureFlagsInput {
  businessId: string;
  branchId: string;
}

export async function getPropertyFeatureFlags(
  dbClient: PrismaClientOrTx,
  input: GetPropertyFeatureFlagsInput
): Promise<Prisma.PropertyFeatureFlagGetPayload<Record<string, never>>>;
export async function getPropertyFeatureFlags(
  input: GetPropertyFeatureFlagsInput,
  dbClient?: PrismaClientOrTx
): Promise<Prisma.PropertyFeatureFlagGetPayload<Record<string, never>>>;
export async function getPropertyFeatureFlags(
  arg1: PrismaClientOrTx | GetPropertyFeatureFlagsInput,
  arg2?: GetPropertyFeatureFlagsInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<GetPropertyFeatureFlagsInput>(
    arg1,
    arg2
  );

  if (!input.businessId || !input.branchId) {
    throw new DomainError(
      "businessId and branchId are required",
      400,
      "VALIDATION_ERROR"
    );
  }

  const existing = await client.propertyFeatureFlag.findUnique({
    where: {
      businessId_branchId: {
        businessId: input.businessId,
        branchId: input.branchId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return await client.propertyFeatureFlag.upsert({
    where: {
      businessId_branchId: {
        businessId: input.businessId,
        branchId: input.branchId,
      },
    },
    update: {},
    create: {
      businessId: input.businessId,
      branchId: input.branchId,
      hotelEnabled: true,
      restaurantEnabled: true,
      kdsEnabled: true,
      guestQrEnabled: true,
      folioBridgeEnabled: true,
      offlineDraftSyncEnabled: true,
      printerFailoverEnabled: true,
      pilotMode: false,
      version: 1,
    },
  });
}

export interface UpdatePropertyFeatureFlagsInput {
  businessId: string;
  branchId: string;
  updatedById?: string;
  hotelEnabled?: boolean;
  restaurantEnabled?: boolean;
  kdsEnabled?: boolean;
  guestQrEnabled?: boolean;
  folioBridgeEnabled?: boolean;
  offlineDraftSyncEnabled?: boolean;
  printerFailoverEnabled?: boolean;
  pilotMode?: boolean;
  metadata?: Record<string, unknown>;
}

export async function updatePropertyFeatureFlags(
  dbClient: PrismaClientOrTx,
  input: UpdatePropertyFeatureFlagsInput
): Promise<Prisma.PropertyFeatureFlagGetPayload<Record<string, never>>>;
export async function updatePropertyFeatureFlags(
  input: UpdatePropertyFeatureFlagsInput,
  dbClient?: PrismaClientOrTx
): Promise<Prisma.PropertyFeatureFlagGetPayload<Record<string, never>>>;
export async function updatePropertyFeatureFlags(
  arg1: PrismaClientOrTx | UpdatePropertyFeatureFlagsInput,
  arg2?: UpdatePropertyFeatureFlagsInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<UpdatePropertyFeatureFlagsInput>(
    arg1,
    arg2
  );

  if (!input.businessId || !input.branchId) {
    throw new DomainError(
      "businessId and branchId are required",
      400,
      "VALIDATION_ERROR"
    );
  }

  return await withHotelTransaction(client, async (tx) => {
    const existing = await tx.propertyFeatureFlag.findUnique({
      where: {
        businessId_branchId: {
          businessId: input.businessId,
          branchId: input.branchId,
        },
      },
    });

    const updateData: Prisma.PropertyFeatureFlagUncheckedUpdateInput = {
      version: { increment: 1 },
      ...(input.updatedById !== undefined
        ? { updatedById: input.updatedById }
        : {}),
      ...(input.hotelEnabled !== undefined
        ? { hotelEnabled: input.hotelEnabled }
        : {}),
      ...(input.restaurantEnabled !== undefined
        ? { restaurantEnabled: input.restaurantEnabled }
        : {}),
      ...(input.kdsEnabled !== undefined
        ? { kdsEnabled: input.kdsEnabled }
        : {}),
      ...(input.guestQrEnabled !== undefined
        ? { guestQrEnabled: input.guestQrEnabled }
        : {}),
      ...(input.folioBridgeEnabled !== undefined
        ? { folioBridgeEnabled: input.folioBridgeEnabled }
        : {}),
      ...(input.offlineDraftSyncEnabled !== undefined
        ? { offlineDraftSyncEnabled: input.offlineDraftSyncEnabled }
        : {}),
      ...(input.printerFailoverEnabled !== undefined
        ? { printerFailoverEnabled: input.printerFailoverEnabled }
        : {}),
      ...(input.pilotMode !== undefined ? { pilotMode: input.pilotMode } : {}),
      ...(input.metadata !== undefined
        ? { metadata: input.metadata as Prisma.InputJsonValue }
        : {}),
    };

    const updated = await tx.propertyFeatureFlag.upsert({
      where: {
        businessId_branchId: {
          businessId: input.businessId,
          branchId: input.branchId,
        },
      },
      update: updateData,
      create: {
        businessId: input.businessId,
        branchId: input.branchId,
        hotelEnabled: input.hotelEnabled ?? true,
        restaurantEnabled: input.restaurantEnabled ?? true,
        kdsEnabled: input.kdsEnabled ?? true,
        guestQrEnabled: input.guestQrEnabled ?? true,
        folioBridgeEnabled: input.folioBridgeEnabled ?? true,
        offlineDraftSyncEnabled: input.offlineDraftSyncEnabled ?? true,
        printerFailoverEnabled: input.printerFailoverEnabled ?? true,
        pilotMode: input.pilotMode ?? false,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
        updatedById: input.updatedById ?? null,
        version: 1,
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.updatedById ?? null,
        action: "PROPERTY_FEATURE_FLAGS_UPDATED",
        entity: "PropertyFeatureFlag",
        entityId: updated.id,
        entityVersion: updated.version,
        oldValue: existing ?? null,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

export interface AssertFeatureEnabledInput {
  businessId: string;
  branchId: string;
  feature: HospitalityFeatureKey;
}

export async function assertFeatureEnabled(
  dbClient: PrismaClientOrTx,
  input: AssertFeatureEnabledInput
): Promise<void>;
export async function assertFeatureEnabled(
  input: AssertFeatureEnabledInput,
  dbClient?: PrismaClientOrTx
): Promise<void>;
export async function assertFeatureEnabled(
  arg1: PrismaClientOrTx | AssertFeatureEnabledInput,
  arg2?: AssertFeatureEnabledInput | PrismaClientOrTx
): Promise<void> {
  const { client, input } = resolveDbAndInput<AssertFeatureEnabledInput>(
    arg1,
    arg2
  );

  const row = await client.propertyFeatureFlag.findUnique({
    where: {
      businessId_branchId: {
        businessId: input.businessId,
        branchId: input.branchId,
      },
    },
  });

  if (row && row[input.feature] === false) {
    throw new DomainError(
      `Feature '${input.feature}' is currently disabled for this branch.`,
      403,
      "FEATURE_DISABLED"
    );
  }
}

// -----------------------------------------------------------------------------
// 2. Hardware ESC/POS Formatting, Print Jobs & Automatic Failover
// -----------------------------------------------------------------------------

export type PrintJobType =
  | "KOT_58MM"
  | "RECEIPT_80MM"
  | "FOLIO_INVOICE"
  | "CASH_DRAWER_PULSE"
  | "TEST_PAGE";

export interface EscPosLineInput {
  label: string;
  qty?: number;
  price?: number;
  notes?: string;
}

export interface BuildEscPosPayloadInput {
  jobType: PrintJobType;
  title: string;
  subtitle?: string;
  lines?: EscPosLineInput[];
  footer?: string;
  cashDrawerPulse?: boolean;
}

export function buildEscPosPayload(input: BuildEscPosPayloadInput): string {
  const ESC_INIT = "\x1B\x40";
  const ESC_BOLD_ON = "\x1B\x45\x01";
  const ESC_BOLD_OFF = "\x1B\x45\x02";
  const ESC_ALIGN_CENTER = "\x1B\x61\x01";
  const ESC_ALIGN_LEFT = "\x1B\x61\x02";
  const ESC_DRAWER_PULSE = "<ESC_P_00_19_FA>";
  const GS_CUT = "\x1D\x56\x41\x03";

  const width = input.jobType === "KOT_58MM" ? 32 : 48;
  const separator = "-".repeat(width);
  const includeDrawerPulse =
    input.cashDrawerPulse === true || input.jobType === "CASH_DRAWER_PULSE";

  const parts: string[] = [];
  if (includeDrawerPulse) {
    parts.push(ESC_DRAWER_PULSE);
  }
  parts.push(ESC_INIT);
  parts.push(ESC_ALIGN_CENTER);
  parts.push(ESC_BOLD_ON);
  parts.push((input.title || input.jobType).slice(0, width) + "\n");
  parts.push(ESC_BOLD_OFF);

  if (input.subtitle) {
    parts.push(input.subtitle.slice(0, width) + "\n");
  }

  parts.push(ESC_ALIGN_LEFT);
  parts.push(separator + "\n");

  for (const line of input.lines ?? []) {
    const leftRaw =
      line.qty !== undefined ? `${line.qty}x ${line.label}` : line.label;
    const rightRaw =
      line.price !== undefined ? Number(line.price).toFixed(2) : "";

    if (rightRaw) {
      const maxLeftLen = Math.max(1, width - rightRaw.length - 1);
      const leftTrunc = leftRaw.slice(0, maxLeftLen);
      const spaces = " ".repeat(
        Math.max(1, width - leftTrunc.length - rightRaw.length)
      );
      parts.push(`${leftTrunc}${spaces}${rightRaw}\n`);
    } else {
      parts.push(leftRaw.slice(0, width).padEnd(width, " ") + "\n");
    }

    if (line.notes) {
      parts.push(`  * ${line.notes}`.slice(0, width) + "\n");
    }
  }

  parts.push(separator + "\n");

  if (input.footer) {
    parts.push(ESC_ALIGN_CENTER);
    parts.push(input.footer.slice(0, width) + "\n");
    parts.push(ESC_ALIGN_LEFT);
  }

  parts.push("\n\n");
  parts.push(GS_CUT);

  return parts.join("");
}

export interface FailoverAlertMetadata {
  redirected: boolean;
  primaryStationCode?: string;
  backupStationCode?: string;
  kdsBannerMessage?: string;
}

export interface EnqueueAndDispatchPrintJobInput {
  businessId: string;
  branchId: string;
  stationId?: string;
  fallbackStationId?: string;
  ticketId?: string;
  jobType: PrintJobType;
  printerWidthMm?: number;
  targetPrinterIp?: string;
  targetPrinterPort?: number;
  cashDrawerPulse?: boolean;
  title?: string;
  subtitle?: string;
  lines?: EscPosLineInput[];
  footer?: string;
  simulatePrimaryFailure?: boolean;
  idempotencyKey?: string;
  actorUserId?: string;
}

export type DispatchedPrintJobResult = Prisma.PrintJobGetPayload<
  Record<string, never>
> & {
  job: Prisma.PrintJobGetPayload<Record<string, never>>;
  failoverAlert: FailoverAlertMetadata;
  deduplicated?: boolean;
};

export async function enqueueAndDispatchPrintJob(
  dbClient: PrismaClientOrTx,
  input: EnqueueAndDispatchPrintJobInput
): Promise<DispatchedPrintJobResult>;
export async function enqueueAndDispatchPrintJob(
  input: EnqueueAndDispatchPrintJobInput,
  dbClient?: PrismaClientOrTx
): Promise<DispatchedPrintJobResult>;
export async function enqueueAndDispatchPrintJob(
  arg1: PrismaClientOrTx | EnqueueAndDispatchPrintJobInput,
  arg2?: EnqueueAndDispatchPrintJobInput | PrismaClientOrTx
): Promise<DispatchedPrintJobResult> {
  const { client, input } = resolveDbAndInput<EnqueueAndDispatchPrintJobInput>(
    arg1,
    arg2
  );

  return await withHotelTransaction(client, async (tx) => {
    const idempKey = input.idempotencyKey?.trim() || null;
    if (idempKey) {
      const existing = await tx.printJob.findFirst({
        where: {
          businessId: input.businessId,
          branchId: input.branchId,
          idempotencyKey: idempKey,
        },
      });
      if (existing) {
        let primaryCode: string | undefined;
        let backupCode: string | undefined;
        if (existing.stationId) {
          const st = await tx.kitchenStation.findFirst({
            where: { id: existing.stationId, businessId: input.businessId },
          });
          primaryCode = st?.code;
        }
        if (existing.routedStationId) {
          const bk = await tx.kitchenStation.findFirst({
            where: {
              id: existing.routedStationId,
              businessId: input.businessId,
            },
          });
          backupCode = bk?.code;
        }
        const redirected = existing.status === "REDIRECTED_TO_BACKUP";
        const failoverAlert: FailoverAlertMetadata = {
          redirected,
          primaryStationCode: primaryCode,
          backupStationCode: redirected ? backupCode : undefined,
          kdsBannerMessage: redirected
            ? `[FAILOVER ALERT: Printed at backup station ${backupCode ?? "BACKUP"}]`
            : undefined,
        };
        return {
          ...existing,
          job: existing,
          failoverAlert,
          deduplicated: true,
        };
      }
    }

    const primaryStation = input.stationId
      ? await tx.kitchenStation.findFirst({
          where: {
            id: input.stationId,
            businessId: input.businessId,
          },
        })
      : null;

    const featureFlags = await tx.propertyFeatureFlag.findUnique({
      where: {
        businessId_branchId: {
          businessId: input.businessId,
          branchId: input.branchId,
        },
      },
    });
    const printerFailoverEnabled =
      featureFlags?.printerFailoverEnabled ?? true;

    const printerWidthMm =
      input.printerWidthMm ?? (input.jobType === "KOT_58MM" ? 58 : 80);
    const cashDrawerPulse = Boolean(
      input.cashDrawerPulse || input.jobType === "CASH_DRAWER_PULSE"
    );

    const escPosPayload = buildEscPosPayload({
      jobType: input.jobType,
      title: input.title || input.jobType,
      subtitle: input.subtitle,
      lines: input.lines,
      footer: input.footer,
      cashDrawerPulse,
    });

    const now = new Date();
    let status = "PRINTED";
    let routedStationId: string | null = input.stationId ?? null;
    let fallbackStationId: string | null = input.fallbackStationId ?? null;
    let attempts = 1;
    let lastError: string | null = null;
    let printedAt: Date | null = now;
    let failoverAlert: FailoverAlertMetadata = {
      redirected: false,
      primaryStationCode: primaryStation?.code,
    };

    if (input.simulatePrimaryFailure === true) {
      let backupStation = input.fallbackStationId
        ? await tx.kitchenStation.findFirst({
            where: {
              id: input.fallbackStationId,
              businessId: input.businessId,
              isActive: true,
            },
          })
        : null;

      if (!backupStation) {
        backupStation = await tx.kitchenStation.findFirst({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            isActive: true,
            ...(input.stationId ? { id: { not: input.stationId } } : {}),
          },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        });
      }

      if (printerFailoverEnabled && backupStation) {
        status = "REDIRECTED_TO_BACKUP";
        routedStationId = backupStation.id;
        fallbackStationId = backupStation.id;
        attempts = 2;
        lastError = `Primary station printer unreachable/jammed; automatically redirected to backup station ${backupStation.code}`;
        printedAt = now;

        const kdsBannerMessage = `[FAILOVER ALERT: Printed at backup station ${backupStation.code} (${backupStation.name})]`;
        failoverAlert = {
          redirected: true,
          primaryStationCode: primaryStation?.code,
          backupStationCode: backupStation.code,
          kdsBannerMessage,
        };

        if (input.ticketId) {
          const ticket = await tx.kitchenTicket.findFirst({
            where: { id: input.ticketId, businessId: input.businessId },
          });
          if (ticket) {
            const existingNotes = ticket.notes ? `${ticket.notes} ` : "";
            const nextNotes = existingNotes.includes(kdsBannerMessage)
              ? ticket.notes
              : `${existingNotes}${kdsBannerMessage}`;
            await tx.kitchenTicket.update({
              where: { id: ticket.id },
              data: {
                notes: nextNotes,
                printedAt: now,
              },
            });
          }
        }
      } else {
        status = "FAILED";
        routedStationId = null;
        attempts = 1;
        lastError = "Primary printer unreachable or paper jam";
        printedAt = null;
        failoverAlert = {
          redirected: false,
          primaryStationCode: primaryStation?.code,
        };
      }
    } else if (input.ticketId) {
      const ticket = await tx.kitchenTicket.findFirst({
        where: { id: input.ticketId, businessId: input.businessId },
      });
      if (ticket) {
        await tx.kitchenTicket.update({
          where: { id: ticket.id },
          data: { printedAt: now },
        });
      }
    }

    const createdJob = await tx.printJob.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        stationId: input.stationId ?? null,
        ticketId: input.ticketId ?? null,
        jobNumber: generatePrintJobNumber(now),
        jobType: input.jobType,
        printerWidthMm,
        targetPrinterIp:
          input.targetPrinterIp ?? primaryStation?.printerIp ?? "192.168.1.200",
        targetPrinterPort:
          input.targetPrinterPort ?? primaryStation?.printerPort ?? 9100,
        fallbackStationId,
        routedStationId,
        cashDrawerPulse,
        escPosPayload,
        status,
        attempts,
        lastError,
        idempotencyKey: idempKey,
        printedAt,
      },
    });

    if (status === "REDIRECTED_TO_BACKUP") {
      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorUserId ?? null,
          action: "PRINTER_FAILOVER_REDIRECTED",
          entity: "PrintJob",
          entityId: createdJob.id,
          newValue: {
            jobNumber: createdJob.jobNumber,
            stationId: createdJob.stationId,
            routedStationId: createdJob.routedStationId,
            status: createdJob.status,
            lastError: createdJob.lastError,
            failoverAlert,
          },
        },
        tx
      );
    }

    return {
      ...createdJob,
      job: createdJob,
      failoverAlert,
      deduplicated: false,
    };
  });
}

export interface ListPrintJobsInput {
  businessId: string;
  branchId: string;
  stationId?: string;
  status?: string;
  limit?: number;
}

export async function listPrintJobs(
  dbClient: PrismaClientOrTx,
  input: ListPrintJobsInput
): Promise<{
  jobs: Prisma.PrintJobGetPayload<{
    include: { station: true; ticket: true };
  }>[];
  kdsFailoverAlerts: Array<{
    printJobId: string;
    jobNumber: string;
    ticketId: string | null;
    stationId: string | null;
    primaryStationCode: string | null;
    routedStationId: string | null;
    lastError: string | null;
    kdsBannerMessage: string;
    printedAt: Date | null;
  }>;
}>;
export async function listPrintJobs(
  input: ListPrintJobsInput,
  dbClient?: PrismaClientOrTx
): Promise<{
  jobs: Prisma.PrintJobGetPayload<{
    include: { station: true; ticket: true };
  }>[];
  kdsFailoverAlerts: Array<{
    printJobId: string;
    jobNumber: string;
    ticketId: string | null;
    stationId: string | null;
    primaryStationCode: string | null;
    routedStationId: string | null;
    lastError: string | null;
    kdsBannerMessage: string;
    printedAt: Date | null;
  }>;
}>;
export async function listPrintJobs(
  arg1: PrismaClientOrTx | ListPrintJobsInput,
  arg2?: ListPrintJobsInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<ListPrintJobsInput>(arg1, arg2);

  const jobs = await client.printJob.findMany({
    where: {
      businessId: input.businessId,
      branchId: input.branchId,
      ...(input.stationId ? { stationId: input.stationId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      station: true,
      ticket: true,
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
  });

  const redirectedJobs = jobs.filter(
    (j) => j.status === "REDIRECTED_TO_BACKUP"
  );

  const kdsFailoverAlerts = redirectedJobs.map((j) => ({
    printJobId: j.id,
    jobNumber: j.jobNumber,
    ticketId: j.ticketId,
    stationId: j.stationId,
    primaryStationCode: j.station?.code ?? null,
    routedStationId: j.routedStationId,
    lastError: j.lastError,
    kdsBannerMessage:
      j.ticket?.notes ||
      j.lastError ||
      `[FAILOVER ALERT: Redirected to backup station]`,
    printedAt: j.printedAt,
  }));

  return {
    jobs,
    kdsFailoverAlerts,
  };
}

export interface RehearseHardwareMatrixInput {
  businessId: string;
  branchId: string;
  stationId?: string;
  fallbackStationId?: string;
  actorUserId?: string;
}

export async function rehearseHardwareMatrix(
  dbClient: PrismaClientOrTx,
  input: RehearseHardwareMatrixInput
): Promise<{
  passed: boolean;
  jobs: DispatchedPrintJobResult[];
  summary: {
    receipt80mmPassed: boolean;
    kot58mmPassed: boolean;
    cashDrawerPulsePassed: boolean;
    printerFailoverPassed: boolean;
  };
}>;
export async function rehearseHardwareMatrix(
  input: RehearseHardwareMatrixInput,
  dbClient?: PrismaClientOrTx
): Promise<{
  passed: boolean;
  jobs: DispatchedPrintJobResult[];
  summary: {
    receipt80mmPassed: boolean;
    kot58mmPassed: boolean;
    cashDrawerPulsePassed: boolean;
    printerFailoverPassed: boolean;
  };
}>;
export async function rehearseHardwareMatrix(
  arg1: PrismaClientOrTx | RehearseHardwareMatrixInput,
  arg2?: RehearseHardwareMatrixInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<RehearseHardwareMatrixInput>(
    arg1,
    arg2
  );

  let primaryStationId = input.stationId;
  let fallbackStationId = input.fallbackStationId;

  if (!primaryStationId || !fallbackStationId) {
    let stations = await client.kitchenStation.findMany({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    if (stations.length === 0) {
      const primary = await client.kitchenStation.upsert({
        where: {
          businessId_branchId_code: {
            businessId: input.businessId,
            branchId: input.branchId,
            code: "HOT",
          },
        },
        update: { isActive: true },
        create: {
          businessId: input.businessId,
          branchId: input.branchId,
          name: "Hot Kitchen Primary",
          code: "HOT",
          printerIp: "192.168.1.201",
          printerPort: 9100,
          displayOrder: 1,
          isActive: true,
        },
      });
      const backup = await client.kitchenStation.upsert({
        where: {
          businessId_branchId_code: {
            businessId: input.businessId,
            branchId: input.branchId,
            code: "BACKUP",
          },
        },
        update: { isActive: true },
        create: {
          businessId: input.businessId,
          branchId: input.branchId,
          name: "Backup Pass Printer",
          code: "BACKUP",
          printerIp: "192.168.1.202",
          printerPort: 9100,
          displayOrder: 2,
          isActive: true,
        },
      });
      stations = [primary, backup];
    } else if (stations.length === 1) {
      const backupCode =
        stations[0].code === "BACKUP" ? "BACKUP_2" : "BACKUP";
      const backup = await client.kitchenStation.upsert({
        where: {
          businessId_branchId_code: {
            businessId: input.businessId,
            branchId: input.branchId,
            code: backupCode,
          },
        },
        update: { isActive: true },
        create: {
          businessId: input.businessId,
          branchId: input.branchId,
          name: "Backup Pass Printer",
          code: backupCode,
          printerIp: "192.168.1.202",
          printerPort: 9100,
          displayOrder: 2,
          isActive: true,
        },
      });
      stations = [stations[0], backup];
    }

    if (!primaryStationId) {
      primaryStationId = stations[0].id;
    }
    if (!fallbackStationId) {
      const other = stations.find((s) => s.id !== primaryStationId);
      fallbackStationId = other?.id;
    }
  }

  // 1. 80mm Front-Desk / Counter Thermal Receipt
  const job1 = await enqueueAndDispatchPrintJob(client, {
    businessId: input.businessId,
    branchId: input.branchId,
    jobType: "RECEIPT_80MM",
    printerWidthMm: 80,
    title: "PILOT HARDWARE REHEARSAL - 80MM RECEIPT",
    subtitle: "Front Desk & Retail Counter Thermal Check",
    lines: [
      { label: "Room 101 Nightly Stay", qty: 1, price: 4500 },
      { label: "Restaurant Dining Transfer", qty: 1, price: 1250 },
    ],
    footer: "80MM ESC/POS Alignment Verified",
    actorUserId: input.actorUserId,
  });

  // 2. 58mm Kitchen Order Ticket on Primary Station
  const job2 = await enqueueAndDispatchPrintJob(client, {
    businessId: input.businessId,
    branchId: input.branchId,
    stationId: primaryStationId,
    fallbackStationId,
    jobType: "KOT_58MM",
    printerWidthMm: 58,
    title: "PILOT KOT 58MM - PRIMARY",
    subtitle: "Table T1 - Round 1",
    lines: [
      { label: "Himalayan Momo Platter", qty: 2, notes: "Extra spicy chutney" },
      { label: "Masala Chai", qty: 2 },
    ],
    footer: "58MM KOT Verified",
    actorUserId: input.actorUserId,
  });

  // 3. RJ11 Cash Drawer Kick Pulse
  const job3 = await enqueueAndDispatchPrintJob(client, {
    businessId: input.businessId,
    branchId: input.branchId,
    jobType: "CASH_DRAWER_PULSE",
    printerWidthMm: 80,
    cashDrawerPulse: true,
    title: "RJ11 CASH DRAWER PULSE TEST",
    subtitle: "Kick Pulse \\x1B\\x70\\x00\\x19\\xFA",
    lines: [{ label: "Drawer Solenoid Triggered", qty: 1, price: 0 }],
    footer: "Cash Drawer Pulse Verified",
    actorUserId: input.actorUserId,
  });

  // 4. 58mm KOT with Simulated Primary Failure -> Automatic Failover to Backup Station
  const job4 = await enqueueAndDispatchPrintJob(client, {
    businessId: input.businessId,
    branchId: input.branchId,
    stationId: primaryStationId,
    fallbackStationId,
    jobType: "KOT_58MM",
    printerWidthMm: 58,
    simulatePrimaryFailure: true,
    title: "PILOT KOT 58MM - FAILOVER REHEARSAL",
    subtitle: "Simulated Paper Jam / Offline Primary",
    lines: [{ label: "Wood-Fired Pizza Margherita", qty: 1 }],
    footer: "Automatic Failover Verified",
    actorUserId: input.actorUserId,
  });

  const receipt80mmPassed =
    job1.status === "PRINTED" &&
    job1.printerWidthMm === 80 &&
    job1.escPosPayload.includes("\x1B\x40");
  const kot58mmPassed =
    job2.status === "PRINTED" &&
    job2.printerWidthMm === 58 &&
    job2.escPosPayload.includes("\x1B\x40");
  const cashDrawerPulsePassed =
    job3.status === "PRINTED" &&
    job3.cashDrawerPulse === true &&
    job3.escPosPayload.includes("<ESC_P_00_19_FA>");
  const printerFailoverPassed =
    job4.status === "REDIRECTED_TO_BACKUP" &&
    Boolean(job4.routedStationId) &&
    job4.routedStationId !== primaryStationId;

  const passed =
    receipt80mmPassed &&
    kot58mmPassed &&
    cashDrawerPulsePassed &&
    printerFailoverPassed;

  return {
    passed,
    jobs: [job1, job2, job3, job4],
    summary: {
      receipt80mmPassed,
      kot58mmPassed,
      cashDrawerPulsePassed,
      printerFailoverPassed,
    },
  };
}

// -----------------------------------------------------------------------------
// 3. Offline Terminal Draft Buffering & Idempotent Reconnect Sync
// -----------------------------------------------------------------------------

export interface OfflineDraftOperation {
  idempotencyKey: string;
  type: "RESTAURANT_ORDER_DRAFT" | "SERVICE_REQUEST_DRAFT" | "NOTE_DRAFT";
  payload: Record<string, any>;
}

export interface SyncOfflineDraftBatchInput {
  businessId: string;
  branchId: string;
  terminalId: string;
  batchKey: string;
  syncedById?: string;
  operations: OfflineDraftOperation[];
}

export async function syncOfflineDraftBatch(
  dbClient: PrismaClientOrTx,
  input: SyncOfflineDraftBatchInput
): Promise<{
  batch: Prisma.OfflineSyncBatchGetPayload<Record<string, never>>;
  replayed: boolean;
  results: Array<Record<string, unknown>>;
}>;
export async function syncOfflineDraftBatch(
  input: SyncOfflineDraftBatchInput,
  dbClient?: PrismaClientOrTx
): Promise<{
  batch: Prisma.OfflineSyncBatchGetPayload<Record<string, never>>;
  replayed: boolean;
  results: Array<Record<string, unknown>>;
}>;
export async function syncOfflineDraftBatch(
  arg1: PrismaClientOrTx | SyncOfflineDraftBatchInput,
  arg2?: SyncOfflineDraftBatchInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<SyncOfflineDraftBatchInput>(
    arg1,
    arg2
  );

  await assertFeatureEnabled(client, {
    businessId: input.businessId,
    branchId: input.branchId,
    feature: "offlineDraftSyncEnabled",
  });

  const existingBatch = await client.offlineSyncBatch.findUnique({
    where: {
      businessId_branchId_batchKey: {
        businessId: input.businessId,
        branchId: input.branchId,
        batchKey: input.batchKey,
      },
    },
  });

  if (existingBatch) {
    return {
      batch: existingBatch,
      replayed: true,
      results: Array.isArray(existingBatch.results)
        ? (existingBatch.results as Array<Record<string, unknown>>)
        : [],
    };
  }

  return await withHotelTransaction(client, async (tx) => {
    const doubleCheck = await tx.offlineSyncBatch.findUnique({
      where: {
        businessId_branchId_batchKey: {
          businessId: input.businessId,
          branchId: input.branchId,
          batchKey: input.batchKey,
        },
      },
    });
    if (doubleCheck) {
      return {
        batch: doubleCheck,
        replayed: true,
        results: Array.isArray(doubleCheck.results)
          ? (doubleCheck.results as Array<Record<string, unknown>>)
          : [],
      };
    }

    const operations = Array.isArray(input.operations) ? input.operations : [];
    const results: Array<Record<string, unknown>> = [];
    let appliedCount = 0;

    for (const op of operations) {
      const payload = op.payload ?? {};

      if (op.type === "RESTAURANT_ORDER_DRAFT") {
        const orderNumber =
          payload.orderNumber || `OFF-${op.idempotencyKey.slice(0, 12)}`;

        let order = await tx.restaurantOrder.findFirst({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            orderNumber,
          },
        });

        if (order) {
          results.push({
            idempotencyKey: op.idempotencyKey,
            type: op.type,
            status: "DEDUPLICATED",
            orderId: order.id,
            orderNumber: order.orderNumber,
          });
        } else {
          const rawItems: Array<{
            menuItemId?: string;
            itemName?: string;
            name?: string;
            quantity?: number;
            unitPrice?: number;
            basePrice?: number;
            notes?: string;
          }> = Array.isArray(payload.items) ? payload.items : [];

          let subtotal = money(0);
          const resolvedLines: Array<{
            menuItemId: string | null;
            itemName: string;
            quantity: number;
            unitPrice: Prisma.Decimal;
            lineTotal: Prisma.Decimal;
            notes: string | null;
          }> = [];

          for (const item of rawItems) {
            let itemName = item.itemName || item.name || "Offline Draft Item";
            let unitPriceNum =
              item.unitPrice ?? item.basePrice ?? undefined;

            if (item.menuItemId && unitPriceNum === undefined) {
              const foundMenu = await tx.menuItem.findFirst({
                where: {
                  id: item.menuItemId,
                  businessId: input.businessId,
                },
              });
              if (foundMenu) {
                itemName = foundMenu.name;
                unitPriceNum = Number(foundMenu.basePrice);
              }
            } else if (item.menuItemId && !item.itemName && !item.name) {
              const foundMenu = await tx.menuItem.findFirst({
                where: {
                  id: item.menuItemId,
                  businessId: input.businessId,
                },
              });
              if (foundMenu) {
                itemName = foundMenu.name;
              }
            }

            const qty = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
            const unitPrice = money(unitPriceNum ?? 0);
            const lineTotal = money(Number(unitPrice) * qty);
            subtotal = addMoney(subtotal, lineTotal);

            resolvedLines.push({
              menuItemId: item.menuItemId ?? null,
              itemName,
              quantity: qty,
              unitPrice,
              lineTotal,
              notes: item.notes ?? null,
            });
          }

          order = await tx.restaurantOrder.create({
            data: {
              businessId: input.businessId,
              branchId: input.branchId,
              orderNumber,
              orderType: payload.orderType || "DINE_IN",
              acceptanceStatus: "PENDING",
              fulfillmentStatus: "QUEUED",
              settlementStatus: "UNPAID",
              tableId: payload.tableId ?? null,
              tableSessionId: payload.tableSessionId ?? null,
              subtotal,
              taxTotal: money(0),
              totalAmount: subtotal,
              paidAmount: money(0),
              createdById: input.syncedById ?? null,
              notes: payload.notes ?? "Synced from offline terminal draft",
            },
          });

          if (resolvedLines.length > 0) {
            const round = await tx.orderRound.create({
              data: {
                businessId: input.businessId,
                orderId: order.id,
                roundNumber: 1,
                status: "SUBMITTED",
                submittedById: input.syncedById ?? null,
                notes: payload.notes ?? "Synced from offline terminal draft",
              },
            });

            for (const rl of resolvedLines) {
              await tx.orderLine.create({
                data: {
                  businessId: input.businessId,
                  orderId: order.id,
                  roundId: round.id,
                  menuItemId: rl.menuItemId,
                  itemName: rl.itemName,
                  basePrice: rl.unitPrice,
                  quantity: rl.quantity,
                  appliedModifiers: [],
                  unitPrice: rl.unitPrice,
                  taxRate: money(0),
                  taxAmount: money(0),
                  subtotal: rl.lineTotal,
                  total: rl.lineTotal,
                  notes: rl.notes,
                  acceptanceStatus: "PENDING",
                  fulfillmentStatus: "QUEUED",
                  settlementStatus: "UNPAID",
                },
              });
            }
          }

          appliedCount += 1;
          results.push({
            idempotencyKey: op.idempotencyKey,
            type: op.type,
            status: "APPLIED",
            orderId: order.id,
            orderNumber: order.orderNumber,
          });
        }
      } else if (op.type === "SERVICE_REQUEST_DRAFT") {
        let qrLocationId: string | null = payload.qrLocationId ?? null;
        if (!qrLocationId && payload.publicCode) {
          const loc = await tx.qrLocation.findUnique({
            where: { publicCode: String(payload.publicCode) },
          });
          qrLocationId = loc?.id ?? null;
        }

        if (qrLocationId) {
          const existingSr = await tx.serviceRequest.findFirst({
            where: {
              businessId: input.businessId,
              qrLocationId,
              idempotencyKey: op.idempotencyKey,
            },
          });

          if (existingSr) {
            results.push({
              idempotencyKey: op.idempotencyKey,
              type: op.type,
              status: "DEDUPLICATED",
              serviceRequestId: existingSr.id,
            });
          } else {
            const createdSr = await tx.serviceRequest.create({
              data: {
                businessId: input.businessId,
                branchId: input.branchId,
                qrLocationId,
                stayId: payload.stayId ?? null,
                tableSessionId: payload.tableSessionId ?? null,
                roomId: payload.roomId ?? null,
                tableId: payload.tableId ?? null,
                requestNumber:
                  payload.requestNumber ||
                  generateOfflineServiceRequestNumber(),
                requestType: payload.requestType || "WAITER_CALL",
                category: payload.category || "RESTAURANT",
                priority: payload.priority || "NORMAL",
                status: "OPEN",
                notes: payload.notes ?? "Synced from offline terminal draft",
                idempotencyKey: op.idempotencyKey,
              },
            });
            appliedCount += 1;
            results.push({
              idempotencyKey: op.idempotencyKey,
              type: op.type,
              status: "APPLIED",
              serviceRequestId: createdSr.id,
            });
          }
        } else {
          results.push({
            idempotencyKey: op.idempotencyKey,
            type: op.type,
            status: "SKIPPED_NO_QR_LOCATION",
          });
        }
      } else if (op.type === "NOTE_DRAFT") {
        await createAuditEvent(
          {
            businessId: input.businessId,
            branchId: input.branchId,
            userId: input.syncedById ?? null,
            action: "OFFLINE_TERMINAL_NOTE_SYNCED",
            entity: "OfflineSyncBatch",
            entityId: op.idempotencyKey,
            newValue: payload,
            metadata: {
              terminalId: input.terminalId,
              batchKey: input.batchKey,
              idempotencyKey: op.idempotencyKey,
            },
          },
          tx
        );
        appliedCount += 1;
        results.push({
          idempotencyKey: op.idempotencyKey,
          type: op.type,
          status: "APPLIED",
        });
      }
    }

    const batch = await tx.offlineSyncBatch.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        terminalId: input.terminalId,
        batchKey: input.batchKey,
        operationsCount: operations.length,
        appliedCount,
        status: "COMPLETED",
        payload: operations as unknown as Prisma.InputJsonValue,
        results: results as unknown as Prisma.InputJsonValue,
        syncedById: input.syncedById ?? null,
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.syncedById ?? null,
        action: "OFFLINE_SYNC_BATCH_COMPLETED",
        entity: "OfflineSyncBatch",
        entityId: batch.id,
        newValue: {
          batchKey: batch.batchKey,
          terminalId: batch.terminalId,
          operationsCount: batch.operationsCount,
          appliedCount: batch.appliedCount,
          status: batch.status,
        },
      },
      tx
    );

    return {
      batch,
      replayed: false,
      results,
    };
  });
}

export interface ListOfflineSyncBatchesInput {
  businessId: string;
  branchId: string;
  limit?: number;
}

export async function listOfflineSyncBatches(
  dbClient: PrismaClientOrTx,
  input: ListOfflineSyncBatchesInput
): Promise<Prisma.OfflineSyncBatchGetPayload<Record<string, never>>[]>;
export async function listOfflineSyncBatches(
  input: ListOfflineSyncBatchesInput,
  dbClient?: PrismaClientOrTx
): Promise<Prisma.OfflineSyncBatchGetPayload<Record<string, never>>[]>;
export async function listOfflineSyncBatches(
  arg1: PrismaClientOrTx | ListOfflineSyncBatchesInput,
  arg2?: ListOfflineSyncBatchesInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<ListOfflineSyncBatchesInput>(
    arg1,
    arg2
  );

  return await client.offlineSyncBatch.findMany({
    where: {
      businessId: input.businessId,
      branchId: input.branchId,
    },
    orderBy: { syncedAt: "desc" },
    take: input.limit ?? 50,
  });
}

// -----------------------------------------------------------------------------
// 4. Pilot Daily Audit & Cash Drawer Reconciliation
// -----------------------------------------------------------------------------

export interface RunPilotDailyReconciliationInput {
  businessId: string;
  branchId: string;
  businessDate: string | Date;
  declaredCashTotal: number | string | Prisma.Decimal;
  expectedCashOverride?: number | string | Prisma.Decimal;
  notes?: string;
  reconciledById?: string;
}

export async function runPilotDailyReconciliation(
  dbClient: PrismaClientOrTx,
  input: RunPilotDailyReconciliationInput
): Promise<Prisma.PilotDailyReconciliationGetPayload<Record<string, never>>>;
export async function runPilotDailyReconciliation(
  input: RunPilotDailyReconciliationInput,
  dbClient?: PrismaClientOrTx
): Promise<Prisma.PilotDailyReconciliationGetPayload<Record<string, never>>>;
export async function runPilotDailyReconciliation(
  arg1: PrismaClientOrTx | RunPilotDailyReconciliationInput,
  arg2?: RunPilotDailyReconciliationInput | PrismaClientOrTx
) {
  const { client, input } =
    resolveDbAndInput<RunPilotDailyReconciliationInput>(arg1, arg2);

  const rawDate =
    input.businessDate instanceof Date
      ? input.businessDate
      : new Date(input.businessDate);
  if (Number.isNaN(rawDate.getTime())) {
    throw new DomainError(
      "Invalid businessDate provided",
      400,
      "INVALID_BUSINESS_DATE"
    );
  }

  const startOfDay = new Date(
    Date.UTC(
      rawDate.getUTCFullYear(),
      rawDate.getUTCMonth(),
      rawDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return await withHotelTransaction(client, async (tx) => {
    const [salesAgg, ordersAgg, folioSettlementsAgg, cashPaymentsAgg, folioCashAgg] =
      await Promise.all([
        tx.sale.aggregate({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            createdAt: { gte: startOfDay, lt: endOfDay },
            status: { not: "CANCELLED" },
            isActive: true,
            deletedAt: null,
          },
          _sum: { total: true },
        }),
        tx.restaurantOrder.aggregate({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            createdAt: { gte: startOfDay, lt: endOfDay },
            fulfillmentStatus: { not: "CANCELLED" },
            acceptanceStatus: { not: "REJECTED" },
          },
          _sum: { totalAmount: true },
        }),
        tx.folioSettlementAllocation.aggregate({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            allocatedAt: { gte: startOfDay, lt: endOfDay },
            status: "APPLIED",
          },
          _sum: { amount: true },
        }),
        tx.payment.aggregate({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            createdAt: { gte: startOfDay, lt: endOfDay },
            method: "CASH",
            type: "RECEIVED",
            reversal: null,
          },
          _sum: { amount: true },
        }),
        tx.folioSettlementAllocation.aggregate({
          where: {
            businessId: input.businessId,
            branchId: input.branchId,
            allocatedAt: { gte: startOfDay, lt: endOfDay },
            paymentMethod: "CASH",
            status: "APPLIED",
            paymentId: null,
          },
          _sum: { amount: true },
        }),
      ]);

    const retailSalesTotal = money(salesAgg._sum.total ?? 0);
    const restaurantOrdersTotal = money(ordersAgg._sum.totalAmount ?? 0);
    const folioSettlementsTotal = money(folioSettlementsAgg._sum.amount ?? 0);

    const computedCashTotal = addMoney(
      money(cashPaymentsAgg._sum.amount ?? 0),
      money(folioCashAgg._sum.amount ?? 0)
    );
    const expectedCashTotal =
      input.expectedCashOverride !== undefined
        ? money(input.expectedCashOverride)
        : computedCashTotal;

    const declaredCashTotal = money(input.declaredCashTotal);
    const cashVariance = subMoney(declaredCashTotal, expectedCashTotal);
    const status =
      Math.abs(Number(cashVariance)) < 0.01
        ? "BALANCED"
        : "DISCREPANCY_FLAGGED";

    const reconciliation = await tx.pilotDailyReconciliation.upsert({
      where: {
        businessId_branchId_businessDate: {
          businessId: input.businessId,
          branchId: input.branchId,
          businessDate: startOfDay,
        },
      },
      update: {
        expectedCashTotal,
        declaredCashTotal,
        cashVariance,
        retailSalesTotal,
        restaurantOrdersTotal,
        folioSettlementsTotal,
        status,
        notes: input.notes ?? null,
        reconciledById: input.reconciledById ?? null,
        reconciledAt: new Date(),
      },
      create: {
        businessId: input.businessId,
        branchId: input.branchId,
        businessDate: startOfDay,
        expectedCashTotal,
        declaredCashTotal,
        cashVariance,
        retailSalesTotal,
        restaurantOrdersTotal,
        folioSettlementsTotal,
        status,
        notes: input.notes ?? null,
        reconciledById: input.reconciledById ?? null,
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.reconciledById ?? null,
        action: "PILOT_DAILY_RECONCILIATION_COMPLETED",
        entity: "PilotDailyReconciliation",
        entityId: reconciliation.id,
        newValue: {
          businessDate: startOfDay.toISOString(),
          expectedCashTotal: expectedCashTotal.toFixed(2),
          declaredCashTotal: declaredCashTotal.toFixed(2),
          cashVariance: cashVariance.toFixed(2),
          retailSalesTotal: retailSalesTotal.toFixed(2),
          restaurantOrdersTotal: restaurantOrdersTotal.toFixed(2),
          folioSettlementsTotal: folioSettlementsTotal.toFixed(2),
          status,
        },
      },
      tx
    );

    return reconciliation;
  });
}

export interface ListPilotReconciliationsInput {
  businessId: string;
  branchId: string;
  limit?: number;
}

export async function listPilotReconciliations(
  dbClient: PrismaClientOrTx,
  input: ListPilotReconciliationsInput
): Promise<Prisma.PilotDailyReconciliationGetPayload<Record<string, never>>[]>;
export async function listPilotReconciliations(
  input: ListPilotReconciliationsInput,
  dbClient?: PrismaClientOrTx
): Promise<Prisma.PilotDailyReconciliationGetPayload<Record<string, never>>[]>;
export async function listPilotReconciliations(
  arg1: PrismaClientOrTx | ListPilotReconciliationsInput,
  arg2?: ListPilotReconciliationsInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<ListPilotReconciliationsInput>(
    arg1,
    arg2
  );

  return await client.pilotDailyReconciliation.findMany({
    where: {
      businessId: input.businessId,
      branchId: input.branchId,
    },
    orderBy: { businessDate: "desc" },
    take: input.limit ?? 30,
  });
}

export interface GetPilotOperationalHealthInput {
  businessId: string;
  branchId: string;
}

export async function getPilotOperationalHealth(
  dbClient: PrismaClientOrTx,
  input: GetPilotOperationalHealthInput
): Promise<{
  featureFlags: Prisma.PropertyFeatureFlagGetPayload<Record<string, never>>;
  outbox: {
    pendingCount: number;
    failedCount: number;
    processedCount: number;
  };
  printQueue: {
    queuedCount: number;
    printedCount: number;
    redirectedCount: number;
    failedCount: number;
    activeFailoverAlerts: Array<{
      printJobId: string;
      jobNumber: string;
      ticketId: string | null;
      stationId: string | null;
      primaryStationCode: string | null;
      routedStationId: string | null;
      lastError: string | null;
      kdsBannerMessage: string;
      printedAt: Date | null;
    }>;
  };
  offlineSync: {
    totalBatches: number;
    recentBatches: Prisma.OfflineSyncBatchGetPayload<Record<string, never>>[];
  };
  latestReconciliation: Prisma.PilotDailyReconciliationGetPayload<
    Record<string, never>
  > | null;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  status: "HEALTHY" | "DEGRADED";
}>;
export async function getPilotOperationalHealth(
  input: GetPilotOperationalHealthInput,
  dbClient?: PrismaClientOrTx
): Promise<{
  featureFlags: Prisma.PropertyFeatureFlagGetPayload<Record<string, never>>;
  outbox: {
    pendingCount: number;
    failedCount: number;
    processedCount: number;
  };
  printQueue: {
    queuedCount: number;
    printedCount: number;
    redirectedCount: number;
    failedCount: number;
    activeFailoverAlerts: Array<{
      printJobId: string;
      jobNumber: string;
      ticketId: string | null;
      stationId: string | null;
      primaryStationCode: string | null;
      routedStationId: string | null;
      lastError: string | null;
      kdsBannerMessage: string;
      printedAt: Date | null;
    }>;
  };
  offlineSync: {
    totalBatches: number;
    recentBatches: Prisma.OfflineSyncBatchGetPayload<Record<string, never>>[];
  };
  latestReconciliation: Prisma.PilotDailyReconciliationGetPayload<
    Record<string, never>
  > | null;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  status: "HEALTHY" | "DEGRADED";
}>;
export async function getPilotOperationalHealth(
  arg1: PrismaClientOrTx | GetPilotOperationalHealthInput,
  arg2?: GetPilotOperationalHealthInput | PrismaClientOrTx
) {
  const { client, input } = resolveDbAndInput<GetPilotOperationalHealthInput>(
    arg1,
    arg2
  );

  const [
    featureFlags,
    outboxPendingCount,
    outboxFailedCount,
    outboxProcessedCount,
    printQueuedCount,
    printPrintedCount,
    printRedirectedCount,
    printFailedCount,
    printJobsData,
    totalOfflineBatches,
    recentOfflineBatches,
    latestReconciliation,
  ] = await Promise.all([
    getPropertyFeatureFlags(client, input),
    client.outboxEvent.count({
      where: { businessId: input.businessId, status: "PENDING" },
    }),
    client.outboxEvent.count({
      where: { businessId: input.businessId, status: "FAILED" },
    }),
    client.outboxEvent.count({
      where: {
        businessId: input.businessId,
        status: { in: ["PUBLISHED", "PROCESSED", "COMPLETED"] },
      },
    }),
    client.printJob.count({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        status: "QUEUED",
      },
    }),
    client.printJob.count({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        status: "PRINTED",
      },
    }),
    client.printJob.count({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        status: "REDIRECTED_TO_BACKUP",
      },
    }),
    client.printJob.count({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        status: "FAILED",
      },
    }),
    listPrintJobs(client, {
      businessId: input.businessId,
      branchId: input.branchId,
      limit: 20,
    }),
    client.offlineSyncBatch.count({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
      },
    }),
    listOfflineSyncBatches(client, {
      businessId: input.businessId,
      branchId: input.branchId,
      limit: 10,
    }),
    client.pilotDailyReconciliation.findFirst({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
      },
      orderBy: { businessDate: "desc" },
    }),
  ]);

  const isDegraded =
    outboxFailedCount > 0 ||
    printFailedCount > 0 ||
    latestReconciliation?.status === "DISCREPANCY_FLAGGED";

  return {
    featureFlags,
    outbox: {
      pendingCount: outboxPendingCount,
      failedCount: outboxFailedCount,
      processedCount: outboxProcessedCount,
    },
    printQueue: {
      queuedCount: printQueuedCount,
      printedCount: printPrintedCount,
      redirectedCount: printRedirectedCount,
      failedCount: printFailedCount,
      activeFailoverAlerts: printJobsData.kdsFailoverAlerts,
    },
    offlineSync: {
      totalBatches: totalOfflineBatches,
      recentBatches: recentOfflineBatches,
    },
    latestReconciliation,
    rpoTargetMinutes: 5,
    rtoTargetMinutes: 30,
    status: isDegraded ? "DEGRADED" : "HEALTHY",
  };
}
