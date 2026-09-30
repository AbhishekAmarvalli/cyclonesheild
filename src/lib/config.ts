/** API key / model configuration: build-time env first, then session override. */

const KEY_STORE = "surgewatch.gemini.key";
const MODEL_STORE = "surgewatch.gemini.model";
const GOOGLE_KEY_STORE = "surgewatch.google.key";
const EE_CLIENT_STORE = "surgewatch.ee.client";
const EE_PROJECT_STORE = "surgewatch.ee.project";

export const DEFAULT_MODEL =
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? "gemini-2.5-flash";

export const ENV_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "";

/** Google Maps Platform API key — used by the Weather API (satellite uses OAuth, not this). */
export const ENV_GOOGLE_KEY =
  (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ?? "";

/** OAuth 2.0 client ID of the Earth Engine–enabled Cloud project (satellite sign-in). */
export const ENV_EE_CLIENT_ID =
  (import.meta.env.VITE_EE_CLIENT_ID as string | undefined) ?? "";

/** Earth Engine–enabled Cloud project id passed to ee.initialize(). */
export const ENV_EE_PROJECT =
  (import.meta.env.VITE_EE_PROJECT as string | undefined) ?? "";

const readStore = (k: string): string => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};

const writeStore = (k: string, v: string): void => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* storage unavailable — value stays in memory only */
  }
};

/* ── Google Maps Platform Weather API key ───────────────────────────────── */

export const readStoredGoogleKey = (): string => readStore(GOOGLE_KEY_STORE);
export const writeGoogleKey = (key: string): void => writeStore(GOOGLE_KEY_STORE, key);
export const activeGoogleKey = (): string => readStoredGoogleKey() || ENV_GOOGLE_KEY;

/* ── Google Earth Engine (satellite basemap) ────────────────────────────── */

export const readStoredEeClient = (): string => readStore(EE_CLIENT_STORE);
export const writeEeClient = (v: string): void => writeStore(EE_CLIENT_STORE, v);
export const activeEeClient = (): string => readStoredEeClient() || ENV_EE_CLIENT_ID;

export const readStoredEeProject = (): string => readStore(EE_PROJECT_STORE);
export const writeEeProject = (v: string): void => writeStore(EE_PROJECT_STORE, v);
export const activeEeProject = (): string => readStoredEeProject() || ENV_EE_PROJECT;

export const readStoredKey = (): string => {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
};

export const readStoredModel = (): string => {
  try {
    return localStorage.getItem(MODEL_STORE) ?? DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
};

export const writeKey = (key: string): void => {
  try {
    if (key) localStorage.setItem(KEY_STORE, key);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* storage unavailable — key stays in memory only */
  }
};

export const writeModel = (model: string): void => {
  try {
    if (model) localStorage.setItem(MODEL_STORE, model);
    else localStorage.removeItem(MODEL_STORE);
  } catch {
    /* ignore */
  }
};

export const activeKey = (): string => readStoredKey() || ENV_KEY;
