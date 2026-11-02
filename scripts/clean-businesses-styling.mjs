import fs from "fs";
import path from "path";

const filePath = path.resolve("frontend/src/app/dashboard/super-admin/businesses/page.tsx");
let content = fs.readFileSync(filePath, "utf8");

content = content.replaceAll("text-blue-600", "text-[#6B2837]");
content = content.replaceAll("bg-blue-600/10", "bg-[#6B2837]/10");
content = content.replaceAll("bg-blue-600", "bg-[#6B2837]");
content = content.replaceAll("hover:bg-blue-500", "hover:bg-[#521E2A]");
content = content.replaceAll("border-blue-600", "border-[#6B2837]");

// Replace any emojis if any exist
content = content.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");

fs.writeFileSync(filePath, content, "utf8");
console.log("Cleaned businesses/page.tsx styling and tokens!");

