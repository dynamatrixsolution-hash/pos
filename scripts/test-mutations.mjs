import http from "http";

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

async function testMutations() {
  const csrfRes = await request({ hostname: "localhost", port: 3000, path: "/api/auth/csrf", method: "GET" });
  const csrfToken = JSON.parse(csrfRes.data).csrfToken;
  const rawCookies = csrfRes.headers["set-cookie"] || [];
  const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ");

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
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader, "Content-Length": Buffer.byteLength(signinBody) },
    },
    signinBody
  );

  const authCookie = [...rawCookies, ...(signinRes.headers["set-cookie"] || [])].map((c) => c.split(";")[0]).join("; ");

  console.log("Testing POST /api/v1/super-admin/notices...");
  const createNoticeRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/v1/super-admin/notices",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie },
    },
    {
      title: "Routine Database Vacuum Scheduled",
      subheading: "03:00 - 03:15 AM NPT",
      body: "Brief 15-minute maintenance window for indexing and cache sync.",
      priority: "INFO",
      audience: "ALL",
      targetRoles: ["OWNER", "MANAGER"],
      reason: "Scheduled Q1 optimization per maintenance ticket 108",
    }
  );
  console.log("Create Notice Response:", createNoticeRes.statusCode, JSON.parse(createNoticeRes.data).success ? "SUCCESS" : createNoticeRes.data);

  console.log("\nTesting PUT /api/v1/super-admin/settings...");
  const updateSettingRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/v1/super-admin/settings",
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie },
    },
    {
      key: "SUBSCRIPTION_DEFAULTS",
      value: {
        trialDurationDays: 14,
        gracePeriodDays: 7,
        invoiceDueDays: 15,
        defaultCurrency: "NPR",
        autoReminderDaysBeforeDue: 3,
      },
      reason: "Reconfirming standard 14-day trial policy for Q1",
    }
  );
  console.log("Update Setting Response:", updateSettingRes.statusCode, JSON.parse(updateSettingRes.data).success ? "SUCCESS" : updateSettingRes.data);
}

testMutations().catch(console.error);

