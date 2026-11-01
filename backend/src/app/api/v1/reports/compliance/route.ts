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
  const format = searchParams.get("format") || "json"; // json, xml, excel, pdf

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

    const baseWhere: any = {
      businessId: context.businessId,
    };

    if (branchId) baseWhere.branchId = branchId;
    if (fiscalYearId) baseWhere.fiscalYearId = fiscalYearId;

    let rawData: any[] = [];
    let title = "Compliance Report";

    if (reportType === "MASTER_SALES") {
      title = "Master Sales Report (Annex-5)";
      const sales = await db.sale.findMany({
        where: { ...baseWhere, createdAt: dateRangeCommon },
        include: {
          customer: true,
          user: { select: { name: true } },
          fiscalYear: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      rawData = sales.map((s) => ({
        invoiceNumber: s.invoiceNumber,
        date: s.createdAt.toISOString().split("T")[0],
        customerName: s.customer?.name || "Walk-in Customer",
        customerPan: s.customer?.phone || "N/A",
        subtotal: s.subtotal,
        discount: s.discount,
        vat: s.tax,
        total: s.total,
        isPrinted: s.isPrinted ? "YES" : "NO",
        isActive: s.isActive ? "ACTIVE" : "CANCELLED",
        syncStatus: s.syncWithIrd,
        refundAmount: s.vatRefundAmount,
        enteredBy: s.user?.name || "System",
      }));
    } else if (reportType === "SALES_BOOK") {
      title = "Sales Book Register (Annex-6)";
      const sales = await db.sale.findMany({
        where: { ...baseWhere, createdAt: dateRangeCommon, status: "COMPLETED" },
        include: { customer: true },
        orderBy: { createdAt: "asc" },
      });

      rawData = sales.map((sale) => {
        const hasVat = Number(sale.tax) > 0;
        const totalLineAmount = sale.total;
        const lineTax = sale.tax;
        const lineDiscount = sale.discount;
        const taxableSalesAmount = hasVat ? (Number(sale.subtotal) - Number(lineDiscount)) : 0;
        const nonTaxableSalesAmount = !hasVat ? (Number(sale.subtotal) - Number(lineDiscount)) : 0;

        return {
          date: sale.createdAt.toISOString().split("T")[0],
          billNo: sale.invoiceNumber,
          buyerName: sale.customer?.name || "Walk-in Customer",
          buyerPan: sale.customer?.phone || "N/A",
          totalSales: totalLineAmount,
          nonTaxableSales: nonTaxableSalesAmount,
          exportSales: 0,
          discount: lineDiscount,
          taxableSales: taxableSalesAmount,
          vatTax: lineTax,
          isActive: sale.isActive ? "ACTIVE" : "CANCELLED",
        };
      });
    } else if (reportType === "CANCELLED") {
      title = "Voided and Cancelled Invoices Report";
      const sales = await db.sale.findMany({
        where: { ...baseWhere, isActive: false, createdAt: dateRangeCommon },
        include: {
          customer: true,
          cancelledBy: { select: { name: true } },
        },
        orderBy: { cancelledAt: "desc" },
      });

      rawData = sales.map((s) => ({
        invoiceNumber: s.invoiceNumber,
        total: s.total,
        cancelledAt: s.cancelledAt?.toISOString().split("T")[0] || "N/A",
        cancelledBy: s.cancelledBy?.name || "System",
        reason: s.cancellationReason || "N/A",
      }));
    } else if (reportType === "REPRINTS") {
      title = "Invoice Reprints Log Report";
      const sales = await db.sale.findMany({
        where: { ...baseWhere, printCount: { gt: 1 }, createdAt: dateRangeCommon },
        include: { lastPrintedBy: { select: { name: true } } },
        orderBy: { lastPrintedAt: "desc" },
      });

      rawData = sales.map((s) => ({
        invoiceNumber: s.invoiceNumber,
        printCount: s.printCount,
        firstPrintedAt: s.firstPrintedAt?.toISOString() || "N/A",
        lastPrintedAt: s.lastPrintedAt?.toISOString() || "N/A",
        lastPrintedBy: s.lastPrintedBy?.name || "System",
      }));
    } else if (reportType === "CREDIT_NOTES") {
      title = "Credit Notes Compliance Book";
      const notes = await db.creditNote.findMany({
        where: { ...baseWhere, createdAt: dateRangeCommon },
        include: {
          sale: { select: { invoiceNumber: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      rawData = notes.map((n) => ({
        noteNumber: n.noteNumber,
        originalBillNo: n.sale.invoiceNumber,
        date: n.createdAt.toISOString().split("T")[0],
        subtotal: n.subtotal,
        tax: n.tax,
        total: n.total,
        reason: n.reason,
        createdBy: n.createdBy?.name || "System",
      }));
    } else if (reportType === "DEBIT_NOTES") {
      title = "Debit Notes Compliance Book";
      const notes = await db.debitNote.findMany({
        where: { ...baseWhere, createdAt: dateRangeCommon },
        include: {
          sale: { select: { invoiceNumber: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      rawData = notes.map((n) => ({
        noteNumber: n.noteNumber,
        originalBillNo: n.sale.invoiceNumber,
        date: n.createdAt.toISOString().split("T")[0],
        subtotal: n.subtotal,
        tax: n.tax,
        total: n.total,
        reason: n.reason,
        createdBy: n.createdBy?.name || "System",
      }));
    } else if (reportType === "CBMS_STATUS") {
      title = "CBMS Sync History Book";
      const queues = await db.cbmsSyncQueue.findMany({
        where: { businessId: context.businessId, createdAt: dateRangeCommon },
        include: { sale: { select: { invoiceNumber: true } } },
        orderBy: { createdAt: "desc" },
      });

      rawData = queues.map((q) => ({
        referenceNo: q.sale?.invoiceNumber || "N/A",
        action: q.action,
        status: q.syncStatus,
        attempts: q.attemptCount,
        lastAttempt: q.lastAttempt?.toISOString() || "N/A",
        errorMsg: q.errorMessage || "N/A",
      }));
    } else if (reportType === "AUDIT_TRAIL") {
      title = "TAMPER-RESISTANT AUDIT TRAIL";
      const logs = await db.auditLog.findMany({
        where: { businessId: context.businessId, createdAt: dateRangeCommon },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });

      rawData = logs.map((l) => ({
        date: l.createdAt.toISOString(),
        user: l.user?.name || "System",
        role: l.role,
        action: l.action,
        module: l.module,
        details: l.details,
        ipAddress: l.ipAddress || "127.0.0.1",
        deviceInfo: l.deviceInfo || "System Device",
      }));
    } else {
      return NextResponse.json({ error: "Invalid reportType parameter" }, { status: 400 });
    }

    // Format Exporter logic
    if (format === "xml") {
      const xml = jsonToXml(rawData, title);
      return new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportType}_export.xml"`,
        },
      });
    }

    if (format === "excel") {
      const excel = jsonToExcelSpreadsheet(rawData, title);
      return new Response(excel, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportType}_export.xls"`,
        },
      });
    }

    if (format === "pdf") {
      const pdf = jsonToPdf(rawData, title);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${reportType}_export.pdf"`,
        },
      });
    }

    // Default: json
    return NextResponse.json(rawData);
  } catch (error: any) {
    console.error("GET compliance report error:", error);
    return NextResponse.json({ error: "Failed to compile compliance report" }, { status: 500 });
  }
}

// Helpers for XML serialization
function jsonToXml(data: any[], title: string): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<Report title="${escapeXml(title)}">\n`;
  xml += `  <GeneratedAt>${new Date().toISOString()}</GeneratedAt>\n`;
  xml += "  <Records>\n";

  data.forEach((row) => {
    xml += "    <Record>\n";
    Object.entries(row).forEach(([key, val]) => {
      xml += `      <${key}>${escapeXml(String(val ?? ""))}</${key}>\n`;
    });
    xml += "    </Record>\n";
  });

  xml += "  </Records>\n";
  xml += "</Report>";
  return xml;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

// Helpers for Excel (SpreadsheetML) serialization
function jsonToExcelSpreadsheet(data: any[], title: string): string {
  if (data.length === 0) {
    return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"></Workbook>`;
  }

  const headers = Object.keys(data[0]);

  let xml = `<?xml version="1.0"?>\n`;
  xml += `<?mso-application progid="Excel.Sheet"?>\n`;
  xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
  xml += ` xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
  xml += ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
  xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n`;
  xml += ` xmlns:html="http://www.w3.org/TR/REC-html40">\n`;
  
  // Define custom styles for premium appearance
  xml += ` <Styles>\n`;
  xml += `  <Style ss:ID="Default" ss:Name="Normal">\n`;
  xml += `   <Alignment ss:Vertical="Bottom"/>\n`;
  xml += `   <Borders/>\n`;
  xml += `   <Font ss:FontName="Calibri" x:CharSet="1" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>\n`;
  xml += `   <Interior/>\n`;
  xml += `   <NumberFormat/>\n`;
  xml += `   <Protection/>\n`;
  xml += `  </Style>\n`;
  xml += `  <Style ss:ID="HeaderStyle">\n`;
  xml += `   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>\n`;
  xml += `   <Interior ss:Color="#1F4E78" ss:Pattern="Solid"/>\n`;
  xml += `   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n`;
  xml += `  </Style>\n`;
  xml += `  <Style ss:ID="TitleStyle">\n`;
  xml += `   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1F4E78"/>\n`;
  xml += `   <Alignment ss:Vertical="Center"/>\n`;
  xml += `  </Style>\n`;
  xml += ` </Styles>\n`;

  xml += ` <Worksheet ss:Name="Compliance Report">\n`;
  xml += `  <Table>\n`;
  
  // Set Column Widths
  headers.forEach(() => {
    xml += `   <Column ss:Width="140"/>\n`;
  });

  // Title Row
  xml += `   <Row ss:Height="40">\n`;
  xml += `    <Cell ss:MergeAcross="${headers.length - 1}" ss:StyleID="TitleStyle">`;
  xml += `<Data ss:Type="String">${escapeXml(title)}</Data></Cell>\n`;
  xml += `   </Row>\n`;

  // Spacer Row
  xml += `   <Row ss:Height="15"/>\n`;

  // Headers Row
  xml += `   <Row ss:Height="25">\n`;
  headers.forEach((h) => {
    const formattedHeader = h.replace(/([A-Z])/g, " $1").toUpperCase();
    xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(formattedHeader)}</Data></Cell>\n`;
  });
  xml += `   </Row>\n`;

  // Data Rows
  data.forEach((row) => {
    xml += `   <Row ss:Height="20">\n`;
    headers.forEach((h) => {
      const val = row[h];
      const isNum = typeof val === "number";
      const typeStr = isNum ? "Number" : "String";
      xml += `    <Cell><Data ss:Type="${typeStr}">${escapeXml(String(val ?? ""))}</Data></Cell>\n`;
    });
    xml += `   </Row>\n`;
  });

  xml += `  </Table>\n`;
  xml += ` </Worksheet>\n`;
  xml += `</Workbook>`;
  return xml;
}

// Helpers for PDF generation (Minimal standard PDF string streams)
function jsonToPdf(data: any[], title: string): string {
  let content = `${title.toUpperCase()}\n`;
  content += `Generated On: ${new Date().toLocaleString()}\n`;
  content += `Total Records: ${data.length}\n`;
  content += `------------------------------------------------------------\n\n`;

  data.forEach((row, idx) => {
    content += `[Record ${idx + 1}]\n`;
    Object.entries(row).forEach(([key, val]) => {
      const formattedKey = key.replace(/([A-Z])/g, " $1");
      content += `  ${formattedKey}: ${val}\n`;
    });
    content += `\n`;
  });

  const pdfBody = 
    `1 0 obj\n` +
    `<< /Type /Catalog /Pages 2 0 R >>\n` +
    `endobj\n` +
    `2 0 obj\n` +
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n` +
    `endobj\n` +
    `3 0 obj\n` +
    `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >> /Contents 4 0 R >>\n` +
    `endobj\n` +
    `4 0 obj\n` +
    `<< /Length ${content.length + 50} >>\n` +
    `stream\n` +
    `BT\n` +
    `/F1 9 Tf\n` +
    `40 760 Td\n` +
    `12 TL\n` +
    content.split("\n").map(line => `(${line.replace(/[()]/g, "\\$&")}) Tj T*`).join("\n") +
    `\nET\n` +
    `endstream\n` +
    `endobj\n` +
    `xref\n` +
    `0 5\n` +
    `0000000000 65535 f\n` +
    `trailer\n` +
    `<< /Size 5 /Root 1 0 R >>\n` +
    `startxref\n` +
    `%%EOF`;

  return `%PDF-1.4\n${pdfBody}`;
}
