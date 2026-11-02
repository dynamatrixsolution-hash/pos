import fs from "fs";
import path from "path";

// 1. Update business-onboarding-wizard.tsx
{
  const filePath = "frontend/src/components/business-onboarding-wizard.tsx";
  let code = fs.readFileSync(filePath, "utf8");

  if (!code.includes('import { Notify } from "@/lib/notify";')) {
    code = code.replace(
      'import Link from "next/link";',
      'import Link from "next/link";\nimport { Notify } from "@/lib/notify";'
    );
  }

  code = code.replace(/setErrorMessage\(([^)]+)\);/g, (match, p1) => {
    if (p1.trim() === "null") return "";
    return `Notify.warning(${p1});`;
  });

  code = code.replace(
    /catch\s*\(err:\s*any\)\s*\{\s*setErrorMessage\([^)]+\);\s*\}/g,
    'catch (err: any) { Notify.failure(err.message || "An error occurred during submission."); }'
  );

  code = code.replace(
    /router\.push\(`\/auth\/register\/status\?id=\$\{json\.request\.id\}&code=\$\{json\.request\.trackingCode\}`\);/,
    'Notify.success("Workspace registration request submitted successfully!");\n        router.push(`/auth/register/status?id=${json.request.id}&code=${json.request.trackingCode}`);'
  );

  code = code.replace(
    /\{\/\*\s*ERROR ALERT\s*\*\/\}[\s\S]*?\{\/\*\s*MAIN CONTENT/,
    "{/* MAIN CONTENT"
  );

  fs.writeFileSync(filePath, code, "utf8");
  console.log("Updated business-onboarding-wizard.tsx");
}

// 2. Update hotel pages (housekeeping, reservations, rooms, stays, folios, pilot-ops, qr-portal)
const hotelPages = [
  "frontend/src/app/dashboard/hotel/housekeeping/page.tsx",
  "frontend/src/app/dashboard/hotel/reservations/page.tsx",
  "frontend/src/app/dashboard/hotel/rooms/page.tsx",
  "frontend/src/app/dashboard/hotel/stays/page.tsx",
  "frontend/src/app/dashboard/hotel/folios/page.tsx",
  "frontend/src/app/dashboard/hotel/pilot-ops/page.tsx",
  "frontend/src/app/dashboard/hotel/qr-portal/page.tsx",
  "frontend/src/app/dashboard/payments/received/page.tsx",
  "frontend/src/app/dashboard/payments/sent/page.tsx",
  "frontend/src/app/dashboard/reports/accounting/page.tsx",
  "frontend/src/app/dashboard/reports/compliance/page.tsx",
  "frontend/src/app/dashboard/restaurant/tables/page.tsx",
  "frontend/src/app/dashboard/settings/ird/page.tsx",
  "frontend/src/app/dashboard/categories/categories-client.tsx",
  "frontend/src/app/dashboard/inventory/inventory-client.tsx",
  "frontend/src/app/dashboard/users/users-client.tsx",
  "frontend/src/app/dashboard/customers/page.tsx",
  "frontend/src/app/dashboard/expenses/page.tsx",
  "frontend/src/app/dashboard/products/page.tsx",
  "frontend/src/app/dashboard/purchases/page.tsx",
  "frontend/src/app/dashboard/suppliers/page.tsx"
];

for (const relPath of hotelPages) {
  if (!fs.existsSync(relPath)) continue;
  let content = fs.readFileSync(relPath, "utf8");
  let modified = false;

  // Add Notify import if alert or error banner was present
  if (!content.includes('import { Notify } from "@/lib/notify"') && !content.includes('import { toast } from "@/components/toast"')) {
    content = 'import { Notify } from "@/lib/notify";\n' + content;
    modified = true;
  }

  // Replace alert(err.message) -> Notify.failure(err.message)
  if (content.includes("alert(err.message)")) {
    content = content.replaceAll("alert(err.message);", "Notify.failure(err.message);");
    modified = true;
  }

  // Replace alert("...")
  content = content.replace(/alert\((['"`].*?['"`])\);?/g, (match, msg) => {
    modified = true;
    if (msg.toLowerCase().includes("success")) {
      return `Notify.success(${msg});`;
    }
    return `Notify.warning(${msg});`;
  });

  // Replace alert(err.message || "...")
  content = content.replace(/alert\((err\.message\s*\|\|\s*['"`].*?['"`])\);?/g, (match, expr) => {
    modified = true;
    return `Notify.failure(${expr});`;
  });

  // In catch blocks, replace setError(...) with Notify.failure(...)
  // e.g. catch (err: any) { setError(err.message); }
  content = content.replace(/catch\s*\((?:err|e):?\s*any\)\s*\{\s*(?:setError|setSubmitError)\(([^)]+)\);?\s*\}/g, (match, arg) => {
    modified = true;
    return `catch (err: any) { Notify.failure(${arg}); }`;
  });

  if (modified) {
    fs.writeFileSync(relPath, content, "utf8");
    console.log("Updated:", relPath);
  }
}

{
  const filePath = "frontend/src/app/dashboard/settings/ird/page.tsx";
  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace('alert("Failed to sync: " + data.error);', 'Notify.failure("Failed to sync: " + data.error);');
  content = content.replace('alert("Error creating fiscal year: " + data.error);', 'Notify.failure("Error creating fiscal year: " + data.error);');
  fs.writeFileSync(filePath, content, "utf8");
  console.log("Updated IRD page alerts");
}
