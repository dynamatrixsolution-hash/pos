import fs from "fs";
import path from "path";

const srcPath = "C:/Users/HP/.gemini/antigravity/brain/8478bafc-6e66-41fb-8126-0c684df39494/.user_uploaded/media_1793533215909_02edfdaa.jpg";
const destJpg = "frontend/public/assets/register-hero.jpg";
const destSvg = "frontend/public/assets/register-hero.svg";

// 1. Copy jpg
fs.copyFileSync(srcPath, destJpg);
console.log("Saved register-hero.jpg");

// 2. Read base64
const jpgBuffer = fs.readFileSync(destJpg);
const base64Data = jpgBuffer.toString("base64");
const dataUri = `data:image/jpeg;base64,${base64Data}`;

// 3. Create SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 682 1024" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <image href="${dataUri}" width="682" height="1024" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;

fs.writeFileSync(destSvg, svgContent, "utf8");
console.log("Saved register-hero.svg (size: " + Math.round(svgContent.length / 1024) + " KB)");

