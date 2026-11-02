import http from "http";

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function debugPage() {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/dashboard/super-admin",
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "text/html",
    },
  });

  console.log("Status Code:", res.statusCode);
  console.log("HTML Preview (first 1000 chars):");
  console.log(res.data.slice(0, 1000));
}

debugPage().catch(console.error);

