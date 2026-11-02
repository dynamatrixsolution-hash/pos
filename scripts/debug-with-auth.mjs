import http from "http";

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    req.on("error", reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function debugWithAuth() {
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

  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/dashboard/super-admin",
    method: "GET",
    headers: {
      Cookie: authCookie,
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html",
    },
  });

  console.log("Status Code:", res.statusCode);
  console.log("Headers:", res.headers);
  console.log("Body preview (first 500 chars):", res.data.slice(0, 500));
}

debugWithAuth().catch(console.error);

