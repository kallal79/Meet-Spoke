// Click-through, feature, accessibility and layout checks for the Spoke prototype.
// Usage: npm test   (or: node tests/check.mjs [index.html] [screens-out-dir] [scratch-out-dir])
import puppeteer from "puppeteer-core";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromePath } from "./chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , htmlPath = path.join(HERE, "..", "prototype", "index.html"), screensDir = path.join(HERE, "..", "prototype", "screens"), scratchDir = path.join(HERE, "..", "test-output")] = process.argv;
const BASE = pathToFileURL(path.resolve(htmlPath)).href;
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
fs.mkdirSync(screensDir, { recursive: true });
fs.mkdirSync(scratchDir, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); };
// If a step crashes, say where: the last check that ran, plus the full error.
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (e) => {
    console.error(`\nTest run crashed after: "${results.at(-1)?.name || "(start)"}" (${results.length} checks done)\n${e?.stack || e}`);
    process.exit(1);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ["--allow-file-access-from-files", "--no-first-run"],
});

async function newPage(width, height, dpr = 1, scheme = "light") {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: width < 520, hasTouch: width < 520 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") page.errors.push("console: " + m.text()); });
  page.on("requestfailed", (r) => page.errors.push("requestfailed: " + r.url() + " " + (r.failure()?.errorText || "")));
  return page;
}
// Load a route with empty storage (bookings persist between pages otherwise).
async function open(page, route = "home", { keep = false } = {}) {
  if (!keep) {
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
  }
  await page.goto(BASE + "#" + route, { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(150);
}
const hash = (page) => page.evaluate(() => location.hash);
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const count = (page, sel) => page.$$eval(sel, (els) => els.length);
async function tap(page, sel) {
  await page.waitForSelector(sel, { visible: true, timeout: 3000 });
  await page.$eval(sel, (el) => el.scrollIntoView({ block: "center" }));
  await sleep(60);
  // Guard: fail loudly if something else (like a sticky bar) covers the target.
  const covered = await page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit && !el.contains(hit) && !hit.contains(el) ? (hit.className || hit.tagName) : null;
  });
  if (covered) throw new Error(`Tap target ${sel} is covered by ${covered}`);
  await page.click(sel);
  await sleep(320);
}
async function settle(page) { await page.evaluate(() => document.fonts.ready); await sleep(400); }

// ================= Core flow (the 4 mission screens) =================
const m = await newPage(390, 844);
await open(m);
await settle(m);

check("Home renders 4 ride cards", (await count(m, ".ride-card")) === 4);
check("Home headline present", (await text(m, "h1"))?.includes("first group ride"));
check("Status bar hidden on phone width", await m.$eval(".statusbar", (e) => getComputedStyle(e).display === "none"));
check("Bottom tab bar on Home with 4 tabs (Rides, Saved, Ask, My rides)", (await count(m, ".tabbar .tab")) === 4);
check("Rides tab marked current", await m.$eval('.tab[data-tab="home"]', (e) => e.getAttribute("aria-current") === "page"));

// Filters
for (const [f, n] of [["evening", 1], ["weekend", 3], ["short", 3], ["all", 4]]) {
  await tap(m, `.chip[data-value="${f}"]`);
  check(`Filter '${f}' shows ${n} rides`, (await count(m, ".ride-card")) === n, `got ${await count(m, ".ride-card")}`);
}
check("Pressed chip state follows selection", await m.$eval('.chip[data-value="all"]', (e) => e.getAttribute("aria-pressed") === "true"));

// Search
await m.type("#search", "606", { delay: 20 }); await sleep(200);
check("Search '606' finds 1 ride", (await count(m, ".ride-card")) === 1 && (await text(m, ".ride-card .rc-name"))?.includes("606"));
check("Search keeps focus while typing", await m.evaluate(() => document.activeElement?.id === "search"));
check("Ride count label updates", (await text(m, "#ride-count")) === "1 ride");
await m.click("#search", { clickCount: 3 }); await m.keyboard.type("zzzz"); await sleep(200);
check("Search with no match shows empty state", !!(await m.$(".empty-state")));
await tap(m, '[data-action="clear-filters"]');
check("'Show all rides' clears search", (await count(m, ".ride-card")) === 4 && (await m.$eval("#search", (e) => e.value)) === "");
await m.type("#search", "humboldt"); await sleep(200);
check("Search matches by park name", (await count(m, ".ride-card")) === 1);
await m.click("#search", { clickCount: 3 }); await m.keyboard.press("Backspace"); await sleep(200);

// Home -> Details -> back
await tap(m, '.ride-card[data-ride="1"]');
check("Tap ride card opens Details (#ride-1)", (await hash(m)) === "#ride-1");
check("Details shows the tapped ride", (await text(m, "h1")) === "Lakefront Sunrise Roll");
check("Details has route map", !!(await m.$(".map svg .route-line")));
check("Details shows 4 spots left before joining", (await text(m, ".cta-meta"))?.includes("4 of 12 spots left"));
await tap(m, "[data-back]");
check("Details back arrow returns Home", (await hash(m)) === "#home" && (await count(m, ".ride-card")) === 4);
for (const [id, title] of [[2, "606"], [3, "Tuesday Lights Loop"], [4, "Skills Clinic"]]) {
  await tap(m, `.ride-card[data-ride="${id}"]`);
  check(`Ride ${id} card opens its own details`, (await hash(m)) === `#ride-${id}` && (await text(m, "h1"))?.includes(title));
  await tap(m, "[data-back]");
}

// Details -> Join -> back -> Join
await tap(m, '.ride-card[data-ride="1"]');
await tap(m, '[data-cta="join"]');
check("Join this ride opens Join (#join-1)", (await hash(m)) === "#join-1");
check("Join defaults: Hybrid preselected", await m.$eval("#bike-hybrid", (e) => e.checked));
await tap(m, "[data-back]");
check("Join back arrow returns to Details", (await hash(m)) === "#ride-1");
await tap(m, '[data-cta="join"]');

await tap(m, 'label[for="bike-ebike"]');
check("Bike option selects (E-bike)", await m.$eval("#bike-ebike", (e) => e.checked));
check("Only one bike selected", (await count(m, 'input[name="bike"]:checked')) === 1);
check("Selected bike card shows check mark", await m.$eval('label[for="bike-ebike"] .opt-check', (e) => getComputedStyle(e).display !== "none"));
await tap(m, 'label[for="level-few"]');
check("Level segment selects (1–3)", await m.$eval("#level-few", (e) => e.checked));
await tap(m, 'label[for="buddy"]');
check("Buddy switch toggles off", await m.$eval("#buddy", (e) => !e.checked));
await tap(m, 'label[for="buddy"]');
check("Buddy switch toggles back on", await m.$eval("#buddy", (e) => e.checked));
await tap(m, 'label[for="remind"]');
check("Reminder switch toggles off", await m.$eval("#remind", (e) => !e.checked));
await m.keyboard.press("Tab"); // keyboard sanity: focus moves without errors

await tap(m, '[data-action="confirm"]');
check("Confirm my spot opens Done (#done-1)", (await hash(m)) === "#done-1");
check("Done headline", (await text(m, "h1"))?.startsWith("You’re in"));
check("Done screen has confetti", !!(await m.$(".confetti i")));
check("Ticket shows chosen bike (E-bike)", (await text(m, '[data-field="bike"]')) === "E-bike");
check("Ticket shows chosen level (1–3)", (await text(m, '[data-field="level"]')) === "1–3");
check("Ticket shows buddy note", (await text(m, '[data-field="buddy"]'))?.includes("Ride buddy"));
check("Ticket shows no-reminder note", (await text(m, '[data-field="remind"]'))?.includes("No reminder"));
check("Ticket rider number is 9 of 12", (await text(m, ".ticket-foot"))?.includes("Rider 9 of 12"));
await tap(m, '[data-action="calendar"]');
check("Add to calendar shows a message", await m.$eval("#toast", (e) => e.classList.contains("show") && e.textContent.includes("Saturday, 8:00 AM")));
await tap(m, '.done [data-action="share"]');
check("Invite a friend shows a share message",
  await m.waitForFunction(() => { const e = document.getElementById("toast"); return e.classList.contains("show") && /link/i.test(e.textContent); }, { timeout: 2500 }).then(() => true, () => false));
await sleep(1500);

await m.goBack(); await sleep(350);
check("Browser back from Done lands on Details, not the form", (await hash(m)) === "#ride-1", await hash(m));
check("Details shows 'You’re going' after joining", (await text(m, ".cta-bar"))?.includes("You’re going"));
await tap(m, '[data-cta="ticket"]');
check("'View my ticket' reopens Done", (await hash(m)) === "#done-1");

await tap(m, '[data-cta="home"]');
check("Back to rides returns Home", (await hash(m)) === "#home");
check("Home card shows 'You’re going'", (await text(m, '.ride-card[data-ride="1"] .rc-top'))?.includes("You’re going"));
check("Home card going count rose to 9", (await text(m, '.ride-card[data-ride="1"] .rc-going')) === "9 going");
check("My rides tab badge shows 1", (await text(m, '.tab[data-tab="mine"] .tab-badge')) === "1");

// Persistence
await m.reload({ waitUntil: "networkidle0" }); await sleep(200);
check("Booking survives a page reload", (await text(m, '.ride-card[data-ride="1"] .rc-top'))?.includes("You’re going"));

// My rides tab
await tap(m, '.tab[data-tab="mine"]');
check("My rides tab opens (#mine)", (await hash(m)) === "#mine");
check("My rides lists the booked ride", (await count(m, ".mine-card")) === 1 && (await text(m, ".mine-card"))?.includes("E-bike"));
await tap(m, '.mine-card[data-mine="1"]');
check("Ticket card in My rides opens Done", (await hash(m)) === "#done-1");

// Release + Undo (tap immediately after the screen change: taps must not be swallowed by the transition)
await m.goto(BASE + "#ride-1", { waitUntil: "networkidle0" }); await sleep(30);
await m.click('[data-action="release"]'); await sleep(320);
check("Fast tap during a screen transition still works", !(await m.$('[data-action="release"]')));
check("Release my spot restores Join button", !!(await m.$('[data-cta="join"]')));
check("Release shows an Undo button", !!(await m.$('#toast.show [data-action="undo"]')));
check("Spots back to 4 after release", (await text(m, ".cta-meta"))?.includes("4 of 12 spots left"));
if (!(await m.$('#toast.show [data-action="undo"]'))) {
  console.log("DEBUG toast:", await m.$eval("#toast", (e) => e.className + " | " + e.innerHTML), "hash:", await hash(m), "cta:", await text(m, ".cta-bar"));
}
await tap(m, '#toast [data-action="undo"]');
check("Undo brings the booking back", (await text(m, ".cta-bar"))?.includes("You’re going"));
await tap(m, '[data-action="release"]');
await sleep(200);

// Save / Saved tab
await m.goto(BASE + "#home", { waitUntil: "networkidle0" }); await sleep(250);
await tap(m, '.ride-card[data-ride="2"] [data-action="save"]');
check("Heart saves a ride (pressed)", await m.$eval('.ride-card[data-ride="2"] [data-action="save"]', (e) => e.getAttribute("aria-pressed") === "true"));
check("Tapping the heart does not open the ride", (await hash(m)) === "#home");
check("Saved tab badge shows 1", (await text(m, '.tab[data-tab="saved"] .tab-badge')) === "1");
await tap(m, '.tab[data-tab="saved"]');
check("Saved tab lists the saved ride", (await hash(m)) === "#saved" && (await count(m, ".ride-card")) === 1);
await tap(m, '.ride-card[data-ride="2"] [data-action="save"]');
check("Unsaving on Saved tab shows the empty state", !!(await m.$(".empty-state")) && (await count(m, ".ride-card")) === 0);
await tap(m, '.empty-state a[href="#home"]');
check("Empty state 'Browse rides' goes Home", (await hash(m)) === "#home");

// Waitlist for the full ride
await tap(m, '.ride-card[data-ride="4"]');
check("Full ride shows 'Join the waitlist'", !!(await m.$('[data-action="waitlist"]')) && !(await m.$('[data-cta="join"]')));
check("Waitlist count reads '2 people waiting'", (await text(m, ".cta-meta"))?.includes("2 people waiting"));
await tap(m, '.appbar [data-action="save"]');
await tap(m, "[data-back]");
check("Messages clear when you change screens", !(await m.$("#toast.show")));
await tap(m, '.ride-card[data-ride="4"] [data-action="save"]');
await tap(m, '.ride-card[data-ride="4"]');
await m.goto(BASE + "#join-4", { waitUntil: "networkidle0" }); await sleep(250);
check("Join link for a full ride redirects to Details", (await hash(m)) === "#ride-4");
await tap(m, '[data-action="waitlist"]');
check("Waitlist joined (#3 shown)", (await text(m, ".cta-meta"))?.includes("Waitlist #3"));
await tap(m, "[data-back]");
check("Home card shows waitlist position", (await text(m, '.ride-card[data-ride="4"] .rc-top'))?.includes("Waitlist #3"));
await tap(m, '.tab[data-tab="mine"]');
check("My rides lists the waitlisted ride", (await text(m, ".stack"))?.includes("On the waitlist"));
await tap(m, '.mine-card[data-mine="4"]');
await tap(m, '[data-action="unwait"]');
check("Leave waitlist works", !!(await m.$('[data-action="waitlist"]')));

// Share on details
await tap(m, '.appbar [data-action="share"]');
check("Share button on Details shows a message",
  await m.waitForFunction(() => document.getElementById("toast").classList.contains("show"), { timeout: 2500 }).then(() => true, () => false));
// Regression: a slow share result must not replace a newer message
await tap(m, '.appbar [data-action="share"]');
await tap(m, '[data-action="waitlist"]');
await sleep(1600);
check("Late share result does not cover a newer message", (await text(m, "#toast"))?.includes("waitlist"));
await tap(m, '[data-action="unwait"]');

// Theme toggle
await m.goto(BASE + "#home", { waitUntil: "networkidle0" }); await sleep(200);
const bgBefore = await m.evaluate(() => getComputedStyle(document.body).backgroundColor);
await tap(m, '.topbar [data-action="theme"]');
const bgAfter = await m.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("Dark mode toggle changes the colors", bgBefore !== bgAfter && (await m.evaluate(() => document.documentElement.dataset.theme)) === "dark");
check("Active-tab marker stays inside the tab bar", await m.$eval('.tab[aria-current="page"]', (t) => {
  const bar = t.closest(".tabbar").getBoundingClientRect(); const mk = getComputedStyle(t, "::before");
  return t.getBoundingClientRect().top + parseFloat(mk.top) >= bar.top - 0.5;
}));
check("Theme button label updates", (await m.$eval('.topbar [data-action="theme"]', (e) => e.getAttribute("aria-label"))) === "Switch to light mode");
await m.reload({ waitUntil: "networkidle0" }); await sleep(200);
check("Dark mode is remembered after reload", (await m.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await tap(m, '.topbar [data-action="theme"]');

// ---------- Round 3 features ----------
await open(m, "home");
check("Rides sorted soonest first by default (Sat 8 AM, Sat 11 AM, Sun, Tue)",
  JSON.stringify(await m.$$eval(".ride-card", (els) => els.map((e) => e.dataset.ride))) === JSON.stringify(["1", "4", "2", "3"]));
await m.select("#sort", "shortest"); await sleep(200);
check("Sort 'Shortest ride' puts the 3.2 mi clinic first", (await m.$eval(".ride-card", (e) => e.dataset.ride)) === "4");
await m.select("#sort", "spots"); await sleep(200);
check("Sort 'Most spots open' puts the 9-spot ride first", (await m.$eval(".ride-card", (e) => e.dataset.ride)) === "3");
check("'Picked for you' sort is hidden before answering questions", !(await m.$('#sort option[value="picked"]')));

// Personalize sheet
await tap(m, '[data-action="open-sheet"]');
check("Personalize sheet opens as a dialog", !!(await m.$('#sheet:not([hidden]) [role="dialog"][aria-modal="true"]')));
check("Focus moves into the sheet", await m.evaluate(() => !!document.activeElement.closest("#sheet")));
check("Rest of the app is inert while the sheet is open", await m.evaluate(() => document.getElementById("app").hasAttribute("inert")));
for (let i = 0; i < 12; i++) await m.keyboard.press("Tab");
check("Tab key stays inside the sheet", await m.evaluate(() => !!document.activeElement.closest("#sheet")));
await m.keyboard.press("Escape"); await sleep(200);
check("Esc closes the sheet and returns focus", (await m.$("#sheet[hidden]")) && await m.evaluate(() => document.activeElement.dataset.action === "open-sheet"));
await tap(m, '[data-action="open-sheet"]');
await tap(m, '#sheet [data-k="level"][data-v="none"]');
await tap(m, '#sheet [data-k="bike"][data-v="share"]');
check("Sheet single-choice updates", await m.$eval('#sheet [data-k="bike"][data-v="share"]', (e) => e.getAttribute("aria-pressed") === "true"));
check("Weekend preselected in the sheet", await m.$eval('#sheet [data-k="times"][data-v="weekend"]', (e) => e.getAttribute("aria-pressed") === "true"));
await tap(m, '#sheet [data-action="save-prefs"]');
check("Saving picks closes the sheet", !!(await m.$("#sheet[hidden]")));
check("Rides marked 'Picked for you' (606 + clinic)",
  JSON.stringify(await m.$$eval(".ride-card", (els) => els.filter((e) => e.querySelector(".stat-pick")).map((e) => e.dataset.ride).sort())) === JSON.stringify(["2", "4"]));
check("Sort switches to 'Picked for you' (best match first)", (await m.$eval("#sort", (e) => e.value)) === "picked" && (await m.$eval(".ride-card", (e) => e.dataset.ride)) === "4");
check("Tune card shows the answers", (await text(m, ".tune"))?.includes("Brand new"));
await m.reload({ waitUntil: "networkidle0" }); await sleep(200);
check("Picks survive a reload", (await count(m, ".stat-pick")) === 2);
await tap(m, '.ride-card[data-ride="1"]'); await tap(m, '[data-cta="join"]');
check("Answers prefill the Join form (Bike share, None yet)", await m.$eval("#bike-share", (e) => e.checked) && await m.$eval("#level-none", (e) => e.checked));
await tap(m, "[data-back]"); await tap(m, "[data-back]");

// Map view
await tap(m, '[data-action="view"][data-value="map"]');
check("Map view shows 4 pins and a 'you are here' dot", (await count(m, ".pin")) === 4 && !!(await m.$(".you-dot")));
await tap(m, '.pin[data-id="3"]');
check("Tapping a pin selects it and previews that ride", await m.$eval('.pin[data-id="3"]', (e) => e.getAttribute("aria-pressed") === "true") && (await m.$eval(".ride-card", (e) => e.dataset.ride)) === "3");
await tap(m, '.chip[data-value="weekend"]');
check("Filters apply to the map (3 weekend pins)", (await count(m, ".pin")) === 3);
await tap(m, '.chip[data-value="all"]');
await tap(m, '.ride-card[data-ride="3"]');
check("Map preview card opens the ride", (await hash(m)) === "#ride-3");
check("Details has a Google Maps directions link", (await m.$eval("[data-dir]", (a) => a.href.startsWith("https://www.google.com/maps/") && a.target === "_blank")));
await tap(m, "[data-back]");
check("Map view is kept when you come back", (await count(m, ".pin")) === 4);
await tap(m, '[data-action="view"][data-value="list"]');
check("List view comes back", (await count(m, ".pin")) === 0 && (await count(m, ".ride-card")) === 4);

// Next ride banner + check-in code
await tap(m, '.ride-card[data-ride="2"]'); await tap(m, '[data-cta="join"]'); await tap(m, '[data-action="confirm"]');
check("Ticket shows a check-in code (SPK-209)", (await text(m, '[data-field="code"]')) === "SPK-209");
check("Ticket has a directions link", !!(await m.$(".ticket [data-dir]")));
await tap(m, '[data-cta="home"]');
check("Home shows 'Your next ride' banner", (await text(m, ".next"))?.includes("606"));
await tap(m, ".next");
check("Next-ride banner opens the ticket", (await hash(m)) === "#done-2");

// Keyboard shortcuts + swipe back
await m.goto(BASE + "#home", { waitUntil: "networkidle0" }); await sleep(300);
await m.evaluate(() => document.activeElement && document.activeElement.blur());
await m.keyboard.press("/"); await sleep(100);
check("'/' jumps to search", await m.evaluate(() => document.activeElement?.id === "search"));
await m.goto(BASE + "#ride-1", { waitUntil: "networkidle0" }); await sleep(300);
await m.keyboard.press("Escape"); await sleep(300);
check("Esc goes back from Details to Home", (await hash(m)) === "#home");
await m.goto(BASE + "#join-1", { waitUntil: "networkidle0" }); await sleep(300);
await m.evaluate(() => {
  const app = document.getElementById("app");
  const mk = (type, x, y) => {
    const t = new Touch({ identifier: 1, target: app, clientX: x, clientY: y });
    app.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [t], changedTouches: [t], bubbles: true }));
  };
  mk("touchstart", 8, 400); mk("touchend", 160, 410);
});
await sleep(300);
check("Swipe from the left edge goes back (Join → Details)", (await hash(m)) === "#ride-1");

// ---------- Research-driven details ----------
await open(m, "ride-2");
check("Details shows pace level + 'average, not counting stops'", (await text(m, "[data-pace]"))?.includes("Easy pace") && (await text(m, "[data-pace]"))?.includes("not counting stops"));
check("Details shows the repeat schedule", (await text(m, "[data-pace]"))?.includes("Every Sunday"));
await open(m, "join-2");
check("Join screen has a privacy promise", (await text(m, "[data-privacy]"))?.includes("never shows your rides or location publicly"));

// ---------- AI assistant: built-in helper (local file has no Claude) ----------
const lastBot = () => m.$$eval('#msgs .msg-bot:not([data-by="intro"]):not([data-busy])', (els) => {
  const e = els[els.length - 1]; return e ? { text: e.textContent.replace(/\s+/g, " "), rides: [...e.querySelectorAll(".ask-ride")].map((a) => a.getAttribute("href")), by: e.dataset.by } : null;
});
const askQ = async (q) => {
  await m.click("#ask-input", { clickCount: 3 }); await m.keyboard.press("Backspace");
  await m.type("#ask-input", q); await m.keyboard.press("Enter");
  await m.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });
  await sleep(100);
  return lastBot();
};
await open(m, "home");
await tap(m, '.tab[data-tab="ask"]');
check("Ask tab opens the assistant (#ask)", (await hash(m)) === "#ask" && (await text(m, "h1")) === "Ask Spoke");
check("Assistant says it's using the built-in helper locally", (await text(m, "#engine"))?.includes("Built-in helper"));
check("Assistant shows 5 suggested questions", (await count(m, '[data-action="ask-suggest"]')) === 5);
await tap(m, '[data-action="ask-suggest"][data-q="Which ride is best for a first-timer?"]');
await m.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });
let b = await lastBot();
check("Suggestion: first-timer answer recommends gentle rides", b?.text.includes("606") && b.rides.includes("#ride-2") && b.rides.includes("#ride-4"), JSON.stringify(b));
check("Input bar sits flush on the tab bar (no see-through gap)", await m.evaluate(() =>
  Math.abs(document.querySelector(".composer").getBoundingClientRect().bottom - document.querySelector(".dock .tabbar").getBoundingClientRect().top) < 1));
check("Question bubble shows what was asked", (await text(m, "#msgs .msg-user")) === "Which ride is best for a first-timer?");
b = await askQ("What should I bring to the 606 ride?");
check("Answers what to bring for a named ride", b?.text.toLowerCase().includes("bell") && b.rides.includes("#ride-2"), JSON.stringify(b));
check("Newest answer is fully visible above the input bar", await m.evaluate(() => {
  const last = [...document.querySelectorAll("#msgs .msg-bot")].pop().getBoundingClientRect();
  return last.bottom <= document.querySelector(".dock").getBoundingClientRect().top + 1 && last.top >= 0;
}));
b = await askQ("I don't own a bike. Can I still come?");
check("Answers 'no bike' with bike share + dock", /bike share/i.test(b?.text) && /dock/i.test(b?.text), JSON.stringify(b));
b = await askQ("Any rides on a weeknight?");
check("Answers weeknight question with the Tuesday ride", b?.text.includes("Tuesday Lights Loop") && b.rides.includes("#ride-3"), JSON.stringify(b));
b = await askQ("Where do we meet for the clinic?");
check("Answers meeting point for a named ride", b?.text.includes("Humboldt Park boathouse"), JSON.stringify(b));
b = await askQ("How much does it cost?");
check("Answers cost (free)", /free/i.test(b?.text), JSON.stringify(b));
b = await askQ("What does no-drop mean?");
check("Explains no-drop", /nobody gets left behind/i.test(b?.text), JSON.stringify(b));
b = await askQ("Will it rain on Saturday?");
check("Admits it can't see the weather (no made-up forecast)", /can't see the forecast/i.test(b?.text), JSON.stringify(b));
b = await askQ("Is the Lakefront ride right for me?");
check("Fit check for a named ride uses its real pace", b?.text.includes("10–12 mph") && b.rides.includes("#ride-1"), JSON.stringify(b));
b = await askQ("purple elephant");
check("Unknown question gets a helpful fallback", /I can help with/i.test(b?.text), JSON.stringify(b));
await askQ('<img src=x onerror="window.__xss=1">');
check("Typed HTML is shown as text, never run", !(await m.$("#msgs img")) && !(await m.evaluate(() => window.__xss)));
check("Input clears after sending and keeps focus", (await m.$eval("#ask-input", (e) => e.value)) === "" && await m.evaluate(() => document.activeElement?.id === "ask-input"));
await tap(m, '#msgs .ask-ride[href="#ride-1"]');
check("Ride link in an answer opens that ride", (await hash(m)) === "#ride-1");
await tap(m, '[data-action="ask-about"]');
check("'Ask about this ride' opens the assistant with a question ready", (await hash(m)) === "#ask" && (await m.$eval("#ask-input", (e) => e.value)) === "Is the Lakefront ride good for a beginner?" && await m.evaluate(() => document.activeElement?.id === "ask-input"));
check("Conversation is kept when you come back", (await count(m, "#msgs .msg-user")) >= 10);
await tap(m, '[data-action="ask-clear"]');
check("New chat clears the conversation", (await count(m, "#msgs .msg-user")) === 0);
await m.focus("#ask-input");
await m.keyboard.press("Escape"); await sleep(150);
check("First Esc clears the typed question", (await hash(m)) === "#ask" && (await m.$eval("#ask-input", (e) => e.value)) === "");
await m.keyboard.press("Escape"); await sleep(300);
check("Second Esc leaves the assistant", (await hash(m)) === "#home");

// ---------- AI assistant: smarter built-in helper ----------
await open(m, "ask");
b = await askQ("wat shoud i brng to the lakefrnt ride");
check("Understands typos (brng / lakefrnt → bring / lakefront)", b?.text.toLowerCase().includes("gloves") && b.rides.includes("#ride-1"), JSON.stringify(b));
b = await askQ("Tell me about the clinic");
b = await askQ("Where do we meet for it?");
check("Remembers the ride you were talking about ('it' = the clinic)", b?.text.includes("Humboldt Park boathouse"), JSON.stringify(b));
b = await askQ("What should I bring and where do we meet for the 606 ride?");
check("Answers two-part questions (bring + meeting point)", b?.text.toLowerCase().includes("bell") && b.text.includes("Walsh Park"), JSON.stringify(b));
b = await askQ("How long does the 606 ride take?");
check("Answers how long a ride takes", /about 50 min/i.test(b?.text) && b.text.includes("10:00 AM"), JSON.stringify(b));
b = await askQ("How do I join?");
check("Explains how to join", b?.text.includes("Confirm my spot"), JSON.stringify(b));
b = await askQ("Is there a ride on Saturday?");
check("'Is there' isn't misread as 'where' (typo fixer leaves real words alone)", b?.text.includes("This weekend") && !b.text.includes("Meeting points"), JSON.stringify(b));
b = await askQ("thanks!");
check("Replies politely to thanks", /welcome/i.test(b?.text), JSON.stringify(b));

// Follow-up chips + one-tap actions
await tap(m, '[data-action="ask-clear"]');
b = await askQ("Tell me about the 606 ride");
check("'Ask next' chips follow the ride you asked about", (await m.$$eval('[data-action="ask-suggest"]', (els) => els.map((e) => e.dataset.q))).every((q) => q.includes("the 606 ride")));
await tap(m, '[data-action="ask-suggest"][data-q="What should I bring to the 606 ride?"]');
await m.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });
b = await lastBot();
check("Tapping a follow-up chip asks it", b?.text.toLowerCase().includes("bell"), JSON.stringify(b));
check("'Ask next' never repeats a topic you already asked (even with typos)", await (async () => {
  b = await askQ("wat shoud i brng to the lights loop");
  const qs = await m.$$eval('[data-action="ask-suggest"]', (els) => els.map((e) => e.dataset.q));
  return qs.length > 0 && qs.every((q) => !q.startsWith("What should I bring") && q.includes("the Lights Loop"));
})());
b = await askQ("Tell me about the 606 ride");
check("After an answer, the 'Ask next' chips are visible above the input bar", await m.evaluate(() => {
  const s = document.querySelector(".suggest").getBoundingClientRect(), d = document.querySelector(".dock").getBoundingClientRect();
  return s.bottom <= d.top + 1 && s.height > 0;
}));
check("Answer shows Join / Save / Directions buttons", !!(await m.$('#msgs .msg-bot:last-of-type [data-bot-join="2"]')) && !!(await m.$('#msgs .msg-bot:last-of-type .bot-act[data-action="save"][data-id="2"]')) && !!(await m.$('#msgs .msg-bot:last-of-type .bot-act[href^="https://www.google.com/maps/"]')));
await tap(m, '#msgs .msg-bot:last-of-type .bot-act[data-action="save"][data-id="2"]');
check("'Save' in an answer saves the ride and turns into 'Saved'", (await text(m, '.tab[data-tab="saved"] .tab-badge')) === "1" && (await text(m, "#msgs .msg-bot:last-of-type .bot-acts"))?.includes("Saved") && (await hash(m)) === "#ask");
await tap(m, '#msgs .msg-bot:last-of-type [data-bot-join="2"]');
check("'Join' in an answer opens the Join screen", (await hash(m)) === "#join-2");
await m.goto(BASE + "#ask", { waitUntil: "networkidle0" }); await sleep(250);
b = await askQ("Is there a waitlist?");
await tap(m, '#msgs .msg-bot:last-of-type .bot-act[data-action="waitlist"][data-id="4"]');
check("'Join waitlist' in an answer works (#3)", (await text(m, "#msgs .msg-bot:last-of-type .bot-acts"))?.includes("Waitlist #3"));
await tap(m, '#msgs .msg-bot:last-of-type [data-action="ask-copy"]');
check("Copy button gives feedback", await m.waitForFunction(() => document.getElementById("toast").classList.contains("show"), { timeout: 2500 }).then(() => true, () => false));
check("Read aloud is hidden where voice isn't offered", !(await m.$('[data-action="ask-speak"]')) && !(await m.$('[data-action="ask-mic"]')));

// Survives reload; floating bot
const before = await count(m, "#msgs .msg-user");
await m.reload({ waitUntil: "networkidle0" }); await sleep(300);
check("Conversation survives a page reload", (await count(m, "#msgs .msg-user")) === before && before > 0);
await m.goto(BASE + "#home", { waitUntil: "networkidle0" }); await sleep(250);
check("Floating bot is hidden on Home (the Ask tab is there)", await m.$eval("#bot-fab", (e) => e.hidden));
await m.goto(BASE + "#ride-3", { waitUntil: "networkidle0" }); await sleep(250);
check("Floating 'Ask Spoke' bot shows on ride screens", await m.$eval("#bot-fab", (e) => !e.hidden && e.getBoundingClientRect().height > 0));
check("Scrolled to the end, nothing on the ride screen stays under the floating bot", await m.evaluate(async () => {
  window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 100));
  const f = document.getElementById("bot-fab").getBoundingClientRect();
  return ![...document.querySelectorAll(".stack-lg li, .stack-lg p")].some((el) => {
    const r = el.getBoundingClientRect(); return r.bottom > f.top && r.top < f.bottom && r.right > f.left && r.left < f.right;
  });
}));
check("Floating bot doesn't cover the main button", await m.evaluate(() => {
  const f = document.getElementById("bot-fab").getBoundingClientRect(), c = document.querySelector(".cta-bar").getBoundingClientRect();
  return f.bottom <= c.top;
}));
await tap(m, "#bot-fab");
check("Floating bot opens the assistant with a question about that ride", (await hash(m)) === "#ask" && (await m.$eval("#ask-input", (e) => e.value)) === "Is the Lights Loop good for a beginner?");
await m.keyboard.press("Enter");
await m.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });
b = await lastBot();
check("…and the helper answers it about the right ride", b?.text.includes("Tuesday Lights Loop") && b.text.includes("9–11 mph"), JSON.stringify(b));
await tap(m, '[data-action="ask-clear"]');

// ---------- AI assistant: Claude path (simulated claude.ai viewer) ----------
async function claudePage(mode, extra = {}) {
  const p = await newPage(390, 844);
  await p.evaluateOnNewDocument((mode, extra) => {
    const wait = () => new Promise((r) => { window.__next = r; });
    const fn = async (turns, opts) => {
      window.__calls = (window.__calls || 0) + 1;
      window.__turns = turns; window.__opts = { modelTier: opts.modelTier, cache: opts.cache, hasSignal: !!opts.signal, streams: typeof opts.onText === "function" };
      if (mode === "deny") throw { code: "not_granted", message: "no" };
      if (mode === "slow") return new Promise((res, rej) => opts.signal.addEventListener("abort", () => rej({ code: "cancelled" })));
      if (mode === "stream") {
        const chunks = ["Try the 606", "Try the 606 ride on Sunday.\nRID", "Try the 606 ride on Sunday.\nRIDES: 2, 99, 2"];
        for (const c of chunks) { opts.onText({ text: c, delta: "" }); await wait(); }
        return { text: chunks[2], truncated: false };
      }
      if (mode === "noids") { const t = "The First-Timer Skills Clinic is the gentlest."; opts.onText({ text: t, delta: t }); return { text: t, truncated: true }; }
      const t = "Try <b>Coffee & Cranks</b> on Sunday.\nRIDES: 2, 99, 2";
      opts.onText({ text: t, delta: t });
      return { text: t, truncated: false };
    };
    let dictCb = {}, ttsCb = null;
    const dictation = { onPartial: (f) => { dictCb.p = f; }, onFinal: (f) => { dictCb.f = f; }, onState: (f) => { dictCb.s = f; },
      start: async () => { window.__dictStarted = true; dictCb.s({ state: "listening" }); dictCb.p({ text: "what should" }); dictCb.f({ text: "what should I bring" }); },
      stop: async () => { dictCb.s({ state: "idle", reason: "stopped" }); } };
    const tts = { onState: (f) => { ttsCb = f; }, speak: async (text) => { window.__spoken = text; ttsCb({ state: "speaking" }); }, stop: () => { window.__ttsStopped = true; ttsCb({ state: "idle", reason: "viewer_stopped" }); } };
    window.claude = { use: async (name) => name === "sample" ? fn : (extra.voice && name === "dictation") ? dictation : (extra.voice && name === "tts") ? tts : null };
  }, mode, extra);
  await p.goto(BASE, { waitUntil: "networkidle0" });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(BASE + "#ask", { waitUntil: "networkidle0" }); await p.reload({ waitUntil: "networkidle0" }); await sleep(250);
  return p;
}
const waitIdle = (p) => p.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });

const c1 = await claudePage("ok");
check("Inside claude.ai the badge says 'Answers by Claude'", (await text(c1, "#engine"))?.includes("Answers by Claude"));
await c1.type("#ask-input", "Which ride is best for me?"); await c1.keyboard.press("Enter");
await waitIdle(c1);
const cr = await c1.$$eval('#msgs .msg-bot[data-by="claude"]', (els) => els.map((e) => ({ text: e.textContent, rides: [...e.querySelectorAll(".ask-ride")].map((a) => a.getAttribute("href")), bold: !!e.querySelector("b") })));
check("Claude's answer is shown without the RIDES line", cr.length === 1 && cr[0].text.includes("Coffee & Cranks") && !cr[0].text.includes("RIDES"), JSON.stringify(cr));
check("Claude's HTML is shown as text, not markup", cr[0] && !cr[0].bold);
check("Unknown and duplicate ride ids from Claude are dropped", JSON.stringify(cr[0]?.rides) === JSON.stringify(["#ride-2"]));
check("Claude's answer gets one-tap actions too", !!(await c1.$('#msgs [data-bot-join="2"]')));
const sent = await c1.evaluate(() => ({ turns: window.__turns, opts: window.__opts }));
const first = sent.turns[0].content;
check("Claude gets every ride's data", ["Lakefront Sunrise Roll", "Coffee & Cranks on The 606", "Tuesday Lights Loop", "First-Timer Skills Clinic", "Walsh Park", "Humboldt Park boathouse", "10–12"].every((s) => first.includes(s)));
check("Claude gets the rules of the app (free, no-drop, releasing, privacy)", ["Every ride is free", "No-drop", "release your spot up to 2 hours", "Only the ride leader sees"].every((s) => first.includes(s)));
check("Claude is told to answer only from the data, follow 'it', and match the rider's language", first.includes("ONLY the app data") && first.includes("Never invent") && first.includes('"it"') && first.includes("language the rider writes in"));
check("Conversation turns start and end with the rider", sent.turns[0].role === "user" && sent.turns[sent.turns.length - 1].role === "user" && sent.turns[sent.turns.length - 1].content === "Which ride is best for me?");
check("Chat calls stream, skip the cache and are stoppable", sent.opts.cache === false && sent.opts.hasSignal && sent.opts.streams && sent.opts.modelTier === "quick");
await c1.type("#ask-input", "Where do we meet for it?"); await c1.keyboard.press("Enter");
await waitIdle(c1);
const t2 = await c1.evaluate(() => window.__turns);
check("Follow-ups send the earlier answer back with its rides", t2.some((t) => t.role === "assistant" && t.content.includes("RIDES: 2")) && t2[t2.length - 1].content === "Where do we meet for it?");
await c1.close();

const c4 = await claudePage("stream");
await c4.type("#ask-input", "Best ride?"); await c4.keyboard.press("Enter");
await c4.waitForFunction(() => document.getElementById("stream-text")?.textContent === "Try the 606", { timeout: 3000 });
check("Claude's answer streams in as it's written", true);
await c4.evaluate(() => window.__next());
await c4.waitForFunction(() => document.getElementById("stream-text")?.textContent.includes("Sunday."), { timeout: 3000 });
check("A half-written RIDES line never flashes on screen", !(await text(c4, "#stream-text")).includes("RID"));
await c4.evaluate(() => window.__next());
await c4.waitForFunction(() => window.__next && document.querySelector("#stream-text"), { timeout: 3000 }).catch(() => {});
await c4.evaluate(() => window.__next && window.__next());
await waitIdle(c4);
check("Streamed answer settles with clean text and its ride link", (await text(c4, '#msgs .msg-bot[data-by="claude"]'))?.includes("Try the 606 ride on Sunday.") && !(await text(c4, '#msgs .msg-bot[data-by="claude"]')).includes("RID") && !!(await c4.$('#msgs .msg-bot[data-by="claude"] .ask-ride[href="#ride-2"]')));
await c4.close();

const c5 = await claudePage("noids");
await c5.type("#ask-input", "Gentlest ride?"); await c5.keyboard.press("Enter");
await waitIdle(c5);
check("Without a RIDES line, rides named in the answer still get links", !!(await c5.$('#msgs .msg-bot[data-by="claude"] .ask-ride[href="#ride-4"]')));
check("A cut-short answer says so", (await text(c5, "#msgs .msg-note"))?.includes("cut short"));
await c5.close();

const c2 = await claudePage("deny");
await c2.type("#ask-input", "What should I bring?"); await c2.keyboard.press("Enter");
await waitIdle(c2);
check("If the viewer declines Claude, the built-in helper still answers", (await c2.$eval("#msgs .msg-bot:last-of-type", (e) => e.dataset.by)) === "offline" && /helmet/i.test(await text(c2, "#msgs .msg-bot:last-of-type")));
check("Badge switches to 'Built-in helper' after a decline", (await text(c2, "#engine"))?.includes("Built-in helper"));
await c2.type("#ask-input", "How much does it cost?"); await c2.keyboard.press("Enter");
await waitIdle(c2);
check("After a decline it never asks Claude again", (await c2.evaluate(() => window.__calls)) === 1);
await c2.close();

const c3 = await claudePage("slow");
await c3.type("#ask-input", "Tell me about the rides"); await c3.keyboard.press("Enter");
await c3.waitForSelector('[data-action="ask-stop"]', { timeout: 3000 });
check("While Claude thinks, a Stop button and typing dots show", !!(await c3.$("#msgs [data-busy] .typing")));
await c3.click('[data-action="ask-stop"]');
await waitIdle(c3);
check("Stop cancels the answer cleanly", (await text(c3, "#msgs .msg-bot:last-of-type"))?.includes("Stopped"));
await c3.close();

// Voice (simulated dictation + read-aloud)
const c6 = await claudePage("ok", { voice: true });
check("Mic button appears where voice input is offered", !!(await c6.$('[data-action="ask-mic"]')));
await c6.click('[data-action="ask-mic"]'); await sleep(100);
check("Mic starts dictation and fills the question", (await c6.evaluate(() => window.__dictStarted)) && (await c6.$eval("#ask-input", (e) => e.value)) === "what should I bring");
check("Mic shows it's listening", (await c6.$eval('[data-action="ask-mic"]', (e) => e.getAttribute("aria-pressed"))) === "true");
await c6.click('[data-action="ask-mic"]'); await sleep(100);
check("Tapping the mic again stops listening", (await c6.$eval('[data-action="ask-mic"]', (e) => e.getAttribute("aria-pressed"))) === "false");
await c6.keyboard.press("Enter"); await c6.focus("#ask-input"); await c6.keyboard.press("Enter");
await c6.click('[data-action="ask-mic"]').catch(() => {});
await c6.evaluate(() => document.getElementById("ask-form").requestSubmit());
await waitIdle(c6);
await c6.click('#msgs .msg-bot:last-of-type [data-action="ask-speak"]'); await sleep(100);
check("Read aloud speaks the answer's text", (await c6.evaluate(() => window.__spoken))?.includes("Coffee & Cranks"));
check("Read aloud button turns into Stop while speaking", (await text(c6, '#msgs .msg-bot:last-of-type [data-action="ask-speak"]')) === "Stop");
await c6.click('#msgs .msg-bot:last-of-type [data-action="ask-speak"]'); await sleep(100);
check("Stop ends the reading", (await c6.evaluate(() => window.__ttsStopped)) && (await text(c6, '#msgs .msg-bot:last-of-type [data-action="ask-speak"]')) === "Read aloud");
await c6.close();

// ---------- Messages (toasts) ----------
await open(m, "join-1"); await m.click('[data-action="confirm"]'); await sleep(300);
await m.goto(BASE + "#ride-1", { waitUntil: "networkidle0" }); await sleep(300);
await tap(m, '.appbar [data-action="save"]');
check("Success messages show a check icon", (await m.$eval("#toast", (e) => e.dataset.kind)) === "success" && !!(await m.$("#toast .t-ic svg")));
check("Plain messages have no countdown bar", !(await m.$("#toast .t-bar")));
await tap(m, '.appbar [data-action="save"]');
check("'Removed' messages use the info icon", (await m.$eval("#toast", (e) => e.dataset.kind)) === "info");
await sleep(3000);
await tap(m, '[data-action="release"]');
check("Undo message shows a countdown bar", !!(await m.$("#toast.show .t-bar")));
check("Messages never overlap the floating bot", await m.evaluate(() => {
  const t = document.getElementById("toast").getBoundingClientRect(), f = document.getElementById("bot-fab").getBoundingClientRect();
  return t.bottom <= f.top || t.top >= f.bottom || t.right <= f.left || t.left >= f.right;
}));
check("Undo button says what it undoes (screen readers)", (await m.$eval('#toast [data-action="undo"]', (e) => e.getAttribute("aria-label"))) === "Undo: Your spot is released");
await m.hover('#toast [data-action="undo"]');
await sleep(7000);
check("Pointer on the message pauses it (still there after 7 s)", !!(await m.$("#toast.show.paused")));
await m.mouse.move(5, 5);
await sleep(6800);
check("Moving away resumes the countdown, then it closes", !(await m.$("#toast.show")));
await m.goto(BASE + "#ride-4", { waitUntil: "networkidle0" }); await sleep(300);
await tap(m, '[data-action="waitlist"]'); await sleep(200);
await tap(m, '[data-action="unwait"]');
await m.focus('#toast [data-action="undo"]');
await sleep(3500);
check("Keyboard focus on Undo also pauses it", !!(await m.$("#toast.show.paused")));
await m.keyboard.press("Escape"); await sleep(250);
check("Esc on the Undo message closes it without leaving the screen", !(await m.$("#toast.show")) && (await hash(m)) === "#ride-4");

// Deep links
await open(m, "done-2");
check("Deep link to Done without joining redirects to Join", (await hash(m)) === "#join-2", await hash(m));
await open(m, "ride-99");
check("Unknown ride link falls back to Home", (await count(m, ".ride-card")) === 4);
await open(m, "saved");
check("Deep link to Saved works", (await hash(m)) === "#saved" && !!(await m.$(".empty-state")));

// Dead-control audit
const KNOWN = new Set(["filter", "confirm", "calendar", "release", "restart", "save", "share", "waitlist", "unwait", "theme", "clear-filters", "undo", "view", "pin", "open-sheet", "ask-suggest", "ask-stop", "ask-clear", "ask-about", "ask-copy", "ask-speak", "ask-mic"]);
const dead = [];
for (const route of ["home", "ride-1", "ride-4", "join-1", "saved", "mine", "ask"]) {
  await open(m, route);
  const controls = await m.$$eval("#app a, #app button, #app input, #app select", (els) => els.map((e) => ({
    tag: e.tagName, href: e.getAttribute("href"), action: e.dataset.action || null, name: e.name || null, id: e.id || null,
    type: e.getAttribute("type"), form: e.form ? e.form.id : null,
    label: (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
  })));
  for (const c of controls) {
    const ok = (c.tag === "A" && /^(#(home|saved|mine|ask|ride-\d+|join-\d+|done-\d+)|https:\/\/www\.google\.com\/maps\/.+)$/.test(c.href || "")) ||
      (c.tag === "SELECT" && c.id === "sort") ||
      (c.tag === "BUTTON" && c.type === "submit" && c.form === "ask-form") ||
      (c.tag === "INPUT" && c.id === "ask-input") ||
      (c.tag === "BUTTON" && KNOWN.has(c.action)) ||
      (c.tag === "INPUT" && (c.name === "bike" || c.name === "level" || ["buddy", "remind", "search"].includes(c.id)));
    if (!ok) dead.push(`${route}: ${c.tag} "${c.label}"`);
  }
}
check("No dead buttons or links on any screen", dead.length === 0, dead.join("; "));
check("No JS errors during the phone run", m.errors.length === 0, m.errors.join(" | "));

// ================= Accessibility (axe-core, WCAG 2.1 AA) =================
for (const scheme of ["light", "dark"]) {
  const a = await newPage(390, 844, 1, scheme);
  await a.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
  const issues = [];
  for (const route of ["home", "ride-1", "ride-4", "join-1", "saved", "mine", "done", "map", "sheet", "ask", "ask-chat"]) {
    if (route === "ask-chat") {
      await open(a, "ask"); await a.click('[data-action="ask-suggest"]');
      await a.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });
    } else if (route === "done") {
      await open(a, "join-1"); await a.click('[data-action="confirm"]'); await sleep(400);
    } else if (route === "map") {
      await open(a, "home"); await a.click('[data-action="view"][data-value="map"]'); await sleep(300);
    } else if (route === "sheet") {
      await open(a, "home"); await a.click('[data-action="open-sheet"]'); await sleep(400);
    } else await open(a, route);
    await a.evaluate(AXE);
    const res = await a.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } });
      return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
    });
    res.forEach((x) => issues.push(`${route}: ${x}`));
  }
  check(`Accessibility scan passes in ${scheme} mode (11 screens incl. map, sheet, assistant)`, issues.length === 0, issues.join("\n      "));
  await a.close();
}

// Desktop view (phone frame + side panel) gets its own scan, in both themes.
for (const scheme of ["light", "dark"]) {
  const d = await newPage(1440, 900, 1, scheme);
  await d.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await open(d, "ride-1");
  await d.evaluate(AXE);
  const res = await d.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } }))
    .violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`));
  check(`Accessibility scan passes on desktop (side panel + phone frame), ${scheme} mode`, res.length === 0, res.join("\n      "));
  await d.close();
}

// ================= Overflow at many widths, both themes =================
const overflow = [];
for (const scheme of ["light", "dark"]) {
  for (const [w, h] of [[320, 640], [360, 780], [390, 844], [430, 932], [600, 900], [768, 1024], [1024, 768], [1280, 800], [1440, 900]]) {
    const p = await newPage(w, h, 1, scheme);
    for (const route of ["home", "ride-1", "ride-4", "join-1", "saved", "mine", "done", "ask"]) {
      if (route === "done") { await open(p, "join-1"); await p.click('[data-action="confirm"]'); await sleep(350); }
      else if (route === "ask") {
        await open(p, "ask"); await p.click('[data-action="ask-suggest"]');
        await p.waitForFunction(() => !document.querySelector("#msgs [data-busy]"), { timeout: 5000 });
      }
      else await open(p, route);
      const o = await p.evaluate(() => {
        const app = document.getElementById("app"); const box = app.getBoundingClientRect(); const bad = [];
        app.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > box.right + 1 || r.left < box.left - 1) && !el.closest(".chips,.done-wheel,.ticket-tear,.confetti")) bad.push(el.className?.baseVal ?? el.className ?? el.tagName);
        });
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bad: [...new Set(bad)].slice(0, 4) };
      });
      if (o.sw > o.cw) overflow.push(`${scheme} ${w}px ${route}: page scrolls sideways (${o.sw} > ${o.cw})`);
      if (o.bad.length) overflow.push(`${scheme} ${w}px ${route}: pokes outside screen: ${o.bad.join(", ")}`);
    }
    if (p.errors.length) overflow.push(`${scheme} ${w}px errors: ${p.errors.join(" | ")}`);
    await p.close();
  }
}
check("No sideways scroll or clipped content (2 themes × 9 widths × 8 screens)", overflow.length === 0, overflow.join("\n      "));

// ================= Screenshots =================
const shots = async (scheme, dir, suffix) => {
  const s = await newPage(390, 844, 2, scheme);
  await s.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await open(s, "home"); await settle(s);
  await s.screenshot({ path: path.join(dir, `1-home${suffix}.png`) });
  await open(s, "ride-1"); await settle(s);
  await s.screenshot({ path: path.join(dir, `2-details${suffix}.png`) });
  await open(s, "join-1"); await settle(s);
  await s.screenshot({ path: path.join(dir, `3-join${suffix}.png`) });
  await s.click('[data-action="confirm"]'); await settle(s);
  await s.screenshot({ path: path.join(dir, `4-done${suffix}.png`) });
  await s.click('[data-cta="home"]'); await sleep(300);
  await s.click('.ride-card[data-ride="2"] [data-action="save"]'); await sleep(200);
  await s.goto(BASE + "#mine", { waitUntil: "networkidle0" }); await settle(s);
  await s.screenshot({ path: path.join(dir, `5-my-rides${suffix}.png`) });
  await s.goto(BASE + "#ride-4", { waitUntil: "networkidle0" }); await settle(s);
  await s.screenshot({ path: path.join(dir, `6-full-ride${suffix}.png`) });
  await s.close();
};
await shots("light", screensDir, "");
await shots("dark", scratchDir, "-dark");
check("Screens captured", ["1-home", "2-details", "3-join", "4-done", "5-my-rides", "6-full-ride"].every((n) => fs.existsSync(path.join(screensDir, n + ".png"))));

const desk = await newPage(1440, 900);
await open(desk, "ride-1"); await settle(desk); await sleep(1200);
await desk.screenshot({ path: path.join(scratchDir, "desktop-1440.png") });
await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok || !r.detail ? "" : "\n      " + r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
