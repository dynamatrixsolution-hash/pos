const fs = require('fs');

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  // Semantic color replacements
  c = c.replace(/bg-slate-50\/50/g, 'bg-[#F7F3EC]');
  c = c.replace(/bg-slate-50\b/g, 'bg-[#F7F3EC]');
  c = c.replace(/bg-white\b/g, 'bg-[#FFFCF7]');
  c = c.replace(/border-slate-100\b/g, 'border-[#D8CEC1]');
  c = c.replace(/border-slate-200\b/g, 'border-[#D8CEC1]');
  c = c.replace(/border-slate-300\b/g, 'border-[#D8CEC1]');
  c = c.replace(/bg-slate-100\b/g, 'bg-[#EEE7DD]');
  c = c.replace(/bg-slate-200\b/g, 'bg-[#EEE7DD]');
  c = c.replace(/text-slate-900\b/g, 'text-[#292320]');
  c = c.replace(/text-slate-800\b/g, 'text-[#292320]');
  c = c.replace(/text-slate-700\b/g, 'text-[#292320]');
  c = c.replace(/text-slate-600\b/g, 'text-[#71675E]');
  c = c.replace(/text-slate-500\b/g, 'text-[#71675E]');
  c = c.replace(/text-slate-400\b/g, 'text-[#71675E]');

  // Geometry
  c = c.replace(/rounded-3xl\b/g, 'rounded-lg');
  c = c.replace(/rounded-2xl\b/g, 'rounded-lg');
  c = c.replace(/rounded-xl\b/g, 'rounded-md');

  // Shadows
  c = c.replace(/shadow-2xl\b/g, 'shadow-sm');
  c = c.replace(/shadow-xl\b/g, 'shadow-sm');
  c = c.replace(/shadow-lg\b/g, 'shadow-sm');
  c = c.replace(/shadow-md\b/g, 'shadow-sm');
  c = c.replace(/shadow-sm shadow-slate-100\/50/g, 'shadow-none');
  c = c.replace(/hover:shadow-md/g, 'hover:border-[#6B2837]');

  // Button primary
  c = c.replace(/bg-\[#0B3B30\]/g, 'bg-[#6B2837]');
  c = c.replace(/hover:bg-\[#126854\]/g, 'hover:bg-[#541E2A]');
  c = c.replace(/text-\[#0B3B30\]/g, 'text-[#6B2837]');
  c = c.replace(/text-\[#126854\]/g, 'text-[#6B2837]');

  // Sparkles
  c = c.replace(/<Sparkles[^>]*\/>\s*/g, '');

  fs.writeFileSync(filePath, c, 'utf8');
  console.log('Cleaned: ' + filePath);
}

const targetFiles = [
  'frontend/src/app/dashboard/page.tsx',
  'frontend/src/app/dashboard/branches/page.tsx',
  'frontend/src/app/dashboard/categories/page.tsx',
  'frontend/src/app/dashboard/customers/page.tsx',
  'frontend/src/app/dashboard/expenses/page.tsx',
  'frontend/src/app/dashboard/inventory/page.tsx',
  'frontend/src/app/dashboard/payments/page.tsx',
  'frontend/src/app/dashboard/pos/page.tsx',
  'frontend/src/app/dashboard/products/page.tsx',
  'frontend/src/app/dashboard/purchases/page.tsx',
  'frontend/src/app/dashboard/reports/page.tsx',
  'frontend/src/app/dashboard/sales/page.tsx',
  'frontend/src/app/dashboard/settings/page.tsx',
  'frontend/src/app/dashboard/suppliers/page.tsx',
  'frontend/src/app/dashboard/users/page.tsx',
  'frontend/src/components/dashboard-shell-client.tsx'
];

targetFiles.forEach(cleanFile);
console.log('Batch clean complete!');

