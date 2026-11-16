/**
 * @file scripts/build.js
 * @package @lucentra/extension
 * @description Production build script compiling MV3 Background, Content, and Popup bundles.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist");

async function runBuild() {
  console.log("==> Starting LUCENTRA Chrome Extension Build...");

  // Clean dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Build Background Service Worker (ES module)
  console.log("--> Building Background Service Worker (ES)...");
  await build({
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, "src/background/index.ts"),
        name: "LucentraBackground",
        formats: ["es"],
        fileName: () => "background.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 2. Build Content Script (IIFE for isolated world)
  console.log("--> Building Content Script (IIFE)...");
  await build({
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, "src/content/index.ts"),
        name: "LucentraContent",
        formats: ["iife"],
        fileName: () => "content.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 3. Build Popup Controller (ES)
  console.log("--> Building Popup Controller (ES)...");
  await build({
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, "src/popup/index.ts"),
        name: "LucentraPopup",
        formats: ["es"],
        fileName: () => "popup.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 4. Copy static assets
  console.log("--> Copying Manifest, Icons, and Popup Shell...");

  // Copy manifest.json
  fs.copyFileSync(
    path.resolve(rootDir, "manifest.json"),
    path.resolve(distDir, "manifest.json")
  );

  // Copy icons
  const iconsDist = path.resolve(distDir, "icons");
  fs.mkdirSync(iconsDist, { recursive: true });
  const iconsSrc = path.resolve(rootDir, "icons");
  for (const file of fs.readdirSync(iconsSrc)) {
    fs.copyFileSync(path.resolve(iconsSrc, file), path.resolve(iconsDist, file));
  }

  // Copy popup.html and popup.css
  let popupHtml = fs.readFileSync(path.resolve(rootDir, "src/popup/index.html"), "utf8");
  // Ensure script references popup.js
  popupHtml = popupHtml.replace('src="index.js"', 'src="popup.js"');
  fs.writeFileSync(path.resolve(distDir, "popup.html"), popupHtml, "utf8");

  fs.copyFileSync(
    path.resolve(rootDir, "src/popup/popup.css"),
    path.resolve(distDir, "popup.css")
  );

  console.log("==> Build successfully completed! Output in apps/extension/dist/");
}

runBuild().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
