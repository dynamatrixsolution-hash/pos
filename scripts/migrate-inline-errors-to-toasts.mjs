import fs from "fs";

// 1. categories-client.tsx
{
  const file = "frontend/src/app/dashboard/categories/categories-client.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''") return "setError('');";
    return `Notify.failure(${p1}); setError(${p1});`;
  });
  content = content.replace(/\{error && <div className="p-3 mb-4 text-sm bg-destructive\/10 text-destructive rounded-lg font-medium border border-destructive\/20">\{error\}<\/div>\}/g, "");
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated categories-client.tsx");
}

// 2. inventory-client.tsx
{
  const file = "frontend/src/app/dashboard/inventory/inventory-client.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  content = content.replace(/\{submitError && <div className="p-3 mb-4 text-sm bg-destructive\/10 text-destructive rounded-lg font-medium border border-destructive\/20">\{submitError\}<\/div>\}/g, "");
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated inventory-client.tsx");
}

// 3. users-client.tsx
{
  const file = "frontend/src/app/dashboard/users/users-client.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  content = content.replace(/\{submitError && <div className="p-3 mb-4 text-xs bg-destructive\/10 text-destructive rounded-lg font-bold border border-destructive\/20">\{submitError\}<\/div>\}/g, "");
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated users-client.tsx");
}

// 4. customers/page.tsx
{
  const file = "frontend/src/app/dashboard/customers/page.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  content = content.replace(/setReceiveError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setReceiveError('');";
    return `Notify.failure(${p1}); setReceiveError(${p1});`;
  });
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated customers/page.tsx");
}

// 5. expenses/page.tsx
{
  const file = "frontend/src/app/dashboard/expenses/page.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated expenses/page.tsx");
}

// 6. products/page.tsx
{
  const file = "frontend/src/app/dashboard/products/page.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated products/page.tsx");
}

// 7. purchases/page.tsx
{
  const file = "frontend/src/app/dashboard/purchases/page.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated purchases/page.tsx");
}

// 8. suppliers/page.tsx
{
  const file = "frontend/src/app/dashboard/suppliers/page.tsx";
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setSubmitError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setSubmitError('');";
    return `Notify.failure(${p1}); setSubmitError(${p1});`;
  });
  fs.writeFileSync(file, content, "utf8");
  console.log("Updated suppliers/page.tsx");
}

// 9. Hotel pages (housekeeping, reservations, rooms, stays, folios, pilot-ops, qr-portal)
const hotelFiles = [
  "frontend/src/app/dashboard/hotel/housekeeping/page.tsx",
  "frontend/src/app/dashboard/hotel/reservations/page.tsx",
  "frontend/src/app/dashboard/hotel/rooms/page.tsx",
  "frontend/src/app/dashboard/hotel/stays/page.tsx",
  "frontend/src/app/dashboard/hotel/folios/page.tsx",
  "frontend/src/app/dashboard/hotel/pilot-ops/page.tsx",
  "frontend/src/app/dashboard/hotel/qr-portal/page.tsx",
];

for (const f of hotelFiles) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, "utf8");
  if (!content.includes('import { Notify } from "@/lib/notify"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
  }
  content = content.replace(/setError\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setError('');";
    return `Notify.failure(${p1}); setError(${p1});`;
  });
  fs.writeFileSync(f, content, "utf8");
  console.log("Updated hotel page:", f);
}

// 10. auth/register/status/page.tsx
{
  const file = "frontend/src/app/auth/register/status/page.tsx";
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    if (!content.includes('import { Notify } from "@/lib/notify"')) {
      content = 'import { Notify } from "@/lib/notify";\n' + content;
    }
    content = content.replace(/setEditError\(([^)]+)\);/g, (match, p1) => {
      if (p1.trim() === '""' || p1.trim() === "''" || p1.trim() === "null") return "setEditError('');";
      return `Notify.failure(${p1}); setEditError(${p1});`;
    });
    fs.writeFileSync(file, content, "utf8");
    console.log("Updated register status page");
  }
}

