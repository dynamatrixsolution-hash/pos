import fs from "fs";

async function inspectDashboard() {
  const loginRes = await fetch("https://edu.thenexaedu.com/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "superadmin", password: "adminpassword123" }),
  });

  const cookies = loginRes.headers.getSetCookie();
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken || loginData.data?.token;

  console.log("Login OK:", loginData.success, "Token length:", token?.length);

  // Fetch /superadmin page
  const pageRes = await fetch("https://edu.thenexaedu.com/superadmin", {
    headers: {
      Cookie: cookieHeader,
      Authorization: `Bearer ${token}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  const pageHtml = await pageRes.text();
  console.log("HTML length:", pageHtml.length);

  // Find chunks
  const scriptMatches = Array.from(pageHtml.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)).map((m) => m[1]);
  console.log("Total script chunks:", scriptMatches.length);

  // Look for superadmin dashboard chunk
  let dashboardCode = "";
  for (const s of scriptMatches) {
    if (s.includes("superadmin") || s.includes("page-") || s.includes("app/")) {
      const sRes = await fetch(`https://edu.thenexaedu.com${s}`);
      const code = await sRes.text();
      if (code.includes("Overview") || code.includes("Total") || code.includes("Institutions") || code.includes("Revenue")) {
        console.log("Found chunk:", s, "Length:", code.length);
        dashboardCode += code + "\n";
      }
    }
  }

  // Find all API endpoints mentioned
  const apiMatches = Array.from(new Set(dashboardCode.match(/\/api\/[a-zA-Z0-9_\-\/]+/g) || []));
  console.log("API Endpoints in chunks:", apiMatches);

  // Call the dashboard APIs found
  for (const ep of apiMatches) {
    try {
      const res = await fetch(`https://edu.thenexaedu.com${ep}`, {
        headers: {
          Cookie: cookieHeader,
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        console.log(`\n=== API [${ep}] (HTTP ${res.status}) ===`);
        console.log(JSON.stringify(json, null, 2).slice(0, 1000));
      } else {
        console.log(`API [${ep}] -> HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`API [${ep}] Error:`, e.message);
    }
  }

  // Also search dashboard text in dashboardCode
  const textMatches = Array.from(dashboardCode.matchAll(/"([^"]{4,50})"/g))
    .map((m) => m[1])
    .filter((t) =>
      /student|school|institution|revenue|active|pending|subscription|overview|growth|metric|chart|stat/i.test(t)
    );
  console.log("\nKey UI Texts in Superadmin Dashboard:");
  console.log(Array.from(new Set(textMatches)).slice(0, 50));
}

inspectDashboard().catch(console.error);

