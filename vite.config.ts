import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import httpProxy from "http-proxy";

/*
 * ── Google Weather API server-side proxy ────────────────────────────────────
 *
 * The Weather API key lives in `.env` (gitignored) and is attached HERE, inside
 * the dev/preview server. The browser only ever calls same-origin
 * `/api/weather/...` — the key is never bundled, never sent to visitors, and
 * never appears in any log. Google's ToS also prohibits storing API content,
 * so the proxy passes responses straight through without caching.
 */

const WEATHER_UPSTREAM = "https://weather.googleapis.com";

/** Upstream paths the proxy is willing to touch (else passthrough / 404). */
const WEATHER_PATHS: Record<string, string> = {
  "currentConditions:lookup": "/v1/currentConditions:lookup",
  "forecast/hours:lookup": "/v1/forecast/hours:lookup",
  "publicAlerts:lookup": "/v1/publicAlerts:lookup",
};

/** Query params we forward — everything else (including any hand-made `key=`) is dropped. */
const WEATHER_PARAMS = new Set([
  "location.latitude",
  "location.longitude",
  "unitsSystem",
  "languageCode",
  "hours",
  "pageSize",
]);

/** Read the key from the project `.env` without polluting process.env. */
const readWeatherKey = (): string => {
  for (const name of ["GOOGLE_API_KEY", "VITE_GOOGLE_API_KEY"]) {
    try {
      const envPath = path.resolve(__dirname, ".env");
      if (!fs.existsSync(envPath)) continue;
      const line = fs
        .readFileSync(envPath, "utf8")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .find((l) => l.trim().startsWith(`${name}=`));
      if (!line) continue;
      let value = line.slice(line.indexOf("=") + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) return value;
    } catch {
      /* unreadable .env — treated as "no key" */
    }
  }
  return "";
};

const weatherProxyPlugin = (): Plugin => {
  const key = readWeatherKey();
  const proxy = httpProxy.createProxyServer({ target: WEATHER_UPSTREAM, changeOrigin: true });

  // Silence proxy error spam; a dropped upstream becomes a 502 below.
  proxy.on("error", (_err, _req, res) => {
    if ("writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: 502, message: "Weather upstream unreachable" } }));
    }
  });

  const handle = (req: IncomingMessage, res: ServerResponse): boolean => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/api/weather") return false;

      const endpoint = url.searchParams.get("endpoint") ?? "";
      const upstreamPath = WEATHER_PATHS[endpoint];
      if (!upstreamPath) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: 404, message: "Weather endpoint not allowed" } }));
        return true;
      }

      if (!key) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              code: 500,
              message:
                "Weather proxy has no key: add GOOGLE_API_KEY=<key> to .env and restart the server.",
            },
          }),
        );
        return true;
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: 405, message: "Method not allowed" } }));
        return true;
      }

      // Rebuild the query string from the allowlist only.
      const clean = new URLSearchParams();
      for (const [k, v] of url.searchParams) {
        if (WEATHER_PARAMS.has(k) && v.length <= 64) clean.set(k, v);
      }
      clean.set("key", key); // attached server-side — never visible to the client

      req.url = `${upstreamPath}?${clean.toString()}`;
      proxy.web(req, res, { timeout: 8000 });
      return true;
    } catch {
      // Never let a proxy fault crash the dev/preview server.
      try {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: 502, message: "Weather proxy failure" } }));
      } catch {
        /* response already gone */
      }
      return true;
    }
  };

  return {
    name: "surgewatch-weather-proxy",
    config(_env, _opts) {
      // Tell the client bundle it is served behind the key-holding proxy.
      // (true for both `vite dev` and `vite build` + `vite preview`; for any
      // other static server the flag stays undefined ⇒ direct mode.)
      return {
        define: {
          "import.meta.env.VITE_WEATHER_PROXY": JSON.stringify(true),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
};

export default defineConfig({
  plugins: [react(), weatherProxyPlugin()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
