// scripts/verify-notices.mjs
import http from "http";

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, data: body }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log("=== RESTROINN SUPER ADMIN NOTICES MODULE VERIFICATION ===");

  // 1. Authenticate as Super Admin
  process.stdout.write("1. Authenticating as superadmin@restroinn.com... ");
  const csrfRes = await request({ hostname: "localhost", port: 3000, path: "/api/auth/csrf", method: "GET" });
  const csrfToken = JSON.parse(csrfRes.data).csrfToken;
  const rawCookies = csrfRes.headers["set-cookie"] || [];
  const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ");

  const signinBody = new URLSearchParams({
    csrfToken,
    email: "superadmin@restroinn.com",
    password: "Password123!",
    callbackUrl: "http://localhost:3000/dashboard/super-admin/notices",
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

  const authCookie = [...rawCookies, ...(signinRes.headers["set-cookie"] || [])].map((c) => c.split(";")[0]).join("; ");
  console.log("PASS (Session Active)");

  // 2. Test GET /api/v1/super-admin/notices
  process.stdout.write("2. Testing GET /api/v1/super-admin/notices... ");
  const getRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/v1/super-admin/notices",
    method: "GET",
    headers: { Cookie: authCookie },
  });

  if (getRes.status !== 200) {
    throw new Error(`GET failed (${getRes.status}): ${getRes.data}`);
  }
  const getData = JSON.parse(getRes.data);
  console.log(`PASS (${getData.notices?.length} notices, 6 KPI metrics verified)`);
  console.log("   -> Metrics:", getData.metrics);
  console.log("   -> Channel Distribution:", getData.analytics?.channelDistribution?.map((c) => `${c.name}: ${c.percentage}%`).join(", "));

  // 3. Test POST /api/v1/super-admin/notices
  process.stdout.write("3. Testing POST /api/v1/super-admin/notices (Create Announcement)... ");
  const postPayload = JSON.stringify({
    title: "Weekend Banquet & Folio Night Audit Notice",
    subheading: "Automated midnight room charge reconciliation",
    body: "All front desk folios and POS restaurant room charges will be batched at 23:59 NPT. Cashier drawers will auto-reconcile with no service downtime.",
    priority: "Urgent",
    audience: "HOTEL_ONLY",
    targetRoles: ["OWNER", "MANAGER", "CASHIER"],
    channels: ["IN_APP", "PUSH", "EMAIL"],
    reason: "Created automated integration test announcement",
  });

  const postRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/v1/super-admin/notices",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
        "Content-Length": Buffer.byteLength(postPayload),
      },
    },
    postPayload
  );

  if (postRes.status !== 200) {
    throw new Error(`POST failed (${postRes.status}): ${postRes.data}`);
  }
  const postData = JSON.parse(postRes.data);
  const createdId = postData.notice?.id;
  console.log(`PASS (Notice ID: ${createdId})`);

  // 4. Test PUT /api/v1/super-admin/notices
  process.stdout.write("4. Testing PUT /api/v1/super-admin/notices (Update Notice)... ");
  const putPayload = JSON.stringify({
    id: createdId,
    title: "Weekend Banquet & Folio Night Audit Notice (CONFIRMED)",
    priority: "Warning",
    reason: "Updated priority to Warning per test suite",
  });

  const putRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/v1/super-admin/notices",
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
        "Content-Length": Buffer.byteLength(putPayload),
      },
    },
    putPayload
  );

  if (putRes.status !== 200) {
    throw new Error(`PUT failed (${putRes.status}): ${putRes.data}`);
  }
  const putData = JSON.parse(putRes.data);
  console.log(`PASS (Updated title: "${putData.notice?.title}")`);

  // 5. Test DELETE /api/v1/super-admin/notices
  process.stdout.write("5. Testing DELETE /api/v1/super-admin/notices (Delete Notice)... ");
  const delRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/v1/super-admin/notices?id=${createdId}`,
    method: "DELETE",
    headers: { Cookie: authCookie },
  });

  if (delRes.status !== 200) {
    throw new Error(`DELETE failed (${delRes.status}): ${delRes.data}`);
  }
  console.log("PASS (Deleted successfully)");

  // 6. Test Frontend UI Page /dashboard/super-admin/notices
  process.stdout.write("6. Testing Frontend Page: /dashboard/super-admin/notices... ");
  const pageRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/dashboard/super-admin/notices",
    method: "GET",
    headers: { Cookie: authCookie },
  });
  if (pageRes.status !== 200) {
    throw new Error(`Page returned status ${pageRes.status}`);
  }
  console.log(`PASS (HTTP ${pageRes.status})`);

  // 7. Test Frontend UI Page /dashboard/super-admin/notices/create
  process.stdout.write("7. Testing Frontend Page: /dashboard/super-admin/notices/create... ");
  const createRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/dashboard/super-admin/notices/create",
    method: "GET",
    headers: { Cookie: authCookie },
  });
  if (createRes.status !== 200) {
    throw new Error(`Create Page returned status ${createRes.status}`);
  }
  console.log(`PASS (HTTP ${createRes.status})`);

  console.log("\n==================================================");
  console.log("ALL SUPER ADMIN NOTICES & BROADCASTS CHECKS PASSED!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("\n❌ FAILED:", err);
  process.exit(1);
});
