import fs from "fs";
import path from "path";

const filePath = path.resolve("frontend/src/components/dashboard-shell-client.tsx");
let content = fs.readFileSync(filePath, "utf8");

// 1. Add icon imports
if (!content.includes("Boxes,")) {
  content = content.replace(
    "  Settings,\n} from \"lucide-react\";",
    "  Settings,\n  Boxes,\n  Megaphone,\n  BarChart3,\n} from \"lucide-react\";"
  );
  // Also handle CRLF if not matched
  if (!content.includes("Boxes,")) {
    content = content.replace(
      "  Settings,\r\n} from \"lucide-react\";",
      "  Settings,\r\n  Boxes,\r\n  Megaphone,\r\n  BarChart3,\r\n} from \"lucide-react\";"
    );
  }
}

// 2. Update breadcrumbs and superAdmin items
const oldItems = `  const superAdminWorkspaceItems = [
    { title: "Overview", href: "/dashboard/super-admin", icon: LayoutGrid },
    { title: "Businesses", href: "/dashboard/super-admin/businesses", icon: Building2 },
    { title: "Approvals", href: "/dashboard/super-admin/requests", icon: ShieldCheck },
    { title: "Subscriptions", href: "/dashboard/super-admin/subscriptions", icon: FileText },
    { title: "Billing & payments", href: "/dashboard/super-admin/revenue", icon: CreditCard },
  ];`;

const newItems = `  const superAdminWorkspaceItems = [
    { title: "Overview", href: "/dashboard/super-admin", icon: LayoutGrid },
    { title: "Businesses", href: "/dashboard/super-admin/businesses", icon: Building2 },
    { title: "Approvals", href: "/dashboard/super-admin/requests", icon: ShieldCheck },
    { title: "Subscriptions", href: "/dashboard/super-admin/subscriptions", icon: FileText },
    { title: "Billing & payments", href: "/dashboard/super-admin/revenue", icon: CreditCard },
    { title: "Modules & Features", href: "/dashboard/super-admin/modules", icon: Boxes },
    { title: "Broadcast notices", href: "/dashboard/super-admin/notices", icon: Megaphone },
    { title: "Reports & exports", href: "/dashboard/super-admin/reports", icon: BarChart3 },
  ];`;

if (content.includes("Billing & payments") && !content.includes("/dashboard/super-admin/modules")) {
  content = content.replace(oldItems.replace(/\r?\n/g, "\r\n"), newItems.replace(/\r?\n/g, "\r\n"));
  if (!content.includes("/dashboard/super-admin/modules")) {
    content = content.replace(oldItems.replace(/\r?\n/g, "\n"), newItems.replace(/\r?\n/g, "\n"));
  }
}

// Breadcrumb update
if (!content.includes("Modules & Features")) {
  content = content.replace(
    'if (pathname.includes("/businesses")) return "Businesses";',
    'if (pathname.includes("/modules")) return "Modules & Features";\n    if (pathname.includes("/notices")) return "Broadcast notices";\n    if (pathname.includes("/reports")) return "Reports & exports";\n    if (pathname.includes("/businesses")) return "Businesses";'
  );
}

// 3. Add broadcast banner fetch and rendering
if (!content.includes("broadcastsList")) {
  // Add state hooks
  const stateHookTarget = "const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);";
  const stateHooksToAdd = `const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [broadcastsList, setBroadcastsList] = React.useState<any[]>([]);
  const [dismissedNoticeIds, setDismissedNoticeIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/v1/notifications/broadcasts")
        .then((res) => (res.ok ? res.json() : { broadcasts: [] }))
        .then((data) => {
          if (Array.isArray(data.broadcasts)) {
            setBroadcastsList(data.broadcasts);
          }
        })
        .catch(() => {});
    }
  }, [status]);`;

  content = content.replace(stateHookTarget, stateHooksToAdd);

  // Add banner inside <main>
  const mainTarget = `<main className={\`flex-1 \${isPosRoute ? "overflow-hidden h-full" : "overflow-y-auto"} bg-background relative \${isPosRoute ? "p-0" : "p-4 md:p-6"}\`}>
          {children}`;

  const mainReplacement = `<main className={\`flex-1 \${isPosRoute ? "overflow-hidden h-full" : "overflow-y-auto"} bg-background relative \${isPosRoute ? "p-0" : "p-4 md:p-6"}\`}>
          {/* Platform Broadcast Banner */}
          {broadcastsList.filter((b) => !dismissedNoticeIds.includes(b.id)).map((broadcast) => (
            <div
              key={broadcast.id}
              className={\`mb-4 px-4 py-3 rounded-lg border text-xs flex items-start justify-between gap-3 \${
                broadcast.priority === "URGENT_MAINTENANCE"
                  ? "bg-[#FDE8E8] border-[#F8B4B4] text-[#9C3232]"
                  : broadcast.priority === "WARNING"
                  ? "bg-[#FEF08A]/30 border-[#FEF08A] text-[#854D0E]"
                  : "bg-[#DEF7EC] border-[#BCF0DA] text-[#03543F]"
              }\`}
            >
              <div className="flex items-start gap-2.5">
                <Megaphone className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">{broadcast.title}</span>
                  {broadcast.subheading && <span className="ml-1.5 opacity-80 font-medium">— {broadcast.subheading}</span>}
                  <p className="mt-0.5 leading-relaxed">{broadcast.body}</p>
                </div>
              </div>
              <button
                onClick={() => setDismissedNoticeIds((prev) => [...prev, broadcast.id])}
                className="opacity-70 hover:opacity-100 p-1 shrink-0 cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {children}`;

  content = content.replace(mainTarget.replace(/\r?\n/g, "\r\n"), mainReplacement.replace(/\r?\n/g, "\r\n"));
  if (!content.includes("broadcastsList.filter")) {
    content = content.replace(mainTarget.replace(/\r?\n/g, "\n"), mainReplacement.replace(/\r?\n/g, "\n"));
  }
}

fs.writeFileSync(filePath, content, "utf8");
console.log("Updated dashboard-shell-client.tsx with notices and nav items successfully!");

