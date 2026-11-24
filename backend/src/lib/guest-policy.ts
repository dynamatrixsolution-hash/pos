export type TableQrSecurityMode =
  | "STAFF_SEATED_OR_PIN"
  | "SELF_SEAT_WITH_GEOFENCE"
  | "OPEN_STAFF_APPROVAL";

export interface GuestQrPolicy {
  tableQrMode: TableQrSecurityMode;
  branchLat: number | null;
  branchLng: number | null;
  geofenceRadiusMeters: number;
  maxGuestOrderItems: number;
  /** Maximum order subtotal (in business currency) auto-sent to kitchen. 0 = all guest orders need staff approval. */
  maxAutoAcceptAmount: number;
  selfCancelGraceMinutes: number;
  takeawayEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  requireStaffApprovalForDelivery: boolean;
  cancellationPolicyText: string;
  refundPolicyText: string;
}

export const DEFAULT_GUEST_QR_POLICY: GuestQrPolicy = {
  tableQrMode: "STAFF_SEATED_OR_PIN",
  branchLat: null,
  branchLng: null,
  geofenceRadiusMeters: 150,
  maxGuestOrderItems: 15,
  maxAutoAcceptAmount: 1500,
  selfCancelGraceMinutes: 2,
  takeawayEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 0,
  requireStaffApprovalForDelivery: true,
  cancellationPolicyText:
    "Unpaid orders can be cancelled within 2 minutes before the kitchen starts preparing. Once preparation begins, please request staff assistance.",
  refundPolicyText:
    "Paid orders cannot be self-cancelled. Submit a refund request and our cashier or manager will verify and process your refund.",
};

function toFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function parseGuestQrPolicy(settings: unknown): GuestQrPolicy {
  const s =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};

  const rawMode = String(s.tableQrMode || "").trim().toUpperCase();
  const tableQrMode: TableQrSecurityMode =
    rawMode === "SELF_SEAT_WITH_GEOFENCE" ||
    rawMode === "OPEN_STAFF_APPROVAL" ||
    rawMode === "STAFF_SEATED_OR_PIN"
      ? rawMode
      : DEFAULT_GUEST_QR_POLICY.tableQrMode;

  const branchLat = toFiniteNumber(s.branchLat);
  const branchLng = toFiniteNumber(s.branchLng);
  const geofenceRadiusMeters = Math.max(
    30,
    Math.min(5000, toFiniteNumber(s.geofenceRadiusMeters) ?? DEFAULT_GUEST_QR_POLICY.geofenceRadiusMeters)
  );
  const maxGuestOrderItems = Math.max(
    1,
    Math.min(200, Math.floor(toFiniteNumber(s.maxGuestOrderItems) ?? DEFAULT_GUEST_QR_POLICY.maxGuestOrderItems))
  );
  const rawAutoAccept = toFiniteNumber(s.maxAutoAcceptAmount);
  const maxAutoAcceptAmount =
    rawAutoAccept !== null ? Math.max(0, rawAutoAccept) : DEFAULT_GUEST_QR_POLICY.maxAutoAcceptAmount;
  const rawGrace = toFiniteNumber(s.selfCancelGraceMinutes);
  const selfCancelGraceMinutes =
    rawGrace !== null ? Math.max(0, Math.min(30, Math.floor(rawGrace))) : DEFAULT_GUEST_QR_POLICY.selfCancelGraceMinutes;
  const rawDeliveryFee = toFiniteNumber(s.deliveryFee);
  const deliveryFee = rawDeliveryFee !== null ? Math.max(0, rawDeliveryFee) : DEFAULT_GUEST_QR_POLICY.deliveryFee;

  const cancellationPolicyText =
    typeof s.cancellationPolicyText === "string" && s.cancellationPolicyText.trim()
      ? s.cancellationPolicyText.trim()
      : selfCancelGraceMinutes > 0
      ? `Unpaid orders can be cancelled within ${selfCancelGraceMinutes} minute${selfCancelGraceMinutes === 1 ? "" : "s"} before the kitchen starts preparing. Once preparation begins, please request staff assistance.`
      : "Once submitted, please request staff assistance if you need to cancel or modify your order.";

  const refundPolicyText =
    typeof s.refundPolicyText === "string" && s.refundPolicyText.trim()
      ? s.refundPolicyText.trim()
      : DEFAULT_GUEST_QR_POLICY.refundPolicyText;

  return {
    tableQrMode,
    branchLat,
    branchLng,
    geofenceRadiusMeters,
    maxGuestOrderItems,
    maxAutoAcceptAmount,
    selfCancelGraceMinutes,
    takeawayEnabled: s.takeawayEnabled !== false,
    deliveryEnabled: s.deliveryEnabled !== false,
    deliveryFee,
    requireStaffApprovalForDelivery: s.requireStaffApprovalForDelivery !== false,
    cancellationPolicyText,
    refundPolicyText,
  };
}

/** Haversine distance in meters between two WGS84 coordinates. */
export function computeDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
