const fs = require('fs');
let c = fs.readFileSync('frontend/src/lib/rbac.ts', 'utf8');
c = c.replace(
  'export function canAccessRoute(role: Role, path: string): boolean {',
  'export function canAccessRoute(role: Role, path: string): boolean {\n  if (path === "/dashboard/unauthorized" || path.startsWith("/dashboard/unauthorized/")) return true;'
);
fs.writeFileSync('frontend/src/lib/rbac.ts', c, 'utf8');
console.log('Successfully updated rbac.ts whitelist!');

