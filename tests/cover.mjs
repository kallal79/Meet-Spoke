// Builds a 1800x1200 (3:2) cover from the prototype screenshots.
// Usage: npm run cover   (or: node tests/cover.mjs [screens-dir] [out-png] [work-dir])
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromePath } from "./chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , screensDir = path.join(HERE, "..", "prototype", "screens"), outPng = path.join(HERE, "..", "cover.png"), workDir = path.join(HERE, "..", "test-output")] = process.argv;
const src = (n) => pathToFileURL(path.resolve(screensDir, n)).href;
fs.mkdirSync(workDir, { recursive: true });

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Figtree:wght@500;600&display=swap">
<style>
  *{box-sizing:border-box;margin:0}
  html,body{width:1800px;height:1200px;overflow:hidden}
  body{position:relative;background:#0B5A37;font-family:Figtree,system-ui,sans-serif;color:#fff}
  .wheel{position:absolute;right:-260px;top:-300px;width:1100px;height:1100px;opacity:.07;color:#fff}
  .lane{position:absolute;left:0;right:0;bottom:120px;height:6px;background:repeating-linear-gradient(90deg,#FFC53D 0 60px,transparent 60px 110px);opacity:.9}
  .copy{position:absolute;left:110px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center;gap:28px}
  .brand{display:flex;align-items:center;gap:22px;font:800 128px/1 'Bricolage Grotesque',sans-serif;letter-spacing:-.03em}
  .brand svg{width:112px;height:112px;color:#FFC53D}
  .tag{font:700 54px/1.08 'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;color:#fff}
  .tag em{font-style:normal;color:#FFC53D}
  .sub{font:500 26px/1.4 Figtree,sans-serif;color:#CDE7D6;max-width:30ch}
  .phone{position:absolute;padding:10px;border-radius:50px;background:#141B17;box-shadow:0 50px 80px -30px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.12)}
  .phone img{display:block;width:100%;border-radius:40px}
  .p1{left:742px;top:300px;width:330px;transform:rotate(-4deg)}
  .p2{left:1040px;top:200px;width:372px;z-index:2}
  .p3{left:1382px;top:300px;width:330px;transform:rotate(4deg)}
</style></head><body>
  <svg class="wheel" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M16 3v26M3 16h26M6.8 6.8l18.4 18.4M25.2 6.8 6.8 25.2" stroke="currentColor" stroke-width=".5"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>
  <div class="lane"></div>
  <div class="copy">
    <div class="brand"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 4.5v23M4.5 16h23M7.9 7.9l16.2 16.2M24.1 7.9 7.9 24.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="16" r="3.2" fill="currentColor"/></svg>Spoke</div>
    <p class="tag">Find a <em>no-drop</em> group ride near you this week.</p>
    <p class="sub">For people who are new to cycling and nervous about riding with a group.</p>
  </div>
  <div class="phone p1"><img src="${src("2-details.png")}" alt=""></div>
  <div class="phone p2"><img src="${src("1-home.png")}" alt=""></div>
  <div class="phone p3"><img src="${src("4-done.png")}" alt=""></div>
</body></html>`;

const coverHtml = path.join(workDir, "cover.html");
fs.writeFileSync(coverHtml, html);

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(coverHtml).href, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || !i.naturalWidth).length);
await page.screenshot({ path: outPng });
await browser.close();
console.log(broken ? `WARNING: ${broken} image(s) failed to load` : "cover ok: " + outPng);
