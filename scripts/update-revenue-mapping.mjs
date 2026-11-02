import fs from 'node:fs';

const filePath = 'frontend/src/app/dashboard/super-admin/revenue/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /setPayments\(data\.payments\s*\|\|\s*\[\]\);\s*setInvoices\(data\.invoices\s*\|\|\s*\[\]\);/,
  `setPayments(data.payments || data.transactionLogs || []);
        const mappedInvoices = (data.invoices || []).map((i: any) => ({
          invoiceNumber: i.invoiceNumber,
          businessName: i.business?.name || i.businessName || "Unknown Tenant",
          plan: i.plan || "SUBSCRIPTION",
          amount: Number(i.amount),
          currency: i.currency || "NPR",
          date: i.createdAt || i.date || new Date().toISOString(),
          status: i.status,
        }));
        setInvoices(mappedInvoices);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated revenue/page.tsx mapping!');

