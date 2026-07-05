const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "../packages/db/client");
const destDir = path.resolve(__dirname, ".next/standalone/packages/db/client");

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir);
  let copiedCount = 0;
  files.forEach((file) => {
    if (file.endsWith(".node")) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      console.log(`Copied ${file} to standalone build directory.`);
      copiedCount++;
    }
  });
  if (copiedCount === 0) {
    console.log("No query engine files (.node) found in source directory.");
  }
} else {
  console.log("Source directory packages/db/client does not exist.");
}
