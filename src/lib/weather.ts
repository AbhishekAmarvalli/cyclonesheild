/**
 * Google Maps Platform Weather API (weather.googleapis.com/v1) client.
 *
 * Endpoints used (all GET, all CORS-enabled for browsers):
 *   · /v1/currentConditions:lookup — now
 *   · /v1/forecast/hours:lookup    — hourly forecast (we ask for 12 h)
 *   · /v1/publicAlerts:lookup      — official public weather alerts for the point
 *
 * Requests go through the app's own server-side proxy (`/api/weather/...`, see
 * vite.config.ts) so the API key stays on the server and is never visible to
 * site visitors. A key pasted into the UI is only used to identify which key
 * is active — it is still never attached in the browser. Direct browser →
 * Google calls are kept for local self-hosting without the proxy.
 *
 * Every field below mirrors the published discovery schema. Anything the API
 * does not return stays `undefined` and is rendered as unknown — never guessed.
 */

/** Same-origin proxy (Vite or Vercel attaches the key server-side). */
const PROXY_BASE = "/api/weather";
/** Direct browser → Google fallback for static hosting without the proxy. */
const DIRECT_BASE = "https://weather.googleapis.com/v1";

/* ── schema types (discovery document: weather.googleapis.com/$discovery/rest) ── */

export interface WxTemperature {
  degrees?: number;
  unit?: "UNIT_UNSPECIFIED" | "CELSIUS" | "FAHRENHEIT";
}

export interface WxWindSpeed {
  value?: number;
  unit?: "UNIT_UNSPECIFIED" | "KILOMETERS_PER_HOUR" | "MILES_PER_HOUR";
}

export interface WxWindDirection {
  degrees?: number;
  cardinal?: string;
}

export interface WxWind {
  speed?: WxWindSpeed;
  gust?: WxWindSpeed;
  direction?: WxWindDirection;
}

export interface WxLocalizedText {
  text?: string;
  languageCode?: string;
}

export interface WxWeatherCondition {
  type?: string;
  /** Base URI without extension — append ".svg" (or ".png") to render it. */
  iconBaseUri?: string;
  description?: WxLocalizedText;
}

export interface WxPrecipProbability {
  percent?: number;
  type?: string;
}

export interface WxPrecipitation {
  probability?: WxPrecipProbability;
  qpf?: { unit?: string; quantity?: number };
}

export interface WxInterval {
  startTime?: string;
  endTime?: string;
}

export interface WxCurrent {
  currentTime?: string;
  timeZone?: { id?: string; version?: string };
  weatherCondition?: WxWeatherCondition;
  temperature?: WxTemperature;
  feelsLikeTemperature?: WxTemperature;
  relativeHumidity?: number;
  uvIndex?: number;
  cloudCover?: number;
  thunderstormProbability?: number;
  isDaytime?: boolean;
  airPressure?: { meanSeaLevelMillibars?: number };
  wind?: WxWind;
  precipitation?: WxPrecipitation;
  visibility?: { distance?: number; unit?: string };
}

export interface WxHour {
  interval?: WxInterval;
  weatherCondition?: WxWeatherCondition;
  temperature?: WxTemperature;
  precipitation?: WxPrecipitation;
  wind?: WxWind;
  relativeHumidity?: number;
  cloudCover?: number;
  isDaytime?: boolean;
}

export interface WxAlert {
  alertId?: string;
  alertTitle?: WxLocalizedText;
  eventType?: string;
  severity?: "SEVERITY_UNKNOWN" | "EXTREME" | "SEVERE" | "MODERATE" | "MINOR";
  urgency?: string;
  certainty?: string;
  areaName?: string;
  description?: string;
  instruction?: string[];
  startTime?: string;
  expirationTime?: string;
  dataSource?: { name?: string; authorityUri?: string };
  safetyRecommendations?: { directive?: string; subtext?: string }[];
}

/* ── result bundle ─────────────────────────────────────────────────────── */

export interface WeatherBundle {
  current: WxCurrent;
  /** Next hours of forecast (12 requested). */
  hours: WxHour[];
  alerts: WxAlert[];
  /** IANA time zone of the queried point (from the current-conditions reply). */
  timeZoneId?: string;
  regionCode?: string;
  /** When this bundle was retrieved (ISO). */
  retrievedAt: string;
}

/** Classified failure with a message we are willing to show a user. */
export class WeatherError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "WeatherError";
    this.hint = hint;
  }
}

/* ── fetch helpers ─────────────────────────────────────────────────────── */

interface ApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { reason?: string; message?: string }[];
  };
}

const classify = (status: number, body: ApiErrorBody | null): WeatherError => {
  const message = body?.error?.message ?? `HTTP ${status}`;
  const reason = body?.error?.details?.[0]?.reason ?? "";

  if (reason === "API_KEY_INVALID" || /api key/i.test(message)) {
    return new WeatherError(
      `Google rejected the API key (${message})`,
      "Check the key — it must be a Google Cloud API key from a project with the Weather API enabled.",
    );
  }
  if (status === 400) {
    return new WeatherError(`Google rejected the request (400) — ${message}`, "");
  }
  if (status === 403) {
    const blocked = /referer|restriction|blocked/i.test(message);
    return new WeatherError(
      `Google denied the request (403) — ${message}`,
      blocked
        ? "The key is probably HTTP-restricted. Add this site's origin (or no referrer restriction) in Credentials."
        : "Enable the Maps Platform Weather API on the key's project and make sure billing is active.",
    );
  }
  if (status === 429) {
    return new WeatherError(
      "Google Weather API quota exceeded (429)",
      "Wait for the quota window to reset or request a higher quota for the key.",
    );
  }
  if (status === 503 && /GOOGLE_API_KEY/i.test(message)) {
    return new WeatherError(
      "Google Weather API is not configured on the server",
      "Add a rotated Google Maps Platform Weather API key as GOOGLE_API_KEY in Vercel Production environment variables, then redeploy. The full key is never shown in this app.",
    );
  }
  return new WeatherError(`Weather request failed (${status}) — ${message}`, "");
};

const proxyConfigured = (): boolean =>
  Boolean((import.meta.env as Record<string, unknown>).VITE_WEATHER_PROXY);

/** True when requests are routed through the app's own key-holding proxy. */
export const isWeatherProxyMode = proxyConfigured;

const get = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  // The proxy carries the key server-side, so it wins whenever the page is
  // served by our dev/preview server. A user-pasted key instead selects the
  // direct browser → Google path (key in the query string, per Google's spec).
  const useProxy = proxyConfigured();
  const qs = new URLSearchParams(params);
  const requestUrl = useProxy
    ? (() => {
        qs.delete("key");
        qs.set("endpoint", path);
        return `${PROXY_BASE}?${qs.toString()}`;
      })()
    : `${DIRECT_BASE}/${path}?${qs.toString()}`;
  let res: Response;
  try {
    res = await fetch(requestUrl);
  } catch {
    throw new WeatherError(
      useProxy
        ? "Network error reaching the weather proxy"
        : "Network error reaching weather.googleapis.com",
      useProxy
        ? "The app server could not be reached — is the dev/preview server running?"
        : "The browser blocked or dropped the request — check the connection and try again.",
    );
  }

  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }

  if (!res.ok) throw classify(res.status, body);
  return body as unknown as T;
};

/**
 * Fetch current conditions + the next 12 hours + public alerts for one point.
 * All three calls run together; an alerts failure degrades to "no alerts"
 * rather than killing the card (many points simply have no alert feed).
 *
 * `key` is the UI-held key (localStorage / build env). It is only sent to
 * Google when the app runs WITHOUT its weather proxy (static hosting); behind
 * the proxy the server attaches its own key and this value is stripped.
 */export const fetchGoogleWeather = async (
  latitude: number,
  longitude: number,
  key = "",
): Promise<WeatherBundle> => {
  // Only the direct (no-proxy) path needs a key in the browser.
  if (!isWeatherProxyMode() && !key) {
    throw new WeatherError(
      "No Google API key configured",
      "Paste a Google Maps Platform API key with the Weather API enabled.",
    );
  }

  const common = {
    "location.latitude": String(latitude),
    "location.longitude": String(longitude),
    languageCode: "en",
    key,
  };

  const [currentRes, hoursRes, alertsRes] = await Promise.allSettled([
    // the current-conditions reply IS the resource (no response wrapper)
    get<WxCurrent>("currentConditions:lookup", {
      ...common,
      unitsSystem: "METRIC",
    }),
    get<{ forecastHours?: WxHour[]; timeZone?: { id?: string } }>("forecast/hours:lookup", {
      ...common,
      unitsSystem: "METRIC",
      hours: "12",
      pageSize: "12",
    }),
    get<{ weatherAlerts?: WxAlert[]; regionCode?: string }>("publicAlerts:lookup", {
      ...common,
      pageSize: "10",
    }),
  ]);

  // current conditions are the backbone — their failure is fatal
  if (currentRes.status === "rejected") throw currentRes.reason;
  const current = currentRes.value;

  if (!current?.temperature) {
    throw new WeatherError(
      "Google returned no current conditions for this point",
      "Try again in a moment; the point may be outside coverage.",
    );
  }

  const hours = hoursRes.status === "fulfilled" ? (hoursRes.value.forecastHours ?? []) : [];

  return {
    current,
    hours,
    alerts:
      alertsRes.status === "fulfilled" ? (alertsRes.value.weatherAlerts ?? []) : [],
    timeZoneId: hoursRes.status === "fulfilled" ? hoursRes.value.timeZone?.id : current.timeZone?.id,
    regionCode: alertsRes.status === "fulfilled" ? alertsRes.value.regionCode : undefined,
    retrievedAt: new Date().toISOString(),
  };
};

/* ── display helpers (pure, safe with missing fields) ──────────────────── */

/** Degrees Celsius, rounded — "29°", or null when unknown. */
export const tempC = (t?: WxTemperature): number | null =>
  t?.degrees === undefined ? null : Math.round(t.degrees);

/** Wind speed shown in km/h (API returns km/h under METRIC). */
export const windKph = (w?: WxWind): number | null =>
  w?.speed?.value === undefined
    ? null
    : w.speed.unit === "MILES_PER_HOUR"
      ? Math.round(w.speed.value * 1.60934)
      : Math.round(w.speed.value);

const CARDINALS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

/** Compass label for "direction the wind comes from" — 16-point, or null. */
export const windCardinal = (w?: WxWind): string | null => {
  if (w?.direction?.cardinal && w.direction.cardinal !== "CARDINAL_UNSPECIFIED") {
    return w.direction.cardinal.replaceAll("_", " ").toLowerCase();
  }
  if (w?.direction?.degrees === undefined) return null;
  const i = Math.round((((w.direction.degrees % 360) + 360) % 360) / 22.5) % 16;
  return CARDINALS[i];
};

/** "Rain" from a condition type enum like HEAVY_RAIN → human wording. */
export const conditionLabel = (c?: WxWeatherCondition): string | null => {
  if (c?.description?.text) return c.description.text;
  if (!c?.type || c.type === "TYPE_UNSPECIFIED") return null;
  return c.type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

/** Google's hosted condition icon (light theme), or null. */
export const conditionIcon = (c?: WxWeatherCondition): string | null =>
  c?.iconBaseUri ? `${c.iconBaseUri}.svg` : null;

/** Local "HH:MM" at the queried point, from a UTC instant + IANA zone. */
export const localClock = (iso: string | undefined, timeZone?: string): string => {
  if (!iso) return "--:--";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
};
