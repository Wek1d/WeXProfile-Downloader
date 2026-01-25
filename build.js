import esbuild from "esbuild";
import { minify } from "csso";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import archiver from "archiver";

// === 1. Sürüm ve isim bilgilerini oku ===
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;
const manifestJson = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const manifestVersion = manifestJson.version;

// Sürüm kontrolü
if (version !== manifestVersion) {
  console.warn(`⚠️  UYARI: package.json (${version}) ve manifest.json (${manifestVersion}) sürümleri farklı!`);
}

// === 2. Git commit bilgisini al (opsiyonel) ===
let gitCommit = "unknown";
try {
  gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
  console.log("Git commit alınamadı");
}

// === 3. Dist klasörünü temizle ===
const distDir = "dist";
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
fs.mkdirSync(distDir);

// === 4. JS dosyalarını minify edip kopyala ===
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

// === 5. CSS dosyalarını minify edip kopyala ===
fs.mkdirSync(`${distDir}/css`, { recursive: true });
const cssFiles = fs.readdirSync("css");
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join("css", file), "utf8");
  const minified = minify(css).css;
  fs.writeFileSync(path.join(distDir, "css", file), minified);
}

// === 6. _locales klasörünü komple kopyala ===
fs.cpSync("_locales", `${distDir}/_locales`, { recursive: true });

// === 7. HTML, manifest, icon vs. kök dosyaları kopyala ===
const rootFiles = ["manifest.json", "popup.html", "icon.png"];
for (const file of rootFiles) {
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(distDir, file));
}

// === 8. Build-info.json oluştur (hata ayıklama için) ===
const buildInfo = {
  version: manifestVersion,
  packageVersion: version,
  buildTime: new Date().toISOString(),
  gitCommit: gitCommit,
  nodeVersion: process.version
};

fs.writeFileSync(
  path.join(distDir, "build-info.json"),
  JSON.stringify(buildInfo, null, 2)
);

// === 9. ZIP oluştur ===
const createZip = () => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream("WeXProfile-Downloader.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });
    
    output.on("close", () => {
      console.log(`📦 ZIP oluşturuldu: ${archive.pointer()} bytes`);
      console.log(`📦 İsim: WeXProfile-Downloader.zip`);
      resolve();
    });
    
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize();
  });
};

await createZip();

console.log("✅ Build tamamlandı!");
console.log("📁 Dist klasörü: ./dist");
console.log("📦 ZIP dosyası: ./WeXProfile-Downloader.zip");
console.log(`🏷️  Sürüm: ${manifestVersion}`);