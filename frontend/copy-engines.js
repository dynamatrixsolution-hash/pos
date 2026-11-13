const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "../packages/db/client");
const destDir = path.resolve(__dirname, "client");

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir);
  let copiedCount = 0;
  files.forEach((file) => {
    if (file.endsWith(".node")) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file);
      try {
        if (fs.existsSync(destPath)) {
          const srcStat = fs.statSync(srcPath);
          const destStat = fs.statSync(destPath);
          if (srcStat.size === destStat.size) {
            console.log(`${file} already up to date in frontend/client directory.`);
            copiedCount++;
            return;
          }
        }
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file} to frontend/client directory.`);
        copiedCount++;
      } catch (err) {
        if (err.code === "EBUSY") {
          console.warn(`Warning: ${file} is currently locked by a running process, skipping copy.`);
          copiedCount++;
        } else {
          throw err;
        }
      }
    }
  });
  if (copiedCount === 0) {
    console.log("No query engine files (.node) found in source directory.");
  }
} else {
  console.log("Source directory packages/db/client does not exist.");
}
