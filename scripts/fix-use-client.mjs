import fs from "fs";
import path from "path";

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // Check if file has "use client" or 'use client'
  const match = content.match(/^(?:(?!\n)[\s\S])*?["']use client["'];?/m);
  if (!match) return;

  // Check if "use client" is already the very first statement
  const trimmed = content.trimStart();
  if (trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'")) {
    return;
  }

  // Remove all occurrences of "use client" / 'use client'
  content = content.replace(/["']use client["'];?\r?\n?/g, "");

  // Prepend "use client";\n\n at line 1
  content = `"use client";\n\n` + content.trimStart();

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Fixed:", filePath);
}

function searchDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        searchDir(fullPath);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
    ) {
      fixFile(fullPath);
    }
  }
}

searchDir("frontend/src");
console.log("Done checking all frontend files.");
