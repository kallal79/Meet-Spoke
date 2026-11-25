// Serve the prototype folder on localhost and run Lighthouse (mobile + desktop) against it.
// The HTML is served with a doctype + <html lang> shell, the way the Artifact viewer serves it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import { fileURLToPath } from "node:url";
import { chromePath } from "./chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Usage: npm run lighthouse   (or: node tests/lighthouse.mjs [prototype-dir] [out-dir])
const [, , dir = path.join(HERE, "..", "prototype"), outDir = path.join(HERE, "..", "test-output")] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const types = { ".html": "text/html; charset=utf-8", ".png": "image/png" };
const server = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") { res.writeHead(204); return res.end(); } // the viewer serves the artifact's own icon
  const p = path.join(dir, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(path.resolve(dir)) || !fs.existsSync(p)) { res.writeHead(404); return res.end("not found"); }
  let body = fs.readFileSync(p);
  // Same shell the Artifact viewer adds: charset + viewport in <head>, page content in <body>.
  if (p.endsWith(".html")) body = Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${body}</body></html>`);
  const gz = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream", "cache-control": "max-age=3600", ...(gz ? { "content-encoding": "gzip" } : {}) });
  res.end(gz ? zlib.gzipSync(body) : body);
}).listen(0);
const port = server.address().port;

const chrome = await chromeLauncher.launch({ chromePath: chromePath(), chromeFlags: ["--headless=new"] });
const results = {};
for (const formFactor of ["mobile", "desktop"]) {
  // Lighthouse's own presets: mobile = default (slow 4G, 4x CPU), desktop = official desktop config.
  const cfg = formFactor === "desktop" ? desktopConfig : { extends: "lighthouse:default" };
  const r = await lighthouse(`http://localhost:${port}/index.html`, { port: chrome.port, output: "json", onlyCategories: ["performance", "accessibility", "best-practices", "seo"], logLevel: "error" }, cfg);
  const lhr = r.lhr;
  results[formFactor] = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  const failing = Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual")
    .map((a) => `${a.id} (${a.score}): ${a.title}${a.displayValue ? " - " + a.displayValue : ""}`);
  results[formFactor + "_issues"] = failing;
  results[formFactor + "_metrics"] = ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"].map((id) => `${id}: ${lhr.audits[id]?.displayValue}`);
  fs.writeFileSync(path.join(outDir, `lighthouse-${formFactor}.json`), JSON.stringify(lhr));
}
await chrome.kill();
server.close();
console.log(JSON.stringify(results, null, 2));
