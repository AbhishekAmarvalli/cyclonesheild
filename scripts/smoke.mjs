/**
 * Headless UI smoke test.
 *
 * Drives the built app through the demonstration flow described in the brief:
 * select scenario → run analysis → inspect asset → draft advisory → send
 * test notification, plus theme and layer toggles.
 *
 * Usage:  node scripts/smoke.mjs          (expects CDP-enabled Chrome on :9222)
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const CDP = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let results = 0;
let failed = 0;
const check = (label, ok, extra = "") => {
  results += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
};

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await (await fetch(`${CDP}/json`)).json();
      const page =
        targets.find((t) => t.type === "page" && /4175|4173|5173/.test(t.url)) ??
        targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error("no CDP target — is Chrome running with --remote-debugging-port=9222?");
}

const ws = await connect();
let msgId = 0;
const pending = new Map();

const socket = new WebSocket(ws);
await new Promise((res, rej) => {
  socket.on("open", res);
  socket.on("error", rej);
});
socket.on("message", (data) => {
  const m = JSON.parse(data.toString());
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  }
});

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    socket.send(JSON.stringify({ id, method, params }));
  });

const js = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "evaluate failed");
  return r.result?.value;
};

const clickByText = (text) =>
  js(`(() => {
    const needle = ${JSON.stringify(text)}.toLowerCase();
    const nodes = [...document.querySelectorAll("button, .option-card, .prio-item, .toggle-row")];
    const el = nodes.find(n => (n.innerText || "").toLowerCase().includes(needle));
    if (!el) return false;
    el.click();
    return true;
  })()`);

// start from a clean render
await send("Page.enable");

// land on the app regardless of which tab Chrome was opened with
const here = await js("location.href");
if (!/4175|4173|5173/.test(here ?? "")) {
  await send("Page.navigate", { url: "http://127.0.0.1:4175/" });
  await sleep(1500);
}

await send("Page.reload", { ignoreCache: true });
await sleep(2500);

console.log("\nCycloneSheild smoke test");

const overview = await js(`JSON.stringify({
  title: document.querySelector("#comparison-title")?.innerText ?? "",
  observed: document.querySelector(".comparison-side--observed")?.innerText ?? "",
  model: document.querySelector(".comparison-side--model")?.innerText ?? "",
  difference: document.querySelector(".comparison-readout")?.innerText ?? "",
  timing: document.querySelector(".prototype-lead")?.innerText ?? "",
  brand: document.querySelector(".brand h1")?.innerText ?? "",
  workspaceClosed: !document.querySelector(".advanced-workspace")?.open
})`);
const o = JSON.parse(overview ?? "{}");
check(
  "Fani comparison opens with separate observed and model results",
  /Fani/i.test(o.title) && /175–180 km\/h/.test(o.observed) && /190 km\/h/.test(o.model) &&
    /10–15 km\/h above/.test(o.difference) && /2\.6 days to 0\.6 days/.test(o.timing) &&
    /15–24 h/.test(o.timing) && o.brand === "CycloneSheild",
  `workspace collapsed=${o.workspaceClosed}`,
);

const readingOrder = JSON.parse(
  (await js(`JSON.stringify((() => {
    const children = [...document.querySelector("#main").children];
    const mapIndex = children.findIndex(el => el.classList.contains("map-priority-row"));
    const comparisonIndex = children.findIndex(el => el.classList.contains("comparison"));
    const advisory = document.querySelector("#main > .area-advisory");
    return {
      comparisonAfterMap: mapIndex >= 0 && comparisonIndex > mapIndex,
      advisoryVisible: !!advisory && !advisory.closest("details"),
    };
  })())`)) ?? "{}",
);
check("map precedes the forecast-versus-real comparison", readingOrder.comparisonAfterMap);
check("Gemini advisory is always visible", readingOrder.advisoryVisible);

await js(`document.querySelector(".trust-disclosure").open = true`);
const trust = JSON.parse(
  (await js(`JSON.stringify({
    text: document.querySelector(".trust-content")?.innerText ?? "",
    references: document.querySelectorAll(".trust-reference a").length
  })`)) ?? "{}",
);
check(
  "trust panel distinguishes forecast baseline, official warnings and safeguards",
  /not a trained AI forecast/i.test(trust.text) && /IMD/i.test(trust.text) &&
    /one historical example does not establish forecast skill/i.test(trust.text),
  `${trust.references} linked references`,
);
check("four reference systems are linked", Number(trust.references) === 4);
await js(`document.querySelector(".trust-disclosure").open = false`);

await js(`document.querySelector(".advanced-workspace").open = true`);
await sleep(300);

const recordFilename = await js(`(() => {
  let filename = "";
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() { filename = this.download; };
  document.querySelector(".replay-method-row button")?.click();
  HTMLAnchorElement.prototype.click = originalClick;
  return filename;
})()`);
await sleep(100);
const recordStatus = await js("document.querySelector('.replay-method-row [aria-live]')?.innerText ?? ''");
check(
  "forecast replay exports a recorded JSON snapshot",
  /cyclonesheild-fani-2019-05-02/.test(recordFilename ?? "") && /downloaded/i.test(recordStatus),
  `${recordFilename} · ${recordStatus}`,
);

// 1 — five panels present
const panels = await js(`JSON.stringify({
  controls: !!document.querySelector(".area-controls"),
  map: !!document.querySelector(".leaflet-container"),
  list: !!document.querySelector(".prio-item"),
  detail: !!document.querySelector(".detail-scroll, .empty"),
  advisory: !!document.querySelector(".area-advisory"),
})`);
const p = JSON.parse(panels ?? "{}");
check("all five main panels render", p.controls && p.map && p.list && p.detail && p.advisory, panels);

// 2 — initial priority list populated
const initialRows = await js("document.querySelectorAll('.prio-item').length");
check("priority list populated", Number(initialRows) > 0, `${initialRows} rows`);

// 3 — click a lower-ranked asset → detail panel updates
const before = await js("document.querySelector('.detail-title h3')?.innerText ?? ''");
await js(`document.querySelectorAll('.prio-item')[${Math.max(0, Number(initialRows) - 1)}].click()`);
await sleep(300);
const after = await js("document.querySelector('.detail-title h3')?.innerText ?? ''");
check("clicking a priority row loads its details", Boolean(after) && after !== before, `${before} → ${after}`);

const clickedDetail = await clickByText("District hospital reference point");
await sleep(400);
const hasGaps = await js("document.querySelectorAll('.gap').length");
check(
  "asset details expose data gaps / unknowns",
  clickedDetail && Number(hasGaps) > 0,
  `${hasGaps} gap flags`,
);

// 4 — step the forecast time back: exposure should disappear
await js(`(() => {
  const el = document.querySelector(".slider");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, "1");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`);
await sleep(400);
const rowsAtStep1 = await js("document.querySelectorAll('.prio-item').length");
check("forecast time change recomputes exposure", Number(rowsAtStep1) < Number(initialRows), `${initialRows} → ${rowsAtStep1} rows`);

// 5 — return to the pre-landfall forecast checkpoint
await js(`(() => {
  const el = document.querySelector(".slider");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, "3");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`);
await sleep(400);
const rowsAtLandfall = await js("document.querySelectorAll('.prio-item').length");
check("pre-landfall checkpoint restores the comparison", Number(rowsAtLandfall) > 0, `${rowsAtLandfall} rows`);

// 6 — switch scenario
await js(`(() => {
  const el = document.querySelector(".area-controls select");
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  setter.call(el, "visakhapatnam");
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`);
await sleep(500);
const clickedScenario = await clickByText("Arjuna");
await sleep(700);
const header = await js("document.querySelector('.selected-scenario-banner')?.innerText ?? ''");
check("scenario switch", clickedScenario && /arjuna/i.test(header ?? ""), `${clickedScenario}`);

// return to the Fani comparison for the advisory
await js("document.querySelector('.selected-scenario-banner .btn')?.click()");
await sleep(500);

// 7 — layer toggle
const toggled = await js(`(async () => {
  const row = [...document.querySelectorAll(".toggle-row")].find(r => r.classList.contains("on"));
  if (!row) return null;
  const label = row.querySelector(".name")?.innerText ?? "";
  row.click();
  await new Promise(r => setTimeout(r, 500));
  const still = [...document.querySelectorAll(".toggle-row")].find(r =>
    (r.querySelector(".name")?.innerText ?? "") === label);
  return still ? !still.classList.contains("on") : null;
})()`);
check("hazard layer toggle works", toggled === true);

// 8a — Gemini error path with an invalid key (must fail loudly, not silently)
await js(`(() => {
  const el = document.querySelector('.area-advisory input[type="password"]');
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, "AIza-invalid-smoke-test");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`);
await sleep(200);
await clickByText("Generate advisory");
await sleep(5000);
const geminiError = await js(`[...document.querySelectorAll(".note--warn")]
  .some(n => (n.innerText || "").includes("Gemini request failed"))`);
check("invalid Gemini key surfaces an inline error", geminiError === true);
await js(`(() => {
  const el = document.querySelector('.area-advisory input[type="password"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`);
await sleep(300);

// 8 — offline advisory draft (no API key needed)
const clickedDraft = await clickByText("Offline draft");
await sleep(900);
const headline = await js("document.querySelector('.advisory-body h1')?.innerText ?? ''");
check("advisory drafted from evidence packet", clickedDraft && Boolean(headline), headline);

const cites = await js("document.querySelectorAll('.advisory-body li').length");
check("advisory contains impacts/actions", Number(cites) >= 3, `${cites} list items`);

// 9 — simulated dispatch
const clickedSend = await clickByText("Send test advisory");
await sleep(6000);
const steps = await js("document.querySelectorAll('.dispatch-step').length");
const status = await js(`([...document.querySelectorAll('.prio-meta .chip')].map(c=>c.innerText).join(' '))`);
check("test notification dispatched (simulated)", clickedSend && Number(steps) >= 4, `${steps} steps · ${status}`);

// 9a — Google weather card: present, honest about its connection state
const wx = JSON.parse(
  (await js(`JSON.stringify({
    present: !!document.querySelector('[data-testid="weather"]'),
    sub: document.querySelector('[data-testid="weather"] .sub')?.innerText ?? "",
    hours: document.querySelectorAll(".wx-hour").length
  })`)) ?? "{}",
);
check(
  "live weather card renders with a clear status",
  wx.present && /^(not connected|live|contacting|unavailable)/i.test(wx.sub ?? ""),
  `${wx.sub ?? "?"} · ${wx.hours} hour chips`,
);

// 9b — satellite basemap controls: present, OSM stated while off
const sat = JSON.parse(
  (await js(`JSON.stringify({
    row: !!document.querySelector(".sat-row"),
    status: document.querySelector(".sat-status")?.innerText ?? "",
    on: document.querySelector(".sat-btn")?.getAttribute("aria-pressed") ?? ""
  })`)) ?? "{}",
);
check(
  "satellite (Earth Engine) controls render",
  sat.row && sat.on === "false" && /OpenStreetMap/i.test(sat.status ?? ""),
  sat.status ?? "?",
);

// 10 — light-only Google build: no theme toggle, skip link, Roboto, focus ring
const chrome = await js(`JSON.stringify({
  themeAttr: document.documentElement.dataset.theme ?? null,
  themeButton: !!document.querySelector(".topbar .btn"),
  skipLink: !!document.querySelector(".skip-link"),
  font: getComputedStyle(document.body).fontFamily.split(",")[0].replace(/"/g, ""),
  focusRule: [...document.styleSheets].flatMap(s => {
    try { return [...s.cssRules]; } catch { return []; }
  }).some(r => (r.selectorText || "").includes(":focus-visible") && (r.style?.outline || "") !== "")
})`);
const c = JSON.parse(chrome ?? "{}");
check(
  "light-only build (no theme toggle, no data-theme)",
  !c.themeAttr && !c.themeButton,
  `font=${c.font}`,
);
check("skip link + Google-style typeface", c.skipLink && /Roboto/.test(c.font));
check("visible focus ring defined", c.focusRule === true);

console.log(`\n${results - failed}/${results} checks passed\n`);
socket.close();
process.exit(failed ? 1 : 0);
