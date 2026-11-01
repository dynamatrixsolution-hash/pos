import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "../packages/db/client");
const destDir = path.resolve(__dirname, "../frontend/client");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir).filter(f => f.includes("query_engine") && f.endsWith(".node"));
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    console.log(`Copied engine ${file} -> frontend/client/${file}`);
  }
} else {
  console.warn(`Source directory ${srcDir} does not exist yet.`);
}
