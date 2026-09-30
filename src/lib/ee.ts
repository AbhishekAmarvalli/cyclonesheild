/**
 * Google Earth Engine — satellite basemap for the Leaflet map.
 *
 * Earth Engine cannot be reached with a plain API key: Google requires an
 * interactive Google sign-in (OAuth 2.0 client ID of an Earth Engine–enabled
 * Cloud project). Flow, mirroring Google's client-side web-app guide
 * (developers.google.com/earth-engine/custom-apps/client-js):
 *
 *   1. load the EE JS library from Google's CDN
 *   2. ee.data.authenticateViaOauth(...)  — silent attempt with stored creds
 *      · ready            → ee.initialize(project) → tiles can be requested
 *      · signin-required   → show a "Sign in with Earth Engine" button
 *   3. button → ee.data.authenticateViaPopup(...) → ee.initialize(project)
 *   4. build an image expression (Sentinel-2), image.getMap(vis) → mapId
 *   5. Leaflet asks ee.data.getTileUrl(mapId, x, y, z) for every tile
 *
 * No credential ever touches this bundle: the OAuth token lives in the
 * browser session managed by the Earth Engine library itself.
 */

import L from "leaflet";
import type { District } from "../types";

const EE_SCRIPT_URL =
  "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.365/earthengine-api.min.js";

const READONLY_SCOPE = "https://www.googleapis.com/auth/earthengine.readonly";

/** Satellite layer modes offered in the map controls. */
export type SatelliteMode = "truecolor" | "water";

/** Outcome of a silent (non-interactive) sign-in attempt. */
export type EeSignIn = "ready" | "signin-required";

/* ── the global `ee` object injected by Google's CDN script ─────────────── */

type EeGlobal = {
  data: {
    authenticateViaOauth: (
      clientId: string,
      success: () => void,
      error: (err: unknown) => void,
      extraScopes: string[],
      onNoCredentials: () => void,
      suppressDefaultScopes: boolean,
    ) => void;
    authenticateViaPopup: (success: () => void, error?: (err: unknown) => void) => void;
    getTileUrl: (mapId: unknown, x: number, y: number, z: number) => string;
  };
  initialize: (
    baseurl: string | null,
    tileurl: string | null,
    success: () => void,
    error: (err: unknown) => void,
    xsrfToken: string | null,
    project: string | null,
  ) => void;
  // image builders return loosely-typed EE objects — they are serialised
  // server-side, so there is nothing useful to type here.
  ImageCollection: (id: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  Image: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  Date: (iso: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  Geometry: { Rectangle: (coords: number[]) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const getEe = (): EeGlobal => {
  const e = (window as unknown as { ee?: EeGlobal }).ee;
  if (!e) throw new Error("The Earth Engine library is not loaded yet.");
  return e;
};

const errText = (err: unknown): string => {
  if (typeof err === "string" && err) return err;
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err) || "unknown Earth Engine error";
  } catch {
    return "unknown Earth Engine error";
  }
};

/* ── 1. library loading ─────────────────────────────────────────────────── */

let scriptPromise: Promise<void> | null = null;

export const loadEeLibrary = (): Promise<void> => {
  if ((window as unknown as { ee?: unknown }).ee) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = EE_SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the Earth Engine library from Google's CDN."));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
};

/* ── 2/3. authentication + initialisation ───────────────────────────────── */

const initialize = (project: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const ee = getEe();
    ee.initialize(
      null,
      null,
      () => resolve(),
      (err) => reject(new Error(errText(err))),
      null,
      project || null,
    );
  });

/**
 * Silent attempt: reuses credentials stored by previous sign-ins.
 * Resolves "signin-required" when the user has never signed in — the caller
 * then shows a button that triggers {@link interactiveSignIn}.
 */
export const silentSignIn = async (clientId: string, project: string): Promise<EeSignIn> => {
  await loadEeLibrary();
  const ee = getEe();
  return new Promise<EeSignIn>((resolve, reject) => {
    ee.data.authenticateViaOauth(
      clientId,
      () => {
        initialize(project).then(
          () => resolve("ready"),
          (e) => reject(e),
        );
      },
      (err) => reject(new Error(errText(err))),
      [READONLY_SCOPE],
      () => resolve("signin-required"),
      true,
    );
  });
};

/**
 * Interactive sign-in (Google account popup). Must only be called after a
 * silent attempt returned "signin-required", and from a user gesture.
 */
export const interactiveSignIn = async (project: string): Promise<void> => {
  await loadEeLibrary();
  const ee = getEe();
  return new Promise<void>((resolve, reject) => {
    ee.data.authenticateViaPopup(
      () => {
        initialize(project).then(
          () => resolve(),
          (e) => reject(e),
        );
      },
      (err) => reject(new Error(errText(err))),
    );
  });
};

/* ── 4. satellite image → map id ────────────────────────────────────────── */

/**
 * Sentinel-2 surface reflectance over the district:
 * · "truecolor" — median composite, natural colour (B4/B3/B2)
 * · "water"     — same composite with NDWI open-water pixels painted over it
 *                 in Google blue, so flood extent pops against the imagery
 *
 * The composite takes every scene intersecting the district from the past
 * six months — the median removes most cloud, and nothing about it is
 * extrapolated: it is plainly labelled as a composite in the UI.
 */
export const buildSatelliteMapId = (district: District, mode: SatelliteMode): Promise<unknown> => {
  try {
    const ee = getEe();
    const [[minLon, minLat], [maxLon, maxLat]] = district.bbox;
    const pad = 0.4; // buffer so tiles just outside the boundary still have scenes
    const region = ee.Geometry.Rectangle([minLon - pad, minLat - pad, maxLon + pad, maxLat + pad]);

    const end = ee.Date(new Date().toISOString());
    const start = end.advance(-6, "month");
    const composite = ee
      .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(region)
      .filterDate(start, end)
      .median();

    const VIS = { min: 50, max: 2800, gamma: 1.15 };
    let image: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    let vis: Record<string, unknown>;

    if (mode === "truecolor") {
      image = composite;
      vis = { bands: ["B4", "B3", "B2"], ...VIS };
    } else {
      const ndwi = composite.normalizedDifference(["B3", "B8"]);
      const water = ndwi.gt(0.15);
      const base = composite.select(["B4", "B3", "B2"]).visualize(VIS).rename(["r", "g", "b"]);
      const waterRgb = ee.Image.constant([31, 115, 232]).rename(["r", "g", "b"]).updateMask(water);
      image = base.blend(waterRgb);
      vis = { min: 0, max: 255 };
    }

    const mapId = image.getMap(vis);
    if (!mapId) throw new Error("Earth Engine returned no tile id for this image.");
    return Promise.resolve(mapId);
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error(String(e)));
  }
};

/* ── 5. map id → Leaflet tile layer ─────────────────────────────────────── */

/**
 * Leaflet tile layer that pulls XYZ tiles straight from Earth Engine via the
 * documented ee.data.getTileUrl(mapId, x, y, z) helper.
 */
export const createSatelliteLayer = (
  mapId: unknown,
  attribution: string,
): L.TileLayer => {
  const ee = getEe();
  const Layer = L.TileLayer.extend({
    getTileUrl(coords: { x: number; y: number; z: number }): string {
      return ee.data.getTileUrl(mapId, coords.x, coords.y, coords.z);
    },
  }) as unknown as new (url: string, options?: L.TileLayerOptions) => L.TileLayer;
  return new Layer("", {
    maxZoom: 18,
    attribution,
  });
};
