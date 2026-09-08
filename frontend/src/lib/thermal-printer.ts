import { ReceiptData, ReceiptSettings, generateThermalReceiptHtml } from "@/components/pos/thermal-receipt";

/**
 * Executes direct thermal receipt printing using a background hidden iframe.
 * 
 * Benefits:
 * 1. Cashier's dashboard UI does not shift, blink, or resize.
 * 2. In Chrome/Edge Kiosk Mode (`--kiosk-printing`), prints silently without ANY print dialog!
 * 3. Enforces zero margins `@page { size: auto; margin: 0; }` to eliminate browser headers/footers
 *    ("1 sheet of paper", URL, timestamp).
 * 4. Thermal printer detects end of receipt and cuts automatically.
 */
export async function printThermalReceipt(
  data: ReceiptData,
  settings: ReceiptSettings,
  saleId?: string
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    // Generate clean receipt HTML string
    const receiptContent = generateThermalReceiptHtml(data, settings);

    // Reuse or create hidden iframe
    let iframe = document.getElementById("pos-thermal-print-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "pos-thermal-print-frame";
      iframe.name = "pos-thermal-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      iframe.style.opacity = "0";
      iframe.style.zIndex = "-9999";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      throw new Error("Cannot access hidden print iframe document");
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt-${data.invoiceNumber}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            img {
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
            }
          </style>
        </head>
        <body>
          ${receiptContent}
        </body>
      </html>
    `;

    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Allow images/QR code to finish decoding before triggering print
    await new Promise<void>((resolve) => {
      const win = iframe?.contentWindow;
      if (!win) return resolve();

      const images = Array.from(doc.images || []);
      if (images.length === 0) {
        setTimeout(resolve, 80);
        return;
      }

      let loadedCount = 0;
      const onImgDone = () => {
        loadedCount++;
        if (loadedCount >= images.length) {
          setTimeout(resolve, 80);
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          onImgDone();
        } else {
          img.onload = onImgDone;
          img.onerror = onImgDone;
        }
      });

      // Safety timeout
      setTimeout(resolve, 350);
    });

    // Trigger printing inside iframe
    const printWin = iframe.contentWindow;
    if (printWin) {
      printWin.focus();
      printWin.print();
    }

    // Fire-and-forget print audit log track
    if (saleId) {
      fetch(`/api/v1/sales/${saleId}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((e) => console.warn("Could not log print audit:", e));
    }

    return true;
  } catch (error) {
    console.error("Thermal receipt print error:", error);
    // Fallback to standard window.print if iframe fails
    window.print();
    return false;
  }
}
