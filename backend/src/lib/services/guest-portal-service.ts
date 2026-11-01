import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { createAuditEvent } from "@/lib/audit-event";
import { addMoney, money } from "@/lib/services/decimal-math";
import {
  HotelError,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";
import {
  AppliedModifierInput,
  createOrAppendOrder,
  OrderItemInput,
} from "@/lib/services/restaurant-order-service";
import { openTableSession } from "@/lib/services/table-session-service";
import {
  assertFeatureEnabled,
  DomainError,
} from "@/lib/services/pilot-rollout-service";

export { HotelError, DomainError };

export class GuestPortalError extends HotelError {
  constructor(message: string, statusCode = 400, code?: string) {
    super(message, statusCode, code);
    this.name = "GuestPortalError";
  }
}

export const GUEST_ROOM_SCOPES = [
  "MENU_BROWSE",
  "ORDER_INITIATE",
  "SERVICE_REQUEST",
  "BILL_VIEW",
  "CHECKOUT_REQUEST",
] as const;

export const GUEST_TABLE_SCOPES = [
  "MENU_BROWSE",
  "ORDER_INITIATE",
  "SERVICE_REQUEST",
] as const;

export const SERVICE_REQUEST_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

export function hashGuestSecret(secret: string): string {
  return createHash("sha256").update(secret.trim()).digest("hex");
}

export function generatePublicQrCode(locationType: "ROOM" | "TABLE"): string {
  const prefix = locationType === "ROOM" ? "RM" : "TB";
  const token = randomBytes(9)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 12)
    .toUpperCase();
  return `QRL-${prefix}-${token}`;
}

export function generateOpaqueToken(prefix: "GAG" | "GSS"): string {
  return `${prefix}-${randomBytes(24).toString("base64url")}`;
}

export function maskGuestName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}

function generateServiceRequestNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SR-${datePart}-${timePart}-${rand}`;
}

// -----------------------------------------------------------------------------
// Staff QR Location Management
// -----------------------------------------------------------------------------

export interface EnsureQrLocationInput {
  businessId: string;
  branchId: string;
  locationType: "ROOM" | "TABLE";
  roomId?: string | null;
  tableId?: string | null;
  label?: string;
  rotate?: boolean;
  metadata?: Record<string, unknown> | null;
  actorId?: string;
}

export async function ensureQrLocation(
  input: EnsureQrLocationInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    let defaultLabel = "";
    let roomId: string | null = null;
    let tableId: string | null = null;

    if (input.locationType === "ROOM") {
      if (!input.roomId || input.tableId) {
        throw new HotelError(
          "roomId is required and tableId must be null for ROOM QR locations",
          400,
          "INVALID_QR_LOCATION_TARGET"
        );
      }
      const room = await tx.room.findFirst({
        where: { id: input.roomId, businessId: input.businessId },
      });
      if (!room) {
        throw new HotelError("Room not found", 404, "ROOM_NOT_FOUND");
      }
      roomId = room.id;
      defaultLabel = `Room ${room.roomNumber}`;
    } else if (input.locationType === "TABLE") {
      if (!input.tableId || input.roomId) {
        throw new HotelError(
          "tableId is required and roomId must be null for TABLE QR locations",
          400,
          "INVALID_QR_LOCATION_TARGET"
        );
      }
      const table = await tx.restaurantTable.findFirst({
        where: { id: input.tableId, businessId: input.businessId },
      });
      if (!table) {
        throw new HotelError("Table not found", 404, "TABLE_NOT_FOUND");
      }
      tableId = table.id;
      defaultLabel = `Table ${table.tableNumber}`;
    } else {
      throw new HotelError(
        "locationType must be ROOM or TABLE",
        400,
        "INVALID_LOCATION_TYPE"
      );
    }

    const existing = await tx.qrLocation.findFirst({
      where: {
        businessId: input.businessId,
        ...(roomId ? { roomId } : { tableId }),
      },
      include: {
        room: { include: { roomType: true, floor: true } },
        table: { include: { floor: true } },
      },
    });

    const resolvedLabel = input.label?.trim() || existing?.label || defaultLabel;

    if (existing && !input.rotate) {
      const updated = await tx.qrLocation.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          label: resolvedLabel,
          ...(input.metadata !== undefined
            ? {
                metadata:
                  input.metadata === null
                    ? Prisma.JsonNull
                    : (input.metadata as Prisma.InputJsonValue),
              }
            : {}),
        },
        include: {
          room: { include: { roomType: true, floor: true } },
          table: { include: { floor: true } },
        },
      });
      return updated;
    }

    const newPublicCode = generatePublicQrCode(input.locationType);
    const now = new Date();

    if (existing && input.rotate) {
      await tx.guestAccessGrant.updateMany({
        where: {
          businessId: input.businessId,
          qrLocationId: existing.id,
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokedReason: "QR_CODE_ROTATED",
          revokedById: input.actorId ?? null,
        },
      });

      await tx.guestSession.updateMany({
        where: {
          businessId: input.businessId,
          qrLocationId: existing.id,
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
        },
      });

      const rotated = await tx.qrLocation.update({
        where: { id: existing.id },
        data: {
          publicCode: newPublicCode,
          isActive: true,
          label: resolvedLabel,
          rotationCount: { increment: 1 },
          ...(input.metadata !== undefined
            ? {
                metadata:
                  input.metadata === null
                    ? Prisma.JsonNull
                    : (input.metadata as Prisma.InputJsonValue),
              }
            : {}),
        },
        include: {
          room: { include: { roomType: true, floor: true } },
          table: { include: { floor: true } },
        },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorId ?? null,
          action: "QR_LOCATION_ROTATED",
          entity: "QrLocation",
          entityId: rotated.id,
          oldValue: {
            publicCode: existing.publicCode,
            rotationCount: existing.rotationCount,
          },
          newValue: {
            publicCode: rotated.publicCode,
            rotationCount: rotated.rotationCount,
          },
        },
        tx
      );

      return rotated;
    }

    const created = await tx.qrLocation.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        publicCode: newPublicCode,
        locationType: input.locationType,
        roomId,
        tableId,
        label: resolvedLabel,
        isActive: true,
        rotationCount: 1,
        ...(input.metadata
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        createdById: input.actorId ?? null,
      },
      include: {
        room: { include: { roomType: true, floor: true } },
        table: { include: { floor: true } },
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.actorId ?? null,
        action: "QR_LOCATION_CREATED",
        entity: "QrLocation",
        entityId: created.id,
        newValue: {
          id: created.id,
          publicCode: created.publicCode,
          locationType: created.locationType,
          roomId: created.roomId,
          tableId: created.tableId,
          label: created.label,
        },
      },
      tx
    );

    return created;
  });
}

export interface GetQrLocationsInput {
  businessId: string;
  branchId?: string | null;
  locationType?: string | null;
  isActive?: boolean;
}

export async function getQrLocations(
  input: GetQrLocationsInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.qrLocation.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.locationType ? { locationType: input.locationType } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      room: { include: { roomType: true, floor: true } },
      table: { include: { floor: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// -----------------------------------------------------------------------------
// Public QR Resolution (Zero-Leakage Invariant)
// -----------------------------------------------------------------------------

export async function resolvePublicQrLocation(
  publicCode: string,
  prismaClient: PrismaClientLike = db
) {
  const code = (publicCode || "").trim();
  if (!code) {
    throw new HotelError("QR code is required", 400, "QR_CODE_REQUIRED");
  }

  const qrLocation = await prismaClient.qrLocation.findUnique({
    where: { publicCode: code },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          currency: true,
          taxConfig: true,
          settings: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          status: true,
          currentStayId: true,
          roomType: { select: { id: true, name: true, code: true } },
          floor: { select: { id: true, name: true } },
        },
      },
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true,
          status: true,
          currentSessionId: true,
          floor: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!qrLocation || !qrLocation.isActive) {
    throw new HotelError(
      "QR code not found or inactive",
      404,
      "QR_NOT_FOUND"
    );
  }

  const menus = await prismaClient.menu.findMany({
    where: {
      businessId: qrLocation.businessId,
      isActive: true,
      OR: [{ branchId: qrLocation.branchId }, { branchId: null }],
    },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: { displayOrder: "asc" },
            include: {
              modifierGroups: {
                orderBy: { displayOrder: "asc" },
                include: {
                  modifierGroup: {
                    include: {
                      options: {
                        where: { isAvailable: true },
                        orderBy: { displayOrder: "asc" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  const businessSettings =
    qrLocation.business.settings &&
    typeof qrLocation.business.settings === "object"
      ? (qrLocation.business.settings as Record<string, unknown>)
      : null;
  const locationMetadata =
    qrLocation.metadata && typeof qrLocation.metadata === "object"
      ? (qrLocation.metadata as Record<string, unknown>)
      : null;

  const googleReviewUrl =
    (typeof businessSettings?.googleReviewUrl === "string"
      ? businessSettings.googleReviewUrl
      : null) ||
    (typeof locationMetadata?.googleReviewUrl === "string"
      ? locationMetadata.googleReviewUrl
      : null) ||
    null;

  // CRITICAL PRIVACY INVARIANT: Never expose guestName, guestPhone, guestEmail,
  // stayId, folio, balance, entries, or prior orders in public QR resolution.
  return {
    qrLocation: {
      id: qrLocation.id,
      publicCode: qrLocation.publicCode,
      locationType: qrLocation.locationType,
      label: qrLocation.label,
      business: {
        id: qrLocation.business.id,
        name: qrLocation.business.name,
        currency: qrLocation.business.currency,
        googleReviewUrl,
      },
      branch: qrLocation.branch,
      room: qrLocation.room
        ? {
            id: qrLocation.room.id,
            roomNumber: qrLocation.room.roomNumber,
            roomTypeName: qrLocation.room.roomType?.name ?? null,
            floorName: qrLocation.room.floor?.name ?? null,
            hasActiveStay: Boolean(qrLocation.room.currentStayId),
          }
        : null,
      table: qrLocation.table
        ? {
            id: qrLocation.table.id,
            tableNumber: qrLocation.table.tableNumber,
            capacity: qrLocation.table.capacity,
            floorName: qrLocation.table.floor?.name ?? null,
            hasActiveSession: Boolean(qrLocation.table.currentSessionId),
          }
        : null,
      requiresVerification: qrLocation.locationType === "ROOM",
    },
    menus,
  };
}

// -----------------------------------------------------------------------------
// Guest Verification & Session Enrollment
// -----------------------------------------------------------------------------

export interface VerifyAndCreateGuestSessionInput {
  publicCode: string;
  guestLastName?: string | null;
  guestPhoneLast4?: string | null;
  verificationCode?: string | null;
  deviceFingerprint?: string | null;
  now?: Date;
}

export async function verifyAndCreateGuestSession(
  input: VerifyAndCreateGuestSessionInput,
  prismaClient: PrismaClientLike = db
) {
  const now = input.now ?? new Date();
  const code = (input.publicCode || "").trim();
  if (!code) {
    throw new HotelError("QR code is required", 400, "QR_CODE_REQUIRED");
  }

  return await withHotelTransaction(prismaClient, async (tx) => {
    const qrLocation = await tx.qrLocation.findUnique({
      where: { publicCode: code },
      include: {
        room: true,
        table: true,
      },
    });

    if (!qrLocation || !qrLocation.isActive) {
      throw new HotelError(
        "QR code not found or inactive",
        404,
        "QR_NOT_FOUND"
      );
    }

    const rawGrantToken = generateOpaqueToken("GAG");
    const rawSessionToken = generateOpaqueToken("GSS");

    if (qrLocation.locationType === "ROOM") {
      if (!qrLocation.roomId || !qrLocation.room?.currentStayId) {
        throw new HotelError(
          "No active stay found for this room",
          403,
          "NO_ACTIVE_STAY"
        );
      }

      const stay = await tx.stay.findFirst({
        where: {
          id: qrLocation.room.currentStayId,
          businessId: qrLocation.businessId,
          roomId: qrLocation.roomId,
          status: { in: ["ACTIVE", "EXTENDED", "TRANSFERRED"] },
        },
      });

      if (!stay || stay.checkOutTime !== null) {
        throw new HotelError(
          "No active stay found for this room",
          403,
          "NO_ACTIVE_STAY"
        );
      }

      const providedName = (
        input.guestLastName ||
        input.verificationCode ||
        ""
      )
        .trim()
        .toLowerCase();
      const providedPhone = (input.guestPhoneLast4 || "")
        .trim()
        .replace(/\D/g, "");

      const hasNameInput = providedName.length >= 2;
      const hasPhoneInput = providedPhone.length >= 4;

      if (!hasNameInput && !hasPhoneInput) {
        throw new HotelError(
          "Guest last name or phone verification is required",
          400,
          "VERIFICATION_REQUIRED"
        );
      }

      if (hasNameInput) {
        const normalizedStayName = stay.guestName.trim().toLowerCase();
        const nameTokens = normalizedStayName.split(/\s+/).filter(Boolean);
        const nameMatches =
          normalizedStayName === providedName ||
          nameTokens.some((token) => token === providedName);

        if (!nameMatches) {
          throw new HotelError(
            "Guest verification failed",
            403,
            "GUEST_VERIFICATION_FAILED"
          );
        }
      }

      if (hasPhoneInput) {
        const stayPhoneDigits = (stay.guestPhone || "").replace(/\D/g, "");
        if (!stayPhoneDigits || !stayPhoneDigits.endsWith(providedPhone)) {
          throw new HotelError(
            "Guest verification failed",
            403,
            "GUEST_VERIFICATION_FAILED"
          );
        }
      }

      const expiresAt =
        stay.expectedCheckOut.getTime() > now.getTime()
          ? stay.expectedCheckOut
          : new Date(now.getTime() + 24 * 3600_000);

      const grant = await tx.guestAccessGrant.create({
        data: {
          businessId: qrLocation.businessId,
          branchId: qrLocation.branchId,
          qrLocationId: qrLocation.id,
          grantType: "STAY_VERIFIED",
          stayId: stay.id,
          grantCodeHash: hashGuestSecret(rawGrantToken),
          scopes: [...GUEST_ROOM_SCOPES],
          guestDisplayName: maskGuestName(stay.guestName),
          status: "ACTIVE",
          expiresAt,
        },
      });

      const session = await tx.guestSession.create({
        data: {
          businessId: qrLocation.businessId,
          branchId: qrLocation.branchId,
          qrLocationId: qrLocation.id,
          grantId: grant.id,
          stayId: stay.id,
          sessionTokenHash: hashGuestSecret(rawSessionToken),
          deviceFingerprint: input.deviceFingerprint ?? null,
          status: "ACTIVE",
          expiresAt: grant.expiresAt,
          lastActiveAt: now,
        },
      });

      await createAuditEvent(
        {
          businessId: qrLocation.businessId,
          branchId: qrLocation.branchId,
          action: "GUEST_SESSION_VERIFIED",
          entity: "GuestSession",
          entityId: session.id,
          metadata: {
            qrLocationId: qrLocation.id,
            roomId: qrLocation.roomId,
            roomNumber: qrLocation.room.roomNumber,
            stayId: stay.id,
            grantId: grant.id,
          },
        },
        tx
      );

      return {
        sessionToken: rawSessionToken,
        grantToken: rawGrantToken,
        session: {
          id: session.id,
          locationType: "ROOM" as const,
          roomNumber: qrLocation.room.roomNumber,
          guestDisplayName: grant.guestDisplayName,
          scopes: [...GUEST_ROOM_SCOPES],
          expiresAt: session.expiresAt,
          stayId: stay.id,
        },
      };
    }

    if (qrLocation.locationType === "TABLE") {
      if (!qrLocation.tableId || !qrLocation.table) {
        throw new HotelError(
          "Table not found for this QR code",
          404,
          "TABLE_NOT_FOUND"
        );
      }

      let tableSession = await tx.tableSession.findFirst({
        where: {
          businessId: qrLocation.businessId,
          tableId: qrLocation.tableId,
          status: { in: ["ACTIVE", "BILLED"] },
        },
        orderBy: { openedAt: "desc" },
      });

      if (!tableSession) {
        if (qrLocation.table.status === "AVAILABLE") {
          const opened = await openTableSession(
            {
              businessId: qrLocation.businessId,
              branchId: qrLocation.branchId,
              tableId: qrLocation.tableId,
              guestCount: 1,
              notes: "Opened via Table QR",
            },
            tx
          );
          tableSession = opened.session;
        } else {
          throw new HotelError(
            `Table ${qrLocation.table.tableNumber} is currently ${qrLocation.table.status} with no active dining session`,
            409,
            "TABLE_UNAVAILABLE"
          );
        }
      }

      const expiresAt = new Date(now.getTime() + 6 * 3600_000);

      const grant = await tx.guestAccessGrant.create({
        data: {
          businessId: qrLocation.businessId,
          branchId: qrLocation.branchId,
          qrLocationId: qrLocation.id,
          grantType: "TABLE_OPEN",
          tableSessionId: tableSession.id,
          grantCodeHash: hashGuestSecret(rawGrantToken),
          scopes: [...GUEST_TABLE_SCOPES],
          guestDisplayName: `Table ${qrLocation.table.tableNumber} Guest`,
          status: "ACTIVE",
          expiresAt,
        },
      });

      const session = await tx.guestSession.create({
        data: {
          businessId: qrLocation.businessId,
          branchId: qrLocation.branchId,
          qrLocationId: qrLocation.id,
          grantId: grant.id,
          tableSessionId: tableSession.id,
          sessionTokenHash: hashGuestSecret(rawSessionToken),
          deviceFingerprint: input.deviceFingerprint ?? null,
          status: "ACTIVE",
          expiresAt: grant.expiresAt,
          lastActiveAt: now,
        },
      });

      await createAuditEvent(
        {
          businessId: qrLocation.businessId,
          branchId: qrLocation.branchId,
          action: "GUEST_TABLE_SESSION_ENROLLED",
          entity: "GuestSession",
          entityId: session.id,
          metadata: {
            qrLocationId: qrLocation.id,
            tableId: qrLocation.tableId,
            tableNumber: qrLocation.table.tableNumber,
            tableSessionId: tableSession.id,
            grantId: grant.id,
          },
        },
        tx
      );

      return {
        sessionToken: rawSessionToken,
        grantToken: rawGrantToken,
        session: {
          id: session.id,
          locationType: "TABLE" as const,
          tableNumber: qrLocation.table.tableNumber,
          guestDisplayName: grant.guestDisplayName,
          scopes: [...GUEST_TABLE_SCOPES],
          expiresAt: session.expiresAt,
          tableSessionId: tableSession.id,
        },
      };
    }

    throw new HotelError(
      "Unsupported QR location type",
      400,
      "UNSUPPORTED_QR_LOCATION_TYPE"
    );
  });
}

// -----------------------------------------------------------------------------
// Live Session Validation
// -----------------------------------------------------------------------------

export async function validateGuestSessionToken(
  sessionToken: string,
  requiredScope?: string,
  prismaClient: PrismaClientLike = db,
  now = new Date()
) {
  if (!sessionToken || !sessionToken.trim()) {
    throw new HotelError(
      "Guest session token required",
      401,
      "GUEST_UNAUTHORIZED"
    );
  }

  const tokenHash = hashGuestSecret(sessionToken);

  const session = await prismaClient.guestSession.findUnique({
    where: { sessionTokenHash: tokenHash },
    include: {
      grant: true,
      qrLocation: {
        include: {
          room: true,
          table: true,
        },
      },
      stay: true,
      tableSession: true,
    },
  });

  if (!session) {
    throw new HotelError(
      "Invalid guest session",
      401,
      "GUEST_SESSION_INVALID"
    );
  }

  // 1. Validate session active & not expired
  if (
    session.status !== "ACTIVE" ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now.getTime()
  ) {
    throw new HotelError(
      "Guest session has expired or been revoked",
      401,
      "GUEST_SESSION_REVOKED"
    );
  }

  // 2. Validate grant active & not expired
  if (
    session.grant.status !== "ACTIVE" ||
    session.grant.revokedAt !== null ||
    session.grant.expiresAt.getTime() <= now.getTime()
  ) {
    throw new HotelError(
      "Guest access grant has expired or been revoked",
      401,
      "GUEST_GRANT_REVOKED"
    );
  }

  // 3. Validate QR location active
  if (!session.qrLocation.isActive) {
    throw new HotelError(
      "QR location is no longer active",
      401,
      "QR_LOCATION_INACTIVE"
    );
  }

  // 4. If bound to a hotel Stay, verify stay is still active and room matches
  if (session.stayId) {
    if (
      !session.stay ||
      !["ACTIVE", "EXTENDED", "TRANSFERRED"].includes(session.stay.status) ||
      session.stay.checkOutTime !== null ||
      session.qrLocation.roomId !== session.stay.roomId
    ) {
      throw new HotelError(
        "Stay has ended; guest access revoked",
        401,
        "GUEST_STAY_ENDED"
      );
    }
  }

  // 5. If bound to a restaurant TableSession, verify tableSession is still active/billed
  if (session.tableSessionId) {
    if (
      !session.tableSession ||
      !["ACTIVE", "BILLED"].includes(session.tableSession.status)
    ) {
      throw new HotelError(
        "Table session has ended",
        401,
        "GUEST_TABLE_SESSION_ENDED"
      );
    }
  }

  // 6. Verify required scope
  if (requiredScope) {
    const scopes = Array.isArray(session.grant.scopes)
      ? (session.grant.scopes as string[])
      : [];
    if (!scopes.includes(requiredScope)) {
      throw new HotelError(
        "Insufficient guest session scope",
        403,
        "GUEST_SCOPE_FORBIDDEN"
      );
    }
  }

  return {
    session,
    grant: session.grant,
    qrLocation: session.qrLocation,
    stay: session.stay,
    tableSession: session.tableSession,
  };
}

// -----------------------------------------------------------------------------
// Atomic Revocation & Lifecycle Helpers
// -----------------------------------------------------------------------------

export async function revokeGuestAccessForStay(
  input: {
    businessId: string;
    stayId: string;
    reason?: string;
    actorId?: string | null;
    now?: Date;
  },
  prismaClient: PrismaClientLike = db
) {
  const now = input.now ?? new Date();
  return await withHotelTransaction(prismaClient, async (tx) => {
    const grantsResult = await tx.guestAccessGrant.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedReason: input.reason ?? "STAY_CHECKED_OUT",
        revokedById: input.actorId ?? null,
      },
    });

    const sessionsResult = await tx.guestSession.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
      },
    });

    return {
      revokedGrantsCount: grantsResult.count,
      revokedSessionsCount: sessionsResult.count,
    };
  });
}

export async function revokeGuestAccessForTableSession(
  input: {
    businessId: string;
    tableSessionId: string;
    reason?: string;
    actorId?: string | null;
    now?: Date;
  },
  prismaClient: PrismaClientLike = db
) {
  const now = input.now ?? new Date();
  return await withHotelTransaction(prismaClient, async (tx) => {
    const grantsResult = await tx.guestAccessGrant.updateMany({
      where: {
        businessId: input.businessId,
        tableSessionId: input.tableSessionId,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedReason: input.reason ?? "TABLE_SESSION_CLOSED",
        revokedById: input.actorId ?? null,
      },
    });

    const sessionsResult = await tx.guestSession.updateMany({
      where: {
        businessId: input.businessId,
        tableSessionId: input.tableSessionId,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
      },
    });

    return {
      revokedGrantsCount: grantsResult.count,
      revokedSessionsCount: sessionsResult.count,
    };
  });
}

export async function rebindGuestAccessOnRoomTransfer(
  input: {
    businessId: string;
    branchId: string;
    stayId: string;
    sourceRoomId: string;
    targetRoomId: string;
    actorId?: string | null;
  },
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const targetQrLocation = await ensureQrLocation(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        locationType: "ROOM",
        roomId: input.targetRoomId,
        actorId: input.actorId ?? undefined,
      },
      tx
    );

    const grantsResult = await tx.guestAccessGrant.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: "ACTIVE",
      },
      data: {
        qrLocationId: targetQrLocation.id,
      },
    });

    const sessionsResult = await tx.guestSession.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: "ACTIVE",
      },
      data: {
        qrLocationId: targetQrLocation.id,
      },
    });

    const serviceRequestsResult = await tx.serviceRequest.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
      },
      data: {
        roomId: input.targetRoomId,
        qrLocationId: targetQrLocation.id,
      },
    });

    return {
      targetQrLocationId: targetQrLocation.id,
      reboundGrantsCount: grantsResult.count,
      reboundSessionsCount: sessionsResult.count,
      reboundServiceRequestsCount: serviceRequestsResult.count,
    };
  });
}

export async function extendGuestAccessForStay(
  input: {
    businessId: string;
    stayId: string;
    newExpectedCheckOut: Date;
  },
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const grantsResult = await tx.guestAccessGrant.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: "ACTIVE",
      },
      data: {
        expiresAt: input.newExpectedCheckOut,
      },
    });

    const sessionsResult = await tx.guestSession.updateMany({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        status: "ACTIVE",
      },
      data: {
        expiresAt: input.newExpectedCheckOut,
      },
    });

    return {
      extendedGrantsCount: grantsResult.count,
      extendedSessionsCount: sessionsResult.count,
    };
  });
}

// -----------------------------------------------------------------------------
// Guest Portal Capabilities (Folio/Bill View, Ordering, Order Tracking)
// -----------------------------------------------------------------------------

export async function getGuestPortalFolioSummary(
  sessionToken: string,
  prismaClient: PrismaClientLike = db
) {
  const { session, grant, qrLocation, stay } = await validateGuestSessionToken(
    sessionToken,
    "BILL_VIEW",
    prismaClient
  );

  if (!stay) {
    throw new HotelError(
      "Bill view is only available for verified hotel room stays",
      403,
      "STAY_REQUIRED_FOR_BILL_VIEW"
    );
  }

  const folios = await prismaClient.guestFolio.findMany({
    where: {
      businessId: stay.businessId,
      stayId: stay.id,
      status: { not: "VOID" },
      windowName: { in: ["PRIMARY", "PERSONAL", "INCIDENTALS"] },
    },
    include: {
      entries: {
        orderBy: { postedAt: "asc" },
      },
      settlements: {
        orderBy: { allocatedAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let totalCharges = money(0);
  let totalCredits = money(0);
  let totalPayments = money(0);
  let totalBalance = money(0);

  for (const folio of folios) {
    totalCharges = addMoney(totalCharges, money(folio.chargesTotal));
    totalCredits = addMoney(totalCredits, money(folio.creditsTotal));
    totalPayments = addMoney(totalPayments, money(folio.paymentsTotal));
    totalBalance = addMoney(totalBalance, money(folio.balance));
  }

  const serviceRequests = await prismaClient.serviceRequest.findMany({
    where: {
      businessId: stay.businessId,
      stayId: stay.id,
    },
    orderBy: { requestedAt: "desc" },
  });

  return {
    stayNumber: stay.stayNumber,
    roomNumber: qrLocation.room?.roomNumber ?? null,
    guestDisplayName: grant.guestDisplayName ?? maskGuestName(stay.guestName),
    checkInTime: stay.checkInTime,
    expectedCheckOut: stay.expectedCheckOut,
    folios: folios.map((f) => ({
      id: f.id,
      folioNumber: f.folioNumber,
      windowName: f.windowName,
      status: f.status,
      chargesTotal: f.chargesTotal,
      creditsTotal: f.creditsTotal,
      paymentsTotal: f.paymentsTotal,
      balance: f.balance,
      entries: f.entries.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        sourceType: e.sourceType,
        postingKind: e.postingKind,
        category: e.category,
        description: e.description,
        amount: e.amount,
        taxAmount: e.taxAmount,
        totalAmount: e.totalAmount,
        direction: e.direction,
        postedAt: e.postedAt,
      })),
      settlements: f.settlements.map((s) => ({
        id: s.id,
        paymentMethod: s.paymentMethod,
        amount: s.amount,
        status: s.status,
        allocatedAt: s.allocatedAt,
      })),
    })),
    totalCharges,
    totalCredits,
    totalPayments,
    totalBalance,
    serviceRequests,
  };
}

export interface SubmitGuestOrderInput {
  sessionToken?: string;
  publicCode?: string;
  items: {
    menuItemId: string;
    quantity: number;
    selectedOptionIds?: string[];
    notes?: string;
  }[];
  notes?: string;
}

export async function submitGuestOrder(
  arg1: SubmitGuestOrderInput | PrismaClientLike,
  arg2: PrismaClientLike | SubmitGuestOrderInput = db
) {
  const isDbFirst =
    arg1 &&
    typeof arg1 === "object" &&
    !("items" in arg1) &&
    !("sessionToken" in arg1) &&
    !("publicCode" in arg1);
  const input = (isDbFirst ? arg2 : arg1) as SubmitGuestOrderInput;
  const prismaClient = (isDbFirst ? arg1 : arg2 || db) as PrismaClientLike;

  if (!input.sessionToken && input.publicCode) {
    const loc = await prismaClient.qrLocation.findUnique({
      where: { publicCode: input.publicCode.trim() },
    });
    if (loc) {
      await assertFeatureEnabled(prismaClient, {
        businessId: loc.businessId,
        branchId: loc.branchId,
        feature: "guestQrEnabled",
      });
    }
  }

  const { session, qrLocation, stay } = await validateGuestSessionToken(
    input.sessionToken || "",
    "ORDER_INITIATE",
    prismaClient
  );

  await assertFeatureEnabled(prismaClient, {
    businessId: qrLocation.businessId,
    branchId: qrLocation.branchId,
    feature: "guestQrEnabled",
  });

  if (!input.items || input.items.length === 0) {
    throw new HotelError(
      "At least one item is required to place an order",
      400,
      "EMPTY_ORDER_ITEMS"
    );
  }

  return await withHotelTransaction(prismaClient, async (tx) => {
    const uniqueMenuItemIds = Array.from(
      new Set(input.items.map((i) => i.menuItemId))
    );

    const menuItems = await tx.menuItem.findMany({
      where: {
        businessId: session.businessId,
        id: { in: uniqueMenuItemIds },
        isAvailable: true,
      },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                options: {
                  where: { isAvailable: true },
                },
              },
            },
          },
        },
      },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const canonicalItems: OrderItemInput[] = [];

    for (const reqItem of input.items) {
      const menuItem = menuItemMap.get(reqItem.menuItemId);
      if (!menuItem) {
        throw new HotelError(
          `Menu item is unavailable or does not exist`,
          400,
          "MENU_ITEM_UNAVAILABLE"
        );
      }

      const qty = Math.max(1, Math.floor(reqItem.quantity || 1));
      const selectedIds = new Set(reqItem.selectedOptionIds || []);
      const appliedModifiers: AppliedModifierInput[] = [];

      for (const link of menuItem.modifierGroups) {
        const group = link.modifierGroup;
        if (!group.isActive) continue;
        for (const opt of group.options) {
          if (selectedIds.has(opt.id)) {
            appliedModifiers.push({
              modifierGroupId: group.id,
              groupName: group.displayName || group.name,
              optionId: opt.id,
              optionName: opt.name,
              priceDelta: opt.priceDelta,
            });
          }
        }
      }

      canonicalItems.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        basePrice: menuItem.basePrice,
        quantity: qty,
        appliedModifiers,
        notes: reqItem.notes,
      });
    }

    const originPrefix = stay
      ? `[Room ${qrLocation.room?.roomNumber ?? ""} Guest QR]`
      : `[Table ${qrLocation.table?.tableNumber ?? ""} Guest QR]`;

    const orderNotes = input.notes?.trim()
      ? `${originPrefix} ${input.notes.trim()}`
      : originPrefix;

    const result = await createOrAppendOrder(
      {
        businessId: session.businessId,
        branchId: session.branchId,
        tableSessionId: session.tableSessionId ?? null,
        tableId: qrLocation.tableId ?? null,
        orderType: "DINE_IN",
        items: canonicalItems,
        notes: orderNotes,
      },
      tx
    );

    await createAuditEvent(
      {
        businessId: session.businessId,
        branchId: session.branchId,
        action: "GUEST_QR_ORDER_INITIATED",
        entity: "RestaurantOrder",
        entityId: result.order.id,
        metadata: {
          guestSessionId: session.id,
          stayId: session.stayId,
          tableSessionId: session.tableSessionId,
          qrLocationId: session.qrLocationId,
          roundId: result.round.id,
        },
      },
      tx
    );

    return result;
  });
}

export const submitGuestSelfOrder = submitGuestOrder;

export type GuestOrderTrackerStage =
  | "ORDER_RECEIVED"
  | "COOKING"
  | "ON_ITS_WAY"
  | "SERVED"
  | "REJECTED";

function computeGuestOrderTrackerStage(order: {
  acceptanceStatus: string;
  fulfillmentStatus: string;
  orderLines?: {
    acceptanceStatus: string;
    fulfillmentStatus: string;
  }[];
  kitchenTickets?: {
    status: string;
    lines?: { status: string }[];
  }[];
}): GuestOrderTrackerStage {
  if (
    order.acceptanceStatus === "REJECTED" ||
    order.fulfillmentStatus === "CANCELLED"
  ) {
    return "REJECTED";
  }

  const lines = order.orderLines ?? [];
  const activeLines = lines.filter(
    (l) =>
      l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
  );

  if (lines.length > 0 && activeLines.length === 0) {
    return "REJECTED";
  }

  if (
    activeLines.length > 0 &&
    activeLines.every((l) => l.fulfillmentStatus === "SERVED")
  ) {
    return "SERVED";
  }

  if (order.fulfillmentStatus === "SERVED") {
    return "SERVED";
  }

  const tickets = order.kitchenTickets ?? [];
  const ticketLineStatuses = tickets.flatMap((t) =>
    (t.lines ?? []).map((tl) => tl.status)
  );

  if (
    order.fulfillmentStatus === "READY" ||
    activeLines.some((l) => l.fulfillmentStatus === "READY") ||
    tickets.some((t) => t.status === "READY") ||
    ticketLineStatuses.includes("READY")
  ) {
    return "ON_ITS_WAY";
  }

  if (
    order.acceptanceStatus === "ACCEPTED" ||
    order.fulfillmentStatus === "PREPARING" ||
    activeLines.some(
      (l) =>
        l.acceptanceStatus === "ACCEPTED" || l.fulfillmentStatus === "PREPARING"
    ) ||
    tickets.some((t) => t.status === "PREPARING" || t.status === "QUEUED")
  ) {
    return "COOKING";
  }

  return "ORDER_RECEIVED";
}

export async function getGuestOrdersAndTracking(
  sessionToken: string,
  prismaClient: PrismaClientLike = db
) {
  const { session } = await validateGuestSessionToken(
    sessionToken,
    "MENU_BROWSE",
    prismaClient
  );

  let rawOrders: Prisma.RestaurantOrderGetPayload<{
    include: {
      rounds: { include: { lines: true } };
      orderLines: true;
      kitchenTickets: { include: { lines: true } };
    };
  }>[] = [];

  if (session.tableSessionId) {
    rawOrders = await prismaClient.restaurantOrder.findMany({
      where: {
        businessId: session.businessId,
        tableSessionId: session.tableSessionId,
      },
      include: {
        rounds: {
          include: { lines: true },
          orderBy: { roundNumber: "asc" },
        },
        orderLines: {
          orderBy: { createdAt: "asc" },
        },
        kitchenTickets: {
          include: { lines: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (session.stayId) {
    const [auditEvents, folioEntries] = await Promise.all([
      prismaClient.auditEvent.findMany({
        where: {
          businessId: session.businessId,
          action: "GUEST_QR_ORDER_INITIATED",
          entity: "RestaurantOrder",
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prismaClient.folioEntry.findMany({
        where: {
          businessId: session.businessId,
          stayId: session.stayId,
          sourceType: "RESTAURANT_ORDER",
        },
        select: { sourceId: true },
      }),
    ]);

    const orderIdSet = new Set<string>();
    for (const fe of folioEntries) {
      if (fe.sourceId) orderIdSet.add(fe.sourceId);
    }
    for (const ae of auditEvents) {
      const meta =
        ae.metadata && typeof ae.metadata === "object"
          ? (ae.metadata as Record<string, unknown>)
          : null;
      if (meta?.stayId === session.stayId && ae.entityId) {
        orderIdSet.add(ae.entityId);
      }
    }

    const orderIds = Array.from(orderIdSet);
    if (orderIds.length > 0) {
      rawOrders = await prismaClient.restaurantOrder.findMany({
        where: {
          businessId: session.businessId,
          id: { in: orderIds },
        },
        include: {
          rounds: {
            include: { lines: true },
            orderBy: { roundNumber: "asc" },
          },
          orderLines: {
            orderBy: { createdAt: "asc" },
          },
          kitchenTickets: {
            include: { lines: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  const orders = rawOrders.map((order) => {
    const stage = computeGuestOrderTrackerStage(order);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      acceptanceStatus: order.acceptanceStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      settlementStatus: order.settlementStatus,
      trackerStage: stage,
      liveStage: stage,
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      rounds: order.rounds.map((r) => ({
        id: r.id,
        roundNumber: r.roundNumber,
        status: r.status,
        submittedAt: r.submittedAt,
        lines: r.lines.map((l) => ({
          id: l.id,
          itemName: l.itemName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
          appliedModifiers: l.appliedModifiers,
          notes: l.notes,
          acceptanceStatus: l.acceptanceStatus,
          fulfillmentStatus: l.fulfillmentStatus,
        })),
      })),
    };
  });

  return { orders };
}

// -----------------------------------------------------------------------------
// Service Requests & Waiter Call Rate Limiting (1 call per 3 minutes / location)
// -----------------------------------------------------------------------------

export type GuestServiceRequestType =
  | "WAITER_CALL"
  | "WATER_REFILL"
  | "BILL_REQUEST"
  | "EXTRA_TOWELS"
  | "HOUSEKEEPING"
  | "ROOM_AMENITIES"
  | "CHECKOUT_REQUEST"
  | "OTHER";

export interface CreateGuestServiceRequestInput {
  sessionToken?: string | null;
  publicCode?: string | null;
  requestType: GuestServiceRequestType;
  notes?: string | null;
  priority?: "NORMAL" | "HIGH" | "URGENT";
  idempotencyKey?: string | null;
  now?: Date;
}

function resolveServiceRequestCategory(
  requestType: GuestServiceRequestType,
  locationType: string
): "HOUSEKEEPING" | "FRONT_DESK" | "RESTAURANT" | "CONCIERGE" {
  switch (requestType) {
    case "EXTRA_TOWELS":
    case "HOUSEKEEPING":
    case "ROOM_AMENITIES":
      return "HOUSEKEEPING";
    case "CHECKOUT_REQUEST":
      return "FRONT_DESK";
    case "WAITER_CALL":
    case "WATER_REFILL":
    case "BILL_REQUEST":
      return "RESTAURANT";
    case "OTHER":
    default:
      return locationType === "ROOM" ? "CONCIERGE" : "RESTAURANT";
  }
}

export async function createGuestServiceRequest(
  arg1: CreateGuestServiceRequestInput | PrismaClientLike,
  arg2: PrismaClientLike | CreateGuestServiceRequestInput = db
) {
  const isDbFirst =
    arg1 &&
    typeof arg1 === "object" &&
    !("requestType" in arg1) &&
    !("sessionToken" in arg1) &&
    !("publicCode" in arg1);
  const input = (isDbFirst ? arg2 : arg1) as CreateGuestServiceRequestInput;
  const prismaClient = (isDbFirst ? arg1 : arg2 || db) as PrismaClientLike;
  const now = input.now ?? new Date();

  return await withHotelTransaction(prismaClient, async (tx) => {
    let qrLocation: Prisma.QrLocationGetPayload<{
      include: { room: true; table: true };
    }> | null = null;
    let grantId: string | null = null;
    let guestSessionId: string | null = null;
    let stayId: string | null = null;
    let tableSessionId: string | null = null;

    if (input.sessionToken && input.sessionToken.trim()) {
      const requiredScope =
        input.requestType === "CHECKOUT_REQUEST"
          ? "CHECKOUT_REQUEST"
          : "SERVICE_REQUEST";
      const validated = await validateGuestSessionToken(
        input.sessionToken,
        requiredScope,
        tx,
        now
      );
      qrLocation = validated.qrLocation;
      grantId = validated.grant.id;
      guestSessionId = validated.session.id;
      stayId = validated.session.stayId ?? null;
      tableSessionId = validated.session.tableSessionId ?? null;

      await assertFeatureEnabled(tx, {
        businessId: qrLocation.businessId,
        branchId: qrLocation.branchId,
        feature: "guestQrEnabled",
      });

      if (input.requestType === "CHECKOUT_REQUEST" && !stayId) {
        throw new HotelError(
          "Checkout request requires an active hotel room stay",
          403,
          "STAY_REQUIRED_FOR_CHECKOUT_REQUEST"
        );
      }
    } else if (input.publicCode && input.publicCode.trim()) {
      const foundQr = await tx.qrLocation.findUnique({
        where: { publicCode: input.publicCode.trim() },
        include: { room: true, table: true },
      });
      if (!foundQr || !foundQr.isActive) {
        throw new HotelError(
          "QR code not found or inactive",
          404,
          "QR_NOT_FOUND"
        );
      }

      await assertFeatureEnabled(tx, {
        businessId: foundQr.businessId,
        branchId: foundQr.branchId,
        feature: "guestQrEnabled",
      });

      if (foundQr.locationType === "ROOM") {
        throw new HotelError(
          "Verified guest session is required for room service requests",
          401,
          "GUEST_UNAUTHORIZED"
        );
      }
      qrLocation = foundQr;
      tableSessionId = foundQr.table?.currentSessionId ?? null;
    } else {
      throw new HotelError(
        "Guest session token or QR code is required",
        401,
        "GUEST_UNAUTHORIZED"
      );
    }

    // Idempotency deduplication
    const idempKey = input.idempotencyKey?.trim() || null;
    if (idempKey) {
      const existingByIdemp = await tx.serviceRequest.findFirst({
        where: {
          businessId: qrLocation.businessId,
          qrLocationId: qrLocation.id,
          idempotencyKey: idempKey,
        },
      });
      if (existingByIdemp) {
        return {
          serviceRequest: existingByIdemp,
          deduplicated: true,
        };
      }
    }

    // Strict Rate Limiting: 1 call per 3 minutes per location
    const windowStart = new Date(now.getTime() - SERVICE_REQUEST_COOLDOWN_MS);
    const recentRequest = await tx.serviceRequest.findFirst({
      where: {
        businessId: qrLocation.businessId,
        qrLocationId: qrLocation.id,
        requestType: input.requestType,
        requestedAt: { gte: windowStart },
        status: { not: "CANCELLED" },
      },
      orderBy: { requestedAt: "desc" },
    });

    if (recentRequest) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (recentRequest.requestedAt.getTime() +
            SERVICE_REQUEST_COOLDOWN_MS -
            now.getTime()) /
            1000
        )
      );
      throw new HotelError(
        `Please wait ${retryAfterSeconds} seconds before sending another ${input.requestType} request for this location.`,
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    const category = resolveServiceRequestCategory(
      input.requestType,
      qrLocation.locationType
    );
    const priority =
      input.priority ??
      (input.requestType === "CHECKOUT_REQUEST" ? "HIGH" : "NORMAL");

    // Invariant: CHECKOUT_REQUEST creates a Front Desk ServiceRequest and NEVER silently checks out the Stay.
    const serviceRequest = await tx.serviceRequest.create({
      data: {
        businessId: qrLocation.businessId,
        branchId: qrLocation.branchId,
        qrLocationId: qrLocation.id,
        grantId,
        guestSessionId,
        stayId,
        tableSessionId,
        roomId: qrLocation.roomId ?? null,
        tableId: qrLocation.tableId ?? null,
        requestNumber: generateServiceRequestNumber(now),
        requestType: input.requestType,
        category,
        priority,
        status: "OPEN",
        notes: input.notes?.trim() || null,
        idempotencyKey: idempKey,
        requestedAt: now,
      },
      include: {
        room: { select: { id: true, roomNumber: true } },
        table: { select: { id: true, tableNumber: true } },
      },
    });

    await createAuditEvent(
      {
        businessId: qrLocation.businessId,
        branchId: qrLocation.branchId,
        action: "GUEST_SERVICE_REQUEST_CREATED",
        entity: "ServiceRequest",
        entityId: serviceRequest.id,
        newValue: {
          requestNumber: serviceRequest.requestNumber,
          requestType: serviceRequest.requestType,
          category: serviceRequest.category,
          priority: serviceRequest.priority,
          qrLocationId: qrLocation.id,
          stayId,
          tableSessionId,
        },
      },
      tx
    );

    return {
      serviceRequest,
      deduplicated: false,
    };
  });
}

// -----------------------------------------------------------------------------
// Staff Service Request Queue Management
// -----------------------------------------------------------------------------

export interface GetServiceRequestsInput {
  businessId: string;
  branchId?: string | null;
  status?: string | null;
  category?: string | null;
  locationType?: string | null;
}

export async function getServiceRequestsForStaff(
  input: GetServiceRequestsInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.serviceRequest.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.locationType
        ? { qrLocation: { locationType: input.locationType } }
        : {}),
    },
    include: {
      qrLocation: true,
      room: { include: { roomType: true, floor: true } },
      table: { include: { floor: true } },
      stay: {
        select: {
          id: true,
          stayNumber: true,
          guestName: true,
        },
      },
      acknowledgedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
}

export interface UpdateServiceRequestStatusInput {
  businessId: string;
  requestId: string;
  status: "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  resolutionNotes?: string | null;
  actorId?: string | null;
}

export async function updateServiceRequestStatus(
  input: UpdateServiceRequestStatusInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.serviceRequest.findFirst({
      where: {
        id: input.requestId,
        businessId: input.businessId,
      },
    });

    if (!existing) {
      throw new HotelError(
        "Service request not found",
        404,
        "SERVICE_REQUEST_NOT_FOUND"
      );
    }

    const now = new Date();
    const updateData: Prisma.ServiceRequestUncheckedUpdateInput = {
      status: input.status,
      version: { increment: 1 },
    };

    if (
      input.status === "ACKNOWLEDGED" ||
      input.status === "IN_PROGRESS"
    ) {
      if (!existing.acknowledgedAt) {
        updateData.acknowledgedAt = now;
        updateData.acknowledgedById = input.actorId ?? null;
      }
    }

    if (input.status === "COMPLETED" || input.status === "CANCELLED") {
      if (!existing.acknowledgedAt) {
        updateData.acknowledgedAt = now;
        updateData.acknowledgedById = input.actorId ?? null;
      }
      updateData.resolvedAt = now;
      updateData.resolvedById = input.actorId ?? null;
      if (input.resolutionNotes !== undefined) {
        updateData.resolutionNotes = input.resolutionNotes;
      }
    } else if (input.resolutionNotes !== undefined) {
      updateData.resolutionNotes = input.resolutionNotes;
    }

    const updated = await tx.serviceRequest.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        qrLocation: true,
        room: { include: { roomType: true, floor: true } },
        table: { include: { floor: true } },
        stay: {
          select: {
            id: true,
            stayNumber: true,
            guestName: true,
          },
        },
        acknowledgedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action: "SERVICE_REQUEST_STATUS_UPDATED",
        entity: "ServiceRequest",
        entityId: updated.id,
        entityVersion: updated.version,
        oldValue: { status: existing.status },
        newValue: {
          status: updated.status,
          resolutionNotes: updated.resolutionNotes,
        },
      },
      tx
    );

    return updated;
  });
}
