import esbuild from "esbuild";
import { minify } from "csso";
import { minify as minifyHtml } from "html-minifier-terser";
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

// === 6. _locales klasörünü minify ederek kopyala ===
// Whitespace kaldırır, boyutu küçültür, JSON geçerliliğini de doğrular
const walkAndMinifyJson = (srcDir, destDir) => {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      walkAndMinifyJson(srcPath, destPath);
    } else if (entry.name.endsWith(".json")) {
      const content = JSON.parse(fs.readFileSync(srcPath, "utf8"));
      fs.writeFileSync(destPath, JSON.stringify(content));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};
walkAndMinifyJson("_locales", `${distDir}/_locales`);

// === 6b. _locales key kontrolü — EN'deki her key diğer dillerde de var mı? ===
const baseLocale = JSON.parse(fs.readFileSync("_locales/en/messages.json", "utf8"));
const baseKeys = Object.keys(baseLocale);
const localeDirs = fs.readdirSync("_locales");
let localeOk = true;
for (const lang of localeDirs) {
  const filePath = `_locales/${lang}/messages.json`;
  if (!fs.existsSync(filePath)) continue;
  const locale = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const missing = baseKeys.filter(k => !(k in locale));
  if (missing.length > 0) {
    console.warn(`⚠️  ${lang}/messages.json eksik key'ler (${missing.length}): ${missing.join(", ")}`);
    localeOk = false;
  }
}
if (localeOk) console.log("✅ Tüm dil dosyaları eksiksiz.");

// === 7. HTML minify edip kopyala ===
const htmlContent = fs.readFileSync("popup.html", "utf8");
const minifiedHtml = await minifyHtml(htmlContent, {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  minifyCSS: false, // CSS ayrı dosyada zaten minify ediliyor
  minifyJS: false,  // JS ayrı dosyada zaten minify ediliyor
});
fs.writeFileSync(path.join(distDir, "popup.html"), minifiedHtml);

// === 7b. manifest.json ve icon'u kopyala (manifest whitespace'siz) ===
fs.writeFileSync(
  path.join(distDir, "manifest.json"),
  JSON.stringify(manifestJson)
);
fs.copyFileSync("icon.png", path.join(distDir, "icon.png"));

// === 8. Build-info.json oluştur (hata ayıklama için — ZIP'e GİRMEZ) ===
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

// === 9. ZIP oluştur (build-info.json hariç) ===
const createZip = () => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream("WeXProfile-Downloader.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      const bytes = archive.pointer();
      const kb = (bytes / 1024).toFixed(1);
      const mb = (bytes / 1024 / 1024).toFixed(2);
      console.log(`📦 ZIP oluşturuldu: ${kb} KB (${mb} MB)`);
      console.log(`📦 İsim: WeXProfile-Downloader.zip`);
      resolve();
    });

    archive.on("error", reject);
    archive.pipe(output);

    // build-info.json ZIP'e girmesin — sadece geliştirici için
    archive.glob("**/*", {
      cwd: distDir,
      ignore: ["build-info.json"],
    });

    archive.finalize();
  });
};

await createZip();

// === 10. Boyut özeti ===
const getDirSize = (dir) => {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += getDirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
};
const distSize = getDirSize(distDir);
const zipSize = fs.statSync("WeXProfile-Downloader.zip").size;

console.log("\n✅ Build tamamlandı!");
console.log(`📁 Dist klasörü: ${(distSize / 1024).toFixed(1)} KB`);
console.log(`📦 ZIP dosyası:  ${(zipSize / 1024).toFixed(1)} KB`);
console.log(`🏷️  Sürüm: ${manifestVersion}`);
console.log(`🔨 Commit: ${gitCommit}`);