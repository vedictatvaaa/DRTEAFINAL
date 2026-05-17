#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(here, "..", "dist", "public");
const swPath = join(distDir, "sw.js");

const PRECACHE_EXTENSIONS = new Set([
  ".js",
  ".css",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".svg",
  ".png",
  ".webmanifest",
]);

const SKIP_TOP_LEVEL_DIRS = new Set(["images"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(distDir, full);
    const topLevel = rel.split(sep)[0];
    if (statSync(full).isDirectory()) {
      if (SKIP_TOP_LEVEL_DIRS.has(topLevel)) continue;
      out.push(...walk(full));
    } else {
      const ext = entry.slice(entry.lastIndexOf(".")).toLowerCase();
      if (entry === "sw.js") continue;
      if (entry === "opengraph.jpg") continue;
      if (entry === "robots.txt" || entry === "sitemap.xml") continue;
      if (!PRECACHE_EXTENSIONS.has(ext)) continue;
      out.push(rel.split(sep).join(posix.sep));
    }
  }
  return out;
}

const assets = walk(distDir).sort();
if (!assets.includes("index.html")) assets.unshift("index.html");
if (!assets.includes("")) assets.unshift("");

const sw = readFileSync(swPath, "utf8");
const marker = "__PRECACHE_MANIFEST__";
if (!sw.includes(marker)) {
  console.error(
    `[inject-precache] marker ${marker} not found in ${swPath}; aborting`,
  );
  process.exit(1);
}
const replaced = sw.replace(
  `"${marker}"`,
  JSON.stringify(assets, null, 2),
);
const versioned = replaced.replace(
  /const VERSION = "[^"]+"/,
  `const VERSION = "${Date.now()}"`,
);
writeFileSync(swPath, versioned);
console.log(
  `[inject-precache] wrote ${assets.length} precache entries to ${swPath}`,
);
