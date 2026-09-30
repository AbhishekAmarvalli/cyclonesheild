import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const j = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return "EXC:" + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};

async function connect() {
  for (let i = 0; i < 20; i++) {
    try {
      const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
      const page = targets.find((t) => t.type === "page" && /4175/.test(t.url)) ?? targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("no CDP target");
}

const ws = new WebSocket(await connect());
await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
let msgId = 0; const pending = new Map();
ws.on("message", (d) => { const m = JSON.parse(d.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
function send(method, params = {}) {
  return new Promise((res, rej) => { const i = ++msgId; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
}

console.log("connected; enabling page + navigating");
await send("Page.enable");
await send("Page.navigate", { url: "http://127.0.0.1:4175/" });
await sleep(5000);
console.log("navigated; evaluating");

console.log("href:", await j("location.href"));
console.log("rootChildren:", await j("document.getElementById('root')?.childElementCount"));
console.log("panels:", await j("JSON.stringify({c:!!document.querySelector('.area-controls'),m:!!document.querySelector('.leaflet-container'),l:document.querySelectorAll('.prio-item').length,a:!!document.querySelector('.area-advisory'),wx:!!document.querySelector('[data-testid=weather]')})"));
console.log("wxSub:", await j("document.querySelector('[data-testid=weather] .sub')?.innerText ?? 'none'"));
console.log("wxHours:", await j("document.querySelectorAll('.wx-hour').length"));
console.log("wxAlerts:", await j("document.querySelectorAll('.wx-alert').length"));
console.log("wxTemp:", await j("document.querySelector('.wx-temp')?.innerText ?? 'none'"));
console.log("probe complete");
process.exit(0);
