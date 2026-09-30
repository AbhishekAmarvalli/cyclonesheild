import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on("open", r));

let id = 0;
const pending = new Map();
ws.on("message", (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const js = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return `ERR ${JSON.stringify(r.exceptionDetails)}`;
  return r.result?.value;
};

await send("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await sleep(3000);

console.log(
  await js(`JSON.stringify({
    viewport: [innerWidth, innerHeight],
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    grid: getComputedStyle(document.querySelector(".grid")).gridTemplateColumns,
    advisoryCols: getComputedStyle(document.querySelector(".advisory-grid")).gridTemplateColumns,
    map: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(document.querySelector(".map-frame").getBoundingClientRect()),
    controls: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(document.querySelector(".area-controls").getBoundingClientRect()),
    detail: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(document.querySelector(".detail-column").getBoundingClientRect()),
    advisory: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(document.querySelector(".area-advisory").getBoundingClientRect()),
    prioScroll: (e => [e.scrollHeight, e.clientHeight])(document.querySelector(".prio-list")),
    detailScroll: (e => [e.scrollHeight, e.clientHeight])(document.querySelector(".detail-scroll")),
    markers: document.querySelectorAll(".asset-pin").length,
    legendVisible: document.querySelector(".legend").getBoundingClientRect().height > 20,
    cardsWithoutShadow: [...document.querySelectorAll(".card")].filter(c => getComputedStyle(c).boxShadow === "none").length,
    tinyText: [...document.querySelectorAll("*")].filter(e => e.children.length === 0 && e.innerText && parseFloat(getComputedStyle(e).fontSize) < 10).length,
    fontFamily: getComputedStyle(document.body).fontFamily.split(",")[0].replace(/"/g, "")
  }, null, 1)`),
);

// nothing may sit on top of something else
const overlaps = await js(`(() => {
  const rect = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const hit = (a, b) => a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  const pairs = [
    ["map header vs map pills", ".map-head", ".map-banner"],
    ["map title vs status text", ".map-head h2", ".map-head .sub"],
    ["brand vs status chips", ".brand", ".topbar-meta"],
    ["controls column vs map", ".area-controls", ".area-map"],
    ["map vs detail column", ".area-map", ".detail-column"],
    ["detail column vs advisory", ".detail-column", ".area-advisory"],
    ["legend vs map frame", ".legend", ".map-frame"]
  ];
  return JSON.stringify(pairs.map(([n, x, y]) => ({ n, overlap: hit(rect(x), rect(y)) })));
})()`);
console.log("\nOverlap checks:");
for (const p of JSON.parse(overlaps ?? "[]")) {
  console.log(`  ${p.overlap ? "FAIL" : "PASS"}  ${p.n}`);
}

const clipped = await js(`JSON.stringify([...document.querySelectorAll(
  ".banner-pill, .chip, .btn, .stat b, .prio-main .nm, .card-head h2"
)].filter(e => e.scrollWidth > e.clientWidth + 2)
  .map(e => (e.className || "") + " → " + (e.innerText || "").slice(0, 44)))`);
const clippedList = JSON.parse(clipped ?? "[]");
console.log(
  `  ${clippedList.length ? "FAIL" : "PASS"}  no clipped text (${clippedList.length} found)` +
    (clippedList.length ? ` — ${clippedList.join(" | ")}` : ""),
);

// responsive breakpoints — no horizontal scroll at any canonical width
for (const width of [1440, 1024, 768, 375]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width <= 480,
  });
  await sleep(700);
  const r = JSON.parse(
    (await js(
      `JSON.stringify({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        cols: getComputedStyle(document.querySelector(".grid")).gridTemplateColumns.split(" ").length
      })`,
    )) ?? "{}",
  );
  console.log(
    `  ${r.overflow ? "FAIL" : "PASS"}  ${width}px — scrollWidth ${r.scrollWidth}, grid cols ${r.cols}`,
  );
}

ws.close();
process.exit(0);
