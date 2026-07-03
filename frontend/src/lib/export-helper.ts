import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

/**
 * Export data array to an Excel sheet and download it.
 */
export function exportToExcel(data: any[], fileName: string) {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Excel export error:", error);
  }
}

/**
 * Export tabular data to PDF and download it.
 */
export function exportToPDF(headers: string[], rows: any[][], title: string, fileName: string) {
  try {
    const doc = new jsPDF("p", "pt", "a4");
    
    // Page margins and sizing
    const margin = 30;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);
    
    let y = 50;
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(title, margin, y);
    y += 20;
    
    // Timestamp
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 25;
    
    // Draw table headers
    const colCount = headers.length;
    const colWidth = contentWidth / colCount;
    
    const drawTableHeader = (startY: number) => {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, startY, contentWidth, 22, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      
      headers.forEach((header, i) => {
        doc.text(header, margin + (i * colWidth) + 6, startY + 14);
      });
      
      return startY + 22;
    };
    
    y = drawTableHeader(y);
    
    // Rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    
    rows.forEach((row, rowIndex) => {
      // Add page if row exceeds page bounds
      if (y + 18 > pageHeight - margin) {
        doc.addPage();
        y = 40;
        y = drawTableHeader(y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
      
      // Zebra striping
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252); // slate-50
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, y, contentWidth, 18, "F");
      
      // Border line
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.line(margin, y + 18, margin + contentWidth, y + 18);
      
      doc.setTextColor(51, 65, 85); // slate-700
      row.forEach((cell, i) => {
        const text = String(cell ?? "");
        // Truncate to fit column width roughly
        const charLimit = Math.floor(colWidth / 5.5);
        const truncated = text.length > charLimit ? text.substring(0, charLimit - 3) + "..." : text;
        doc.text(truncated, margin + (i * colWidth) + 6, y + 12);
      });
      
      y += 18;
    });
    
    doc.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("PDF export error:", error);
  }
}
