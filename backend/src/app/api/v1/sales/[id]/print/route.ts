import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const saleId = params.id;

    // Fetch sale
    const sale = await db.sale.findFirst({
      where: { id: saleId, businessId: context.businessId, deletedAt: null },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale invoice not found" }, { status: 404 });
    }

    const isFirstPrint = !sale.isPrinted;
    const now = new Date();

    const updatedSale = await db.sale.update({
      where: { id: saleId },
      data: {
        isPrinted: true,
        printCount: { increment: 1 },
        ...(isFirstPrint && {
          firstPrintedAt: now,
          firstPrintedById: context.userId,
        }),
        lastPrintedAt: now,
        lastPrintedById: context.userId,
      },
      include: {
        firstPrintedBy: { select: { name: true } },
        lastPrintedBy: { select: { name: true } },
      },
    });

    // Write Audit Log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        branchId: sale.branchId,
        action: isFirstPrint ? "PRINT_INVOICE" : "REPRINT_INVOICE",
        module: "SALE",
        details: isFirstPrint
          ? `Printed tax invoice ${sale.invoiceNumber} for the first time.`
          : `Reprinted invoice ${sale.invoiceNumber}. Total reprint count: ${updatedSale.printCount - 1}.`,
        newValue: {
          invoiceNumber: sale.invoiceNumber,
          printCount: updatedSale.printCount,
          isFirstPrint,
        },
        ipAddress,
        deviceInfo,
      },
    });

    return NextResponse.json({
      message: "Print tracked successfully",
      invoiceNumber: updatedSale.invoiceNumber,
      printCount: updatedSale.printCount,
      isPrinted: updatedSale.isPrinted,
      firstPrintedAt: updatedSale.firstPrintedAt,
      firstPrintedBy: updatedSale.firstPrintedBy?.name,
      lastPrintedAt: updatedSale.lastPrintedAt,
      lastPrintedBy: updatedSale.lastPrintedBy?.name,
      isReprint: !isFirstPrint,
    });
  } catch (error: any) {
    console.error("POST print error:", error);
    return NextResponse.json({ error: "Failed to record print action" }, { status: 500 });
  }
}
