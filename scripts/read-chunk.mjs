import fs from "fs";

async function readPageChunk() {
  const sRes = await fetch("https://edu.thenexaedu.com/_next/static/chunks/app/(protected)/superadmin/page-fc96efde053ff3bf.js");
  const code = await sRes.text();
  fs.writeFileSync("scripts/nexa-dashboard-code.js", code);
  console.log("Saved scripts/nexa-dashboard-code.js, length:", code.length);

  // Look for state variables, fetch calls, headers, widgets
  const fetchCalls = code.match(/fetch\([^)]+\)/g) || [];
  console.log("Fetch calls:", fetchCalls);

  // Print segments containing JSX / UI structure
  const lines = code.split(";").filter((s) => s.includes("jsx") || s.includes("Total") || s.includes("Institutions"));
  console.log("Lines sample:", lines.slice(0, 10).join("\n---\n"));
}

readPageChunk().catch(console.error);

