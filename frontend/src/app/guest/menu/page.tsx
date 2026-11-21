import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LegacyGuestMenuRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const { tableId } = await searchParams;
  const trimmedTableId = tableId?.trim();

  if (trimmedTableId && /^[0-9a-f-]{36}$/i.test(trimmedTableId)) {
    const existingQr = await db.qrLocation.findFirst({
      where: { tableId: trimmedTableId, isActive: true },
      select: { publicCode: true },
    });

    const table = await db.restaurantTable.findFirst({
      where: { id: trimmedTableId, isActive: true },
      select: { id: true, businessId: true, branchId: true, tableNumber: true, status: true },
    });

    const isSettling =
      table?.status === "BILLED" ||
      (table
        ? Boolean(
            await db.tableSession.findFirst({
              where: {
                businessId: table.businessId,
                tableId: table.id,
                status: { in: ["ACTIVE", "BILLED"] },
              },
              select: { id: true },
            })
          )
        : false);

    const qs = isSettling ? "?settling=true" : "";

    if (existingQr?.publicCode) {
      redirect(`/guest/qr/${existingQr.publicCode}${qs}`);
    }

    if (table) {
      const publicCode = `QRL-TB-${randomBytes(4).toString("hex").toUpperCase()}`;
      const created = await db.qrLocation.upsert({
        where: {
          businessId_tableId: {
            businessId: table.businessId,
            tableId: table.id,
          },
        },
        update: { isActive: true },
        create: {
          businessId: table.businessId,
          branchId: table.branchId,
          tableId: table.id,
          publicCode,
          locationType: "TABLE",
          label: `Table ${table.tableNumber}`,
          isActive: true,
        },
        select: { publicCode: true },
      });
      redirect(`/guest/qr/${created.publicCode}${qs}`);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F3EC] flex items-center justify-center p-6 text-[#292320]">
      <div className="max-w-sm w-full rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-6 text-center space-y-2">
        <h1 className="text-base font-bold text-[#6B2837]">QR Code Not Found</h1>
        <p className="text-xs text-[#71675E]">
          This table QR code is invalid or no longer active. Please ask a staff member for assistance.
        </p>
      </div>
    </div>
  );
}
