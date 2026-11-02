import fs from "fs";
import path from "path";

const filePath = path.resolve("frontend/src/components/dashboard-shell-client.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix const { update } = useSession() -> const { status, update } = useSession()
// And remove status check or fetch directly on mount
content = content.replace(
  "  const { update } = useSession();",
  "  const { status, update } = useSession();"
);

content = content.replace(
  `  React.useEffect(() => {
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
  }, [status]);`,
  `  React.useEffect(() => {
    fetch("/api/v1/notifications/broadcasts")
      .then((res) => (res.ok ? res.json() : { broadcasts: [] }))
      .then((data) => {
        if (Array.isArray(data.broadcasts)) {
          setBroadcastsList(data.broadcasts);
        }
      })
      .catch(() => {});
  }, []);`
);

fs.writeFileSync(filePath, content, "utf8");
console.log("Fixed status in dashboard-shell-client.tsx");

