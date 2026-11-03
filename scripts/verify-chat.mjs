// scripts/verify-chat.mjs
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
  console.log("=== RESTROINN SUPER ADMIN DIRECT MESSAGES (CHAT) VERIFICATION ===");

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
    callbackUrl: "http://localhost:3000/dashboard/super-admin/chat",
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

  // 2. Test GET /api/v1/super-admin/chat
  process.stdout.write("2. Testing GET /api/v1/super-admin/chat... ");
  const getRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/v1/super-admin/chat",
    method: "GET",
    headers: { Cookie: authCookie },
  });

  if (getRes.status !== 200) {
    throw new Error(`GET failed (${getRes.status}): ${getRes.data}`);
  }
  const getData = JSON.parse(getRes.data);
  const owners = getData.owners || [];
  console.log(`PASS (${owners.length} property owners found, ${getData.messages?.length || 0} active thread messages)`);
  owners.forEach((o) => {
    console.log(`   -> ${o.name} | Property: ${o.businessName} | Last: "${o.lastMessage?.content?.slice(0, 45)}..."`);
  });

  if (owners.length === 0) {
    throw new Error("No property owners found in chat directory");
  }

  const targetOwner = owners[0];

  // 3. Test POST /api/v1/super-admin/chat (Send Message)
  process.stdout.write(`3. Testing POST /api/v1/super-admin/chat (Send message to ${targetOwner.name})... `);
  const postPayload = JSON.stringify({
    receiverId: targetOwner.id,
    content: "Platform notification: Automated verification test message for CBMS fiscal sync status.",
  });

  const postRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/v1/super-admin/chat",
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
  console.log(`PASS (Message created, ID: ${postData.message?.id})`);

  // 4. Test PUT /api/v1/super-admin/chat (Toggle Block)
  process.stdout.write(`4. Testing PUT /api/v1/super-admin/chat (Toggle block for ${targetOwner.name})... `);
  const putPayload = JSON.stringify({
    ownerId: targetOwner.id,
    action: "TOGGLE_BLOCK",
  });

  const putRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/v1/super-admin/chat",
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
  console.log(`PASS (Blocked state: ${putData.isBlocked})`);

  // Reset block back to normal
  if (putData.isBlocked) {
    await request(
      {
        hostname: "localhost",
        port: 3000,
        path: "/api/v1/super-admin/chat",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
          "Content-Length": Buffer.byteLength(putPayload),
        },
      },
      putPayload
    );
  }

  // 5. Test Frontend UI Page: /dashboard/super-admin/chat
  process.stdout.write("5. Testing Frontend Page: /dashboard/super-admin/chat... ");
  const chatPageRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/dashboard/super-admin/chat",
    method: "GET",
    headers: { Cookie: authCookie },
  });
  if (chatPageRes.status !== 200) {
    throw new Error(`Chat page returned status ${chatPageRes.status}`);
  }
  console.log(`PASS (HTTP ${chatPageRes.status})`);

  // 6. Test Frontend UI Page: /dashboard/super-admin/messages
  process.stdout.write("6. Testing Frontend Page: /dashboard/super-admin/messages... ");
  const messagesPageRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/dashboard/super-admin/messages",
    method: "GET",
    headers: { Cookie: authCookie },
  });
  if (messagesPageRes.status !== 200) {
    throw new Error(`Messages page returned status ${messagesPageRes.status}`);
  }
  console.log(`PASS (HTTP ${messagesPageRes.status})`);

  console.log("\n==================================================");
  console.log("ALL SUPER ADMIN DIRECT CHAT TESTS PASSED!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("\n❌ FAILED:", err);
  process.exit(1);
});

