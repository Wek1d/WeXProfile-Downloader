import esbuild from "esbuild";
import { minify } from "csso";
import fs from "fs";
import path from "path";

// === 1. dist klasörünü temizle / oluştur ===
const distDir = "dist";
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
fs.mkdirSync(distDir);

// === 2. JS dosyalarını minify edip kopyala ===
fs.mkdirSync(`${distDir}/js`, { recursive: true });
const jsFiles = fs.readdirSync("js");

for (const file of jsFiles) {
  const inputPath = path.join("js", file);
  const outputPath = path.join(distDir, "js", file);

  // chart.umd.min.js zaten minify edilmiş
  if (file.includes(".min.")) {
    fs.copyFileSync(inputPath, outputPath);
    continue;
  }

  await esbuild.build({
    entryPoints: [inputPath],
    outfile: outputPath,
    minify: true,
    bundle: false,
  });
}

// === 3. CSS dosyalarını minify edip kopyala ===
fs.mkdirSync(`${distDir}/css`, { recursive: true });
const cssFiles = fs.readdirSync("css");
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join("css", file), "utf8");
  const minified = minify(css).css;
  fs.writeFileSync(path.join(distDir, "css", file), minified);
}

// === 4. _locales klasörünü komple kopyala ===
fs.cpSync("_locales", `${distDir}/_locales`, { recursive: true });

// === 5. HTML, manifest, icon vs. kök dosyaları kopyala ===
const rootFiles = ["manifest.json", "popup.html", "icon.png"];
for (const file of rootFiles) {
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(distDir, file));
}

// === 6. docs klasörünü kopyalamaya gerek yok ===
// (sadece repo için)

console.log("✅ Build tamamlandı! dist klasörü hazır.");
