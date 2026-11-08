// Auto-records the Attack Lab hijack demo and cuts the waiting time away.
//   node scripts/record-demo.mjs                 -> hijacked invoice, guard ON  (the BLOCKED clip)
//   GUARD=off node scripts/record-demo.mjs       -> guard OFF (paid + flagged clip)
//   SCENARIO=honest node scripts/record-demo.mjs -> honest invoice
// Needs the dev server running (npm run dev), `npm i -D playwright`, `npx playwright install --with-deps chromium`
// and ffmpeg (sudo apt install ffmpeg). Output: demo-clips/<name>.mp4
// NOTE: this is a REAL run: it uses your live model, Walrus and Sui mainnet (gas + 2 memories).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SCENARIO = process.env.SCENARIO ?? "hijacked"; // hijacked | honest
const GUARD = (process.env.GUARD ?? "on") !== "off";
const LEAD_SECONDS = Number(process.env.LEAD ?? 3); // keep this many seconds of the click before the result
const ZOOM = Number(process.env.ZOOM ?? 1); // e.g. ZOOM=1.25 makes the text bigger for phone viewers
const BUTTON = SCENARIO === "honest" ? "Run honest invoice" : "Run hijacked invoice";
const name = `${SCENARIO}-guard-${GUARD ? "on" : "off"}-${new Date().toISOString().replace(/[:.]/g, "-")}`;

mkdirSync("demo-clips/raw", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: "demo-clips/raw", size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
const t0 = Date.now();

await page.goto(`${BASE}/attack`, { waitUntil: "networkidle" });
if (ZOOM !== 1) await page.evaluate((z) => { document.documentElement.style.zoom = String(z); }, ZOOM);

// guard switch: aria-checked is "true" when ON
const sw = page.getByRole("switch", { name: "Black Box payment guard" }).or(page.getByLabel("Black Box payment guard"));
if (((await sw.getAttribute("aria-checked")) === "true") !== GUARD) await sw.click();
await page.waitForTimeout(1500);

await page.getByRole("button", { name: BUTTON }).click();
const clickedAt = (Date.now() - t0) / 1000;

// the agent run takes 20-60 s; wait for the result block (cut out of the final video)
await page.getByText("Open the full on-chain proof").waitFor({ timeout: 240_000 });
const resultAt = (Date.now() - t0) / 1000;

// slow scroll through the trace so every guard step is readable
await page.getByText("Open the full on-chain proof").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy({ top: -9999, behavior: "instant" }));
const vh = 720;
const maxY = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < maxY - vh; y += 260) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "smooth" }), y);
  await page.waitForTimeout(700);
}
await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
await page.waitForTimeout(1500);

// open the on-chain proof page and hold on it
await page.getByText("Open the full on-chain proof").click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(5000);

await ctx.close(); // flushes the video
await browser.close();

const raw = readdirSync("demo-clips/raw").filter((f) => f.endsWith(".webm")).sort().pop();
const rawPath = `demo-clips/raw/${raw}`;
const out = `demo-clips/${name}.mp4`;
// keep: [click - LEAD .. click + 4 s]  (the click)  +  [result .. end]  (the BLOCKED/PAID part), drop the waiting
const a0 = Math.max(0, clickedAt - 1);
const a1 = clickedAt + 4;
execFileSync("ffmpeg", [
  "-y", "-i", rawPath,
  "-filter_complex",
  `[0:v]trim=start=${a0}:end=${a1},setpts=PTS-STARTPTS[a];[0:v]trim=start=${Math.max(a1, resultAt - LEAD_SECONDS)},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]`,
  "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", out,
], { stdio: "inherit" });
console.log(`\nDone: ${out}\n(waited ${Math.round(resultAt - clickedAt)} s for the agent; that part was cut out)`);
