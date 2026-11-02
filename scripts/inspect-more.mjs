import fs from "fs";

async function main() {
  const loginRes = await fetch("https://edu.thenexaedu.com/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "superadmin", password: "adminpassword123" }),
  });

  const cookies = loginRes.headers.getSetCookie();
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken || loginData.data?.token;

  const extraRoutes = [
    "/superadmin/institutions",
    "/superadmin/institutions/pending",
    "/superadmin/institutions/expiring",
    "/superadmin/subscriptions",
    "/superadmin/subscriptions/plans",
    "/superadmin/reports",
    "/superadmin/reports/revenue",
    "/superadmin/settings/security",
    "/superadmin/settings/gateways",
    "/superadmin/settings/maintenance",
  ];

  for (const r of extraRoutes) {
    try {
      const res = await fetch(`https://edu.thenexaedu.com${r}`, {
        headers: {
          Cookie: cookieHeader,
          Authorization: `Bearer ${token}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      console.log(`✓ ${r} (Status: ${res.status})`);
      const html = await res.text();
      const pageScript = html.match(/app\/\(protected\)\/superadmin\/[^\"]+\.js/g);
      if (pageScript) {
        const sRes = await fetch(`https://edu.thenexaedu.com/_next/static/chunks/${pageScript[0]}`);
        const sText = await sRes.text();
        const apis = Array.from(new Set(sText.match(/\/api\/[a-zA-Z0-9_\-\/]+/g) || []));
        console.log(`   APIs for ${r}:`, apis);
      }
    } catch (e) {
      console.log(`✗ ${r} error:`, e.message);
    }
  }
}

main().catch(console.error);

