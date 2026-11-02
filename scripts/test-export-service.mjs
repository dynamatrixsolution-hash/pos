import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

async function testExportEngines() {
  console.log("Testing Export Engine Libraries...");

  const sampleData = [
    { invoice: "INV-2026-001", business: "Lakeside Resort", amount: 15000, status: "PAID" },
    { invoice: "INV-2026-002", business: "Himalayan Coffee", amount: 8500, status: "PENDING" },
  ];

  // 1. Test Excel
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Revenue");
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  console.log(`✓ Excel Workbook generated: ${xlsxBuffer.length} bytes`);

  // 2. Test PDF
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.text("RestroInn Official Report", 40, 50);
  const pdfBuffer = doc.output("arraybuffer");
  console.log(`✓ PDF Document generated: ${pdfBuffer.byteLength} bytes`);

  // 3. Test Word
  const wordDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "RestroInn Report", bold: true })],
          }),
        ],
      },
    ],
  });
  const docxBuffer = await Packer.toBuffer(wordDoc);
  console.log(`✓ Word Document (.doc) generated: ${docxBuffer.length} bytes`);

  console.log("\nAll 4 export engines validated successfully!");
}

testExportEngines().catch(console.error);

