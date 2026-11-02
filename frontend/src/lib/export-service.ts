import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel } from "docx";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number; // approx character width
  format?: (value: any, row: any) => string | number;
}

export interface ExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  dateRange?: string;
  columns: ExportColumn[];
  data: any[];
}

export type ExportFormat = "csv" | "excel" | "pdf" | "doc";

/**
 * Enterprise Data Export Service
 * Reusable utility class for client-side multi-format data exports (CSV, Excel, PDF, Word).
 */
export class ExportService {
  /**
   * Universal export dispatcher
   */
  public static async export(format: ExportFormat, options: ExportOptions): Promise<void> {
    switch (format) {
      case "csv":
        return this.exportToCSV(options);
      case "excel":
        return this.exportToExcel(options);
      case "pdf":
        return this.exportToPDF(options);
      case "doc":
        return this.exportToWord(options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to CSV with UTF-8 BOM for proper Excel compatibility
   */
  public static exportToCSV(options: ExportOptions): void {
    const { filename, columns, data } = options;

    const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`);
    const rows = data.map((row) =>
      columns.map((col) => {
        let val = col.format ? col.format(row[col.key], row) : row[col.key];
        if (val === null || val === undefined) val = "";
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(",")
    );

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    this.downloadBlob(blob, `${filename}.csv`);
  }

  /**
   * Export to native Excel (.xlsx) workbook with styled headers and column widths
   */
  public static exportToExcel(options: ExportOptions): void {
    const { filename, title, columns, data } = options;

    const formattedData = data.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        const val = col.format ? col.format(row[col.key], row) : row[col.key];
        obj[col.header] = val ?? "";
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Auto set column widths
    const colWidths = columns.map((col) => {
      const maxLen = Math.max(
        col.header.length,
        col.width || 12,
        ...data.map((row) => {
          const val = col.format ? col.format(row[col.key], row) : row[col.key];
          return val ? String(val).length : 0;
        })
      );
      return { wch: Math.min(Math.max(maxLen + 3, 10), 40) };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31) || "Report");

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }

  /**
   * Export to PDF document with tabular layout and metadata header
   */
  public static exportToPDF(options: ExportOptions): void {
    const { filename, title, subtitle, dateRange, columns, data } = options;

    // Use landscape if more than 5 columns
    const orientation = columns.length > 5 ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    let currentY = 40;

    // Brand Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(107, 40, 55); // #6B2837 Deep Burgundy
    doc.text("RestroInn Hospitality OS", margin, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(113, 103, 94); // #71675E
    const generatedDate = `Generated: ${new Date().toLocaleString()}`;
    doc.text(generatedDate, pageWidth - margin - doc.getTextWidth(generatedDate), currentY);

    currentY += 22;

    // Title & Subtitle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(41, 35, 32); // #292320
    doc.text(title, margin, currentY);

    currentY += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(113, 103, 94);
    const subText = [subtitle, dateRange ? `Period: ${dateRange}` : ""].filter(Boolean).join("  •  ");
    if (subText) {
      doc.text(subText, margin, currentY);
      currentY += 18;
    } else {
      currentY += 8;
    }

    // Divider Line
    doc.setDrawColor(216, 206, 193); // #D8CEC1
    doc.setLineWidth(1);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    // Table Dimensions
    const tableWidth = pageWidth - margin * 2;
    const colWidth = tableWidth / columns.length;

    // Header Row Background
    doc.setFillColor(247, 243, 236); // #F7F3EC Warm Ivory
    doc.rect(margin, currentY, tableWidth, 20, "F");

    // Header Row Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(41, 35, 32);
    columns.forEach((col, idx) => {
      const x = margin + idx * colWidth + 4;
      doc.text(col.header, x, currentY + 13);
    });

    currentY += 20;

    // Rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const rowHeight = 18;

    data.forEach((row, rowIndex) => {
      // Page break check
      if (currentY + rowHeight > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 40;

        // Repeat header
        doc.setFillColor(247, 243, 236);
        doc.rect(margin, currentY, tableWidth, 20, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(41, 35, 32);
        columns.forEach((col, idx) => {
          const x = margin + idx * colWidth + 4;
          doc.text(col.header, x, currentY + 13);
        });
        currentY += 20;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      // Alternating row background
      if (rowIndex % 2 === 1) {
        doc.setFillColor(255, 252, 247); // #FFFCF7
        doc.rect(margin, currentY, tableWidth, rowHeight, "F");
      }

      // Border bottom
      doc.setDrawColor(238, 231, 221);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + rowHeight, margin + tableWidth, currentY + rowHeight);

      // Cell texts
      doc.setTextColor(41, 35, 32);
      columns.forEach((col, idx) => {
        let val = col.format ? col.format(row[col.key], row) : row[col.key];
        if (val === null || val === undefined) val = "";
        const cellText = String(val);
        const x = margin + idx * colWidth + 4;
        // Truncate if too long
        const maxCellChars = Math.floor(colWidth / 5);
        const truncated = cellText.length > maxCellChars ? cellText.slice(0, maxCellChars - 2) + "..." : cellText;
        doc.text(truncated, x, currentY + 12);
      });

      currentY += rowHeight;
    });

    // Save PDF
    doc.save(`${filename}.pdf`);
  }

  /**
   * Export to Word Document (.doc / .docx)
   */
  public static async exportToWord(options: ExportOptions): Promise<void> {
    const { filename, title, subtitle, dateRange, columns, data } = options;

    const tableHeaderCells = columns.map(
      (col) =>
        new TableCell({
          width: { size: Math.floor(100 / columns.length), type: WidthType.PERCENTAGE },
          shading: { fill: "F7F3EC" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: col.header,
                  bold: true,
                  size: 18,
                  color: "292320",
                  font: "Arial",
                }),
              ],
            }),
          ],
        })
    );

    const tableRows = [
      new TableRow({
        children: tableHeaderCells,
        tableHeader: true,
      }),
      ...data.map(
        (row, rIdx) =>
          new TableRow({
            children: columns.map((col) => {
              const val = col.format ? col.format(row[col.key], row) : row[col.key];
              return new TableCell({
                width: { size: Math.floor(100 / columns.length), type: WidthType.PERCENTAGE },
                shading: { fill: rIdx % 2 === 1 ? "FAF7F2" : "FFFFFF" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(val ?? ""),
                        size: 16,
                        color: "292320",
                        font: "Arial",
                      }),
                    ],
                  }),
                ],
              });
            }),
          })
      ),
    ];

    const wordDoc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "RestroInn Hospitality OS",
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text: "RestroInn Hospitality OS",
                  bold: true,
                  color: "6B2837",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 24,
                  color: "292320",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: [subtitle, dateRange ? `Period: ${dateRange}` : "", `Generated: ${new Date().toLocaleString()}`]
                    .filter(Boolean)
                    .join("  •  "),
                  italics: true,
                  size: 16,
                  color: "71675E",
                }),
              ],
            }),
            new Paragraph({ text: "" }), // Spacing
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(wordDoc);
    this.downloadBlob(blob, `${filename}.doc`);
  }

  /**
   * Helper method to download a Blob file in the browser
   */
  private static downloadBlob(blob: Blob, fullFilename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fullFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

