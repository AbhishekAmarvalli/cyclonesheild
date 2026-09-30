# CycloneSheild — Cyclone Risk & Response Prototype

An end-to-end prototype for reviewing a cyclone forecast against a real incident. The Fani case
starts from pre-landfall track inputs, estimates the next step with a transparent linear trend
baseline, compares it with the reported track and impacts, and screens illustrative infrastructure.
Gemini can draft an evidence-bound advisory; notification dispatch remains simulated.

Built for the Google hackathon brief: real or realistic data, Google AI integration, and a
repeatable demonstration on one district.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # typecheck + production bundle → dist/
npm run preview      # serve the built app on :4173
```

## Tech stack

- **UI:** React 18, TypeScript, Vite, CSS, Roboto/Roboto Flex, and Leaflet for the interactive map.
- **Geospatial analysis:** Turf.js and a deterministic local engine for track-derived wind bands, simulated rainfall/surge footprints, asset intersections, and transparent P1–P4 screening.
- **AI advisory:** Google GenAI SDK (`@google/genai`) with a constrained evidence-packet prompt; a deterministic offline drafter is available without an API key.
- **Google data integrations:** Google Earth Engine for optional Sentinel-2 layers; Google Maps Platform Weather API through the local Vite proxy in development and a Vercel serverless proxy in production.
- **Basemap:** OpenStreetMap. Forecast-mode Puri study-area geometry and infrastructure are clearly marked illustrative.
- **Deployment:** Vite static frontend on Vercel plus a serverless Weather API proxy. Notification dispatch is a browser-only simulation; no live recipient receives a message.

The one-step Fani track estimate is a simple linear trend baseline, **not a Gemini forecast**.
Credibility comes from traceable sources, visible differences, deterministic reruns, and explicit
limits; independent validation across multiple storms remains future work.

For live Weather API on Vercel, add a rotated Google Maps Platform Weather API key as
`GOOGLE_API_KEY` in the project's Production environment variables and redeploy. The
`/api/weather/*` function forwards only approved Weather API endpoints and query fields; it never
returns or logs the key. Do not add the key to `VITE_*` variables or source files. The browser
shows only the masked key hint requested for identification.

## Credibility and safeguards

| Reference | Current status here | Safeguard / next step |
| --- | --- | --- |
| [Google Weather Lab](https://deepmind.google.com/science/weatherlab) | Not integrated; its forecasts are experimental research outputs. | If added, preserve multiple tracks and their experimental label; compare with official IMD guidance. |
| [IMD / RSMC New Delhi](https://rsmcnewdelhi.imd.gov.in/) | Fani points are rounded historical inputs; no live uncertainty cone is shown. | Keep official bulletins authoritative and use their uncertainty guidance for real decisions. |
| [Windy hurricane tracker](https://community.windy.com/topic/37123/understand-hurricane-tracking-forecast-and-measurements/2) | Not an input to this build. | Do not use a general 10 m average-wind layer as a cyclone's maximum sustained wind. |
| [CLIMADA](https://climada-python.readthedocs.io/en/v6.1.0/user-guide/0_10min_climada.html) | Not integrated; local P1–P4 values are exposure priorities only. | Collect local asset/vulnerability data and validate region-specific relationships before estimating damage or loss. |

The Fani replay reports its errors rather than claiming broad AI skill: 190 km/h estimated versus
176 km/h on the rounded next track point, with a 61 km point error. This is one hindcast example;
it is not an independent validation set.

### Fani replay and saved run records

The opening case is Cyclone Fani. The input-time slider is restricted to pre-landfall data; the
map draws the observed track only up to that point, then shows the trend estimate and the next
reported track point separately. **Download replay record** saves a JSON snapshot of the inputs,
estimate, asset priorities, sources and limitations to the user's device.

The numerical forecast is a deliberately simple one-step linear trend baseline, not a trained
Gemini forecast or operational warning model. The Puri boundary and asset register are
illustrative. Wind/track comparisons use rounded historical track points; event impacts come from
the linked Odisha Government / UN / World Bank / ADB post-disaster assessment.

The separate **reported-impact map** embeds `public/fani-impact-map.html`, which uses the supplied
Odisha district layer and its source notes (UNICEF SitRep, Indian Red Cross assessment and Odisha
SRC housing data). It colors the named severe/heavy/affected classes, keeps unlisted districts
neutral, and shows the reported landfall. This is observed impact context, not the forecast map's
simulated hazard overlay. The map cites 2011 Census district boundaries; check the source notes
before reusing those boundaries for current administrative decisions.

On this Fani replay, input snapshots span **63 to 15 hours (2.6 to 0.6 days) before landfall**.
Each estimate only forecasts the **next track point, 15 to 24 hours ahead**. This is the range
tested by this prototype, not a guaranteed warning lead time or a promise for future cyclones.

### Vercel deployment

From an authenticated Vercel CLI session, run `vercel --prod --yes --name cyclonesheild`.
`.vercelignore` excludes `.env`, the local Google OAuth client-secret JSON, and build artifacts.
No API key is required for the offline prototype; configure any optional public-client keys in
Vercel's project environment settings only when appropriate.

### Gemini (optional but recommended)

The advisory generator works in two modes:

| Mode | When | Behaviour |
| --- | --- | --- |
| **Gemini** | API key present | Sends the computed evidence packet to `@google/genai`, constrained by a strict system prompt (no invented rainfall, flood depths, wind speeds, damage %). |
| **Offline drafter** | No key / request fails | Deterministic, evidence-bound drafting from the same packet — so the demo never dead-ends. Clearly labelled in the UI. |

Set a key either way:

```bash
cp .env.example .env      # then: VITE_GEMINI_API_KEY=...  VITE_GEMINI_MODEL=gemini-2.5-flash
```

…or paste a key into the **Advisory panel → Google AI Studio API key** field (stored in
`localStorage` only, never sent anywhere except the Gemini API). The model id is a dropdown —
pick whatever Gemini Flash model your key has access to.

### Google Weather + Earth Engine satellite (optional)

Two further Google integrations, both **opt-in** — the demo never dead-ends without them:

| Feature | Needs | Without it |
| --- | --- | --- |
| **Live weather card** (current conditions, next 12 h, public weather alerts for the district centre) | a Google Maps Platform **API key** with the Weather API enabled — put it in `.env` as `GOOGLE_API_KEY` (server-side proxy; the key is **never visible to site visitors**), or `VITE_GOOGLE_API_KEY` / paste it into the card for static hosting | card shows a set-up note; everything else runs as before |
| **Satellite basemap** (Sentinel-2 true colour, plus a flood-water/NDWI overlay) | an **OAuth 2.0 Web-application client ID** + an Earth Engine–enabled Cloud project — `VITE_EE_CLIENT_ID` / `VITE_EE_PROJECT`, or the map's *Earth Engine setup* panel. Earth Engine deliberately does **not** accept plain API keys: users sign in with their own Google account | map stays on OpenStreetMap with a clear status line |

Setup (both features come from the same Google Cloud project):

1. Create/select a project, **register it for Earth Engine** and enable the **Earth Engine API**
   (the non-commercial community tier is free).
2. **Weather** — enable *Maps Platform Weather API*, then
   *Credentials → Create credentials → API key*. Recommended: add it to `.env` as
   `GOOGLE_API_KEY` — the dev/preview server then proxies `/api/weather/*` and attaches the
   key itself, so the key is never shipped to browsers (see `vite.config.ts`). A free
   [Maps Demo Key](https://mapsplatform.google.com/maps-demo-key/) works with no billing.
3. **Satellite** — *Credentials → Create credentials → OAuth client ID* (Web application) and add
   your origin (e.g. `http://localhost:5173`) to *Authorized JavaScript origins*.

Weather is **real-time and live now** — it is deliberately labelled as separate from the
scenario timeline (Hudhud is 2014; Arjuna is synthetic). Satellite tiles are a Sentinel-2
surface-reflection median composite of the past six months, labelled as such in the map status
line; the flood-water mode paints NDWI open-water pixels in Google blue over the imagery.
Invalid credentials fail loudly with Google's own reason (key rejected, restricted key, quota,
billing) — never silently, and never by inventing numbers.

---

## What the prototype includes

| Brief | Where |
| --- | --- |
| Fani forecast replay | First view — choose a pre-landfall input time, inspect the trend estimate beside reported Fani observations, and download a JSON run record |
| Interactive map + priority list | Main view — pan/zoom the study area, distinguish forecast estimate from next reported track point, and review exposure bands |
| Asset evidence | Expand **Explore the full model workspace** — inspect hazard intersections, score breakdowns, source timestamps and unknowns |
| Gemini advisory | Same workspace — evidence packet → Gemini or offline draft → review/edit → test dispatch |
| Test notification | Same workspace — simulated test recipients, dispatch steps, delivery state and payload preview; no message leaves the browser |

---

## Demonstration script (≈90 seconds)

1. The app opens on Fani at **15 hours before landfall**: 90 kt input, with a trend estimate of 190 km/h for the next step.
2. Compare the estimate with the reported 175–180 km/h range, reported impacts, and the next rounded track point (about 61 km position error).
3. Observe the prototype’s limitation: it flags one P3 and three P4 illustrative assets at the input time, with no P1/P2, while the event assessment reports severe impacts.
4. Move the **Forecast input time** slider to see the estimate and exposure screen recompute from earlier data; the map keeps later observations separate.
5. Download the JSON replay record, then open **Explore the full model workspace** to inspect asset evidence and source timestamps.
6. Generate/review an offline or Gemini advisory and **Send test advisory**; all four recipients and delivery steps are explicitly simulated.

---

## How the risk calculation works

Pure, deterministic, and reproducible (`src/lib/analysis.ts`):

1. **Load the forecast step** — storm centre, sustained wind, central pressure and gale radius
   for the selected valid time, plus scenario surge and rainfall guidance.
   For Fani, a separate one-step linear trend baseline extrapolates the previous/current track
   values to the next archived point. It is intentionally a simple demo, not a trained model.
2. **Build hazard footprints**
   * *Wind* — concentric swaths at 1.6 / 0.8 / 0.45 / 0.15 × gale radius → low → moderate →
     high → severe.
   * *Coastal inundation* — the coastline is offset inland by a reach derived from the peak
     surge and the storm's distance to the coast (`maxReach × (1 − d/150)^1.5`). **Prepared
     simulated corridor, not a surge model.**
   * *Rainfall* — a ~10 km warning grid over the district, intensity decaying with distance
     from the storm centre, classified with IMD thresholds (64.5 / 115.6 / 204.5 mm per 24 h).
3. **Find intersections** — facilities are point-tested; roads are sampled along their
   alignment (0.6 km steps) so partial exposure is reported as a percentage of the alignment.
4. **Assign a transparent priority**

   ```
   score = 100 × (0.45·H + 0.30·V + 0.25·I) / (sum of used weights)
   H = hazard severity (0.90 / 0.70 / 0.45 / 0.25) + 0.05 per extra hazard type
   V = structural vulnerability (0.90 / 0.60 / 0.30) — UNKNOWN → excluded, weights renormalised
   I = service importance 1–5 scaled to 0–1
   bands: P1 ≥ 85 · P2 65–84 · P3 45–64 · P4 < 45
   ```

   A hospital's *importance* never inflates its *structural* score, and unknown stays unknown.
5. **Hand the facts to Gemini** — the evidence packet (scenario, forecast step, hazard layers,
   top exposed assets, reasons, unknowns, method) is what the model sees; the system prompt
   forbids inventing numbers and requires "unknown" where the register says unknown.
6. **Show the advisory and the notification status** — editable draft, cited evidence,
   recipients, step log, payload preview, all simulated.

---

## Data provenance

Every record carries a status so the UI can say where it came from:

| Layer | Status | Source / notes |
| --- | --- | --- |
| Cyclone tracks (Fani 2019, Hudhud 2014, Titli 2018) | `recorded` | Approximate reconstructions of archived IMD/RSMC guidance — rounded to 0.1°, normalised to UTC. Not a substitute for the official best-track archive: [rsmcnewdelhi.imd.gov.in](https://rsmcnewdelhi.imd.gov.in/) |
| Fani event impacts | `recorded` | Odisha Government / UN / World Bank / ADB damage, loss and needs assessment: [report page](https://recovery.preventionweb.net/publication/documents-and-publications/cyclone-fani-damage-loss-and-needs-assessment) |
| Scenario "X — Arjuna" | `synthetic` | Invented inputs (stronger, coast-hugging track) so the dashboard can be shown recomputing |
| Inundation corridor, rainfall grid | `simulated` | Prepared hazard layers built from scenario guidance; methodology stated in the UI |
| Wind swaths | `derived` | Computed from forecast wind radii |
| District outline, coastline | `sample` | Hand-generalised at 1–3 km — district-scale screening only |
| Asset register (19 + 12 records plus 4 illustrative Puri points) | `sample` / `synthetic` | Hand-compiled base geometry; Puri points, structural attributes, bed counts and capacities are illustrative, flagged per record |
| Terrain | `sample` | SRTM 30 m elevation extract surfaced through **Google Earth Engine** |
| Live weather | `recorded` | Google Maps Platform Weather API (current conditions · hourly forecast · public alerts) for the district centre — fetched only when a key is configured |
| Satellite basemap | `recorded` | Sentinel-2 SR median composite (past 6 months) rendered by **Google Earth Engine** on sign-in; flood-water mode is NDWI-derived, labelled in the UI |
| Basemap | — | © OpenStreetMap contributors |

### Honest limitations (stated in the UI, not buried)

* Overlaying infrastructure on prepared flood/surge polygons demonstrates **exposure analysis**.
  It does **not** demonstrate a storm-surge forecasting model.
* Fani's numerical estimate is a linear trend baseline, not Gemini-generated or validated
   forecast output; the next archived point is the comparison target, not an independent forecast.
* The coloured band around the track is a wind swath derived from wind radii; a track **cone
  describes uncertainty in the cyclone centre's position**, not impact (see
  [nhc.noaa.gov](https://www.nhc.noaa.gov/)).
* `unknown` attributes are rendered as unknown — never imputed.
* All dispatches in this build are simulated; no message leaves the browser.

---

## Verification

```bash
npm run typecheck      # strict TypeScript
npm run check:analysis # deterministic engine: exposure, scores, bands across scenarios/steps
npm run smoke          # headless Chrome (CDP) UI test: 17 checks over the full demo flow
```

`npm run smoke` expects the built app on `http://127.0.0.1:4175` and Chrome on
`--remote-debugging-port=9222`:

```bash
npm run build && npx vite preview --port 4175 --host 127.0.0.1 &
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/cdp http://127.0.0.1:4175/ &
npm run smoke
```

The analysis check covers the Fani one-step estimate and deterministic asset scores. Browser smoke
checks require Chrome with remote debugging enabled; they must be run in an environment that has
that browser target available.

---

## Project structure

```
src/
  data/         districts, cyclone scenarios (tracks + bulletin metadata), asset register
  lib/
    geo.ts      rings, coastline offset, line sampling, distances
    analysis.ts hazard footprints → intersections → transparent priority
      gemini.ts   evidence packet + constrained advisory drafting (+ offline drafter)
      prediction.ts one-step linear trend baseline used by the Fani replay
   data/
      incidents.ts source-backed post-event facts for the Fani comparison
    dispatch.ts simulated notification dispatch
    weather.ts  Google Weather API client (current/hourly/alerts) + honest error states
    ee.ts       Earth Engine sign-in, Sentinel-2 map ids, Leaflet satellite tile layer
  components/   ScenarioControls · MapPanel · WeatherPanel · PriorityList · AssetDetails · AdvisoryPanel
  App.tsx       layout, theme, state
scripts/
  sanity-check.ts   engine assertions (scores, bands, determinism)
  compare.ts        proves scenario/step changes alter the result
  smoke.mjs         headless UI test
  layout-probe.mjs  layout/overflow assertions
```

## Design

**Light theme only**, with a Google-product/Material visual language: Roboto body text, a Google
Sans-first heading stack with Roboto Flex fallback, Google blue and restrained semantic accents,
rounded surfaces, subtle elevation, visible focus rings, and short reduced-motion-aware transitions.

Accessibility decisions baked in (verified by the smoke test):

* label text at the 700-tones so white-on-colour clears **4.5:1**; tints carry dark text
* 3 px `:focus-visible` outline on every interactive element, plus a **skip link**
* 44 px minimum touch/press targets on buttons, toggles, inputs and recipients
* **SVG icons only** — no emoji as icons anywhere (map pins included)
* `prefers-reduced-motion` disables the cyclone spin, pulses and transitions
* priority bands are never colour-only: each carries a `P1…P4` label and a written reason
