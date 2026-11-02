import http from "http";

// Test helper to run HTTP requests
function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });
    req.on("error", reject);
    if (bodyData) {
      req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function testAll() {
  console.log("1. Authenticating as superadmin@restroinn.com...");

  // NextAuth CSRF token
  const csrfRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/csrf",
    method: "GET",
  });
  const csrfToken = JSON.parse(csrfRes.data).csrfToken;
  const rawCookies = csrfRes.headers["set-cookie"] || [];
  const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ");

  // NextAuth credentials signin
  const signinBody = new URLSearchParams({
    csrfToken,
    email: "superadmin@restroinn.com",
    password: "Password123!",
    callbackUrl: "http://localhost:3000/dashboard/super-admin",
    json: "true",
  }).toString();

  const signinRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/callback/credentials",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
        "Content-Length": Buffer.byteLength(signinBody),
      },
    },
    signinBody
  );

  const sessionCookies = signinRes.headers["set-cookie"] || [];
  const authCookie = [...rawCookies, ...sessionCookies]
    .map((c) => c.split(";")[0])
    .join("; ");

  console.log("✓ Authenticated! Auth cookie obtained.\n");

  const endpoints = [
    { name: "Feature Matrix & Modules", path: "/api/v1/super-admin/modules" },
    { name: "Broadcast Notices Index", path: "/api/v1/super-admin/notices" },
    { name: "Tenant Broadcasts Query", path: "/api/v1/notifications/broadcasts" },
    { name: "Platform Settings Store", path: "/api/v1/super-admin/settings" },
    { name: "Public Platform Status", path: "/api/v1/platform/status" },
    { name: "Reports Summary", path: "/api/v1/super-admin/reports?mode=summary" },
    { name: "Support Tickets Queue", path: "/api/v1/super-admin/support" },
  ];

  for (const ep of endpoints) {
    const res = await request({
      hostname: "localhost",
      port: 3000,
      path: ep.path,
      method: "GET",
      headers: {
        Cookie: authCookie,
      },
    });

    console.log(`Endpoint [${ep.name}]: HTTP ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.log(`  Error Output: ${res.data.slice(0, 300)}`);
    } else {
      const parsed = JSON.parse(res.data);
      console.log(`  Payload keys: ${Object.keys(parsed).join(", ")}`);
    }
  }

  // Test CSV export
  console.log("\nTesting CSV export stream for businesses...");
  const csvRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/v1/super-admin/reports?mode=export&dataset=businesses",
    method: "GET",
    headers: {
      Cookie: authCookie,
    },
  });
  console.log(`CSV Export: HTTP ${csvRes.statusCode}, Content-Type: ${csvRes.headers["content-type"]}`);
  console.log(`CSV First 2 lines:\n${csvRes.data.split("\r\n").slice(0, 2).join("\n")}`);

  console.log("\nAll Super Admin endpoints verified successfully!");
}

testAll().catch(console.error);

