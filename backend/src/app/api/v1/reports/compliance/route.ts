import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get("reportType") || "MASTER_SALES";
  const branchId = searchParams.get("branchId") || undefined;
  const fiscalYearId = searchParams.get("fiscalYearId") || undefined;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  try {
    let startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (startDateStr) {
      const parsedStart = new Date(startDateStr);
      if (!isNaN(parsedStart.getTime())) {
        startDate = parsedStart;
        startDate.setHours(0, 0, 0, 0);
      }
    }

    if (endDateStr) {
      const parsedEnd = new Date(endDateStr);
      if (!isNaN(parsedEnd.getTime())) {
        endDate = parsedEnd;
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const dateRangeCommon = { gte: startDate, lte: endDate };

    // Standard filter base enforcing tenant isolation
    const baseWhere: any = {
      businessId: context.businessId,
    };

    if (branchId) baseWhere.branchId = branchId;
    if (fiscalYearId) baseWhere.fiscalYearId = fiscalYearId;

    if (reportType === "MASTER_SALES") {
      const sales = await db.sale.findMany({
        where: {
          ...baseWhere,
          createdAt: dateRangeCommon,
        },
        include: {
          customer: true,
          user: { select: { name: true } },
          fiscalYear: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(sales);
    } 
    
    if (reportType === "SALES_BOOK") {
      // Sales Book complies with Annex-6 of IRD Electronic Billing Procedure 2074
      const sales = await db.sale.findMany({
        where: {
          ...baseWhere,
          createdAt: dateRangeCommon,
          status: "COMPLETED",
        },
        include: {
          customer: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Map to exact Annex-6 fields
      const salesBook = sales.map((sale) => {
        const hasVat = sale.tax > 0;
        const totalLineAmount = sale.total;
        const lineTax = sale.tax;
        const lineDiscount = sale.discount;
        const taxableSalesAmount = hasVat ? (sale.subtotal - lineDiscount) : 0;
        const nonTaxableSalesAmount = !hasVat ? (sale.subtotal - lineDiscount) : 0;

        return {
          date: sale.createdAt.toISOString().split("T")[0],
          billNo: sale.invoiceNumber,
          buyerName: sale.customer?.name || "Walk-in Customer",
          buyerPan: sale.customer?.phone || "", // customer PAN or Phone details
          totalSales: totalLineAmount,
          nonTaxableSales: nonTaxableSalesAmount,
          exportSales: 0, // default placeholder
          discount: lineDiscount,
          taxableSales: taxableSalesAmount,
          vatTax: lineTax,
          isActive: sale.isActive,
        };
      });

      return NextResponse.json(salesBook);
    } 
    
    if (reportType === "CANCELLED") {
      const sales = await db.sale.findMany({
        where: {
          ...baseWhere,
          isActive: false,
          createdAt: dateRangeCommon,
        },
        include: {
          customer: true,
          cancelledBy: { select: { name: true } },
        },
        orderBy: { cancelledAt: "desc" },
      });
      return NextResponse.json(sales);
    } 
    
    if (reportType === "REPRINTS") {
      const sales = await db.sale.findMany({
        where: {
          ...baseWhere,
          printCount: { gt: 1 },
          createdAt: dateRangeCommon,
        },
        include: {
          lastPrintedBy: { select: { name: true } },
        },
        orderBy: { lastPrintedAt: "desc" },
      });
      return NextResponse.json(sales);
    } 
    
    if (reportType === "CREDIT_NOTES") {
      const notes = await db.creditNote.findMany({
        where: {
          ...baseWhere,
          createdAt: dateRangeCommon,
        },
        include: {
          sale: { select: { invoiceNumber: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(notes);
    } 
    
    if (reportType === "DEBIT_NOTES") {
      const notes = await db.debitNote.findMany({
        where: {
          ...baseWhere,
          createdAt: dateRangeCommon,
        },
        include: {
          sale: { select: { invoiceNumber: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(notes);
    } 
    
    if (reportType === "CBMS_STATUS") {
      const queues = await db.cbmsSyncQueue.findMany({
        where: {
          businessId: context.businessId,
          createdAt: dateRangeCommon,
        },
        include: {
          sale: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(queues);
    } 
    
    if (reportType === "AUDIT_TRAIL") {
      const logs = await db.auditLog.findMany({
        where: {
          businessId: context.businessId,
          createdAt: dateRangeCommon,
        },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(logs);
    }

    return NextResponse.json({ error: "Invalid reportType parameter" }, { status: 400 });
  } catch (error: any) {
    console.error("GET compliance report error:", error);
    return NextResponse.json({ error: "Failed to compile compliance report" }, { status: 500 });
  }
}
