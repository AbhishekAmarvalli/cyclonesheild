import { useEffect, useState, type SyntheticEvent } from "react";
import type { District } from "../types";
import { activeGoogleKey, writeGoogleKey } from "../lib/config";
import {
  conditionIcon,
  conditionLabel,
  fetchGoogleWeather,
  isWeatherProxyMode,
  localClock,
  tempC,
  windCardinal,
  windKph,
  WeatherError,
  type WeatherBundle,
  type WxHour,
} from "../lib/weather";
import { fmtIST } from "../lib/format";

interface Props {
  district: District;
}

type Phase = "no-key" | "loading" | "live" | "error";

const SEVERITY_CLASS: Record<string, string> = {
  EXTREME: "wx-alert--severe",
  SEVERE: "wx-alert--severe",
  MODERATE: "wx-alert--moderate",
  MINOR: "",
  SEVERITY_UNKNOWN: "",
};

const hideBrokenIcon = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
};

const HourChip = ({ hour, tz }: { hour: WxHour; tz?: string }) => (
  <div className="wx-hour">
    <span className="hh">{localClock(hour.interval?.startTime, tz)}</span>
    {conditionIcon(hour.weatherCondition) && (
      <img
        src={conditionIcon(hour.weatherCondition) ?? ""}
        alt=""
        width={18}
        height={18}
        onError={hideBrokenIcon}
      />
    )}
    <b>{tempC(hour.temperature) ?? "--"}°</b>
    <span className="rr">{hour.precipitation?.probability?.percent ?? 0}%</span>
  </div>
);

export default function WeatherPanel({ district }: Props) {
  // Behind the app's proxy the visitor never needs a key; the field is then
  // only a self-hosting convenience (direct mode) and stays empty.
  const proxyMode = isWeatherProxyMode();
  const [apiKey, setApiKey] = useState(() => (proxyMode ? "" : activeGoogleKey()));
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<Phase>(proxyMode ? "loading" : activeGoogleKey() ? "loading" : "no-key");
  const [data, setData] = useState<WeatherBundle | null>(null);
  const [err, setErr] = useState<WeatherError | null>(null);
  const [reload, setReload] = useState(0);

  const key = apiKey.trim();

  useEffect(() => {
    if (!proxyMode && !key) {
      setPhase("no-key");
      setData(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setPhase("loading");
    fetchGoogleWeather(district.center[1], district.center[0], key)
      .then((bundle) => {
        if (cancelled) return;
        setData(bundle);
        setErr(null);
        setPhase("live");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setData(null);
        setErr(
          e instanceof WeatherError
            ? e
            : new WeatherError(e instanceof Error ? e.message : "Weather request failed", ""),
        );
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [proxyMode, key, district.center, district.id, reload]);

  const statusSub =
    phase === "live"
      ? proxyMode
        ? `live · ${district.name} · proxied`
        : `live · ${district.name}`
      : phase === "loading"
        ? "contacting Google…"
        : phase === "error"
          ? "unavailable"
          : "not connected";

  const keyField = (
    <div className="field" style={{ marginTop: 10 }}>
      <span className="label">Google Maps Platform API key</span>
      <div className="wx-keyrow">
        <input
          className="textinput"
          type={showKey ? "text" : "password"}
          value={apiKey}
          placeholder="AIza… (Weather API enabled)"
          autoComplete="off"
          onChange={(e) => {
            setApiKey(e.target.value);
            writeGoogleKey(e.target.value.trim());
          }}
          style={{ fontWeight: 400 }}
        />
        <button className="btn btn--sm" type="button" onClick={() => setShowKey((s) => !s)}>
          {showKey ? "hide" : "show"}
        </button>
      </div>
    </div>
  );

  const current = data?.current;
  const tz = data?.timeZoneId;

  return (
    <section className="card card--blue" data-testid="weather">
      <div className="card-head">
        <h2>Live weather</h2>
        <span className="sub">{statusSub}</span>
      </div>

      {phase === "no-key" && (
        <>
          <p className="note note--info">
            <b>Connect Google weather.</b> Paste a Google Maps Platform API key with the{" "}
            <b>Weather API</b> enabled (Cloud Console → APIs &amp; Services → Credentials →
            Create credentials → API key). The key stays in this browser. Without it the card
            stays offline — everything else keeps working.
          </p>
          {proxyMode ? (
            <p className="weather-key-status">
              Server key hint: <code>AQ.Ab8RN6••••••••</code> · full key stays in Vercel, not in this page.
            </p>
          ) : keyField}
        </>
      )}

      {phase === "loading" && (
        <p className="note">
          Fetching current conditions, the next 12 hours and public alerts for {district.name}…
        </p>
      )}

      {phase === "error" && err && (
        <>
          <div className="note note--warn">
            <b>Weather unavailable.</b> {err.message}
            {err.hint && (
              <>
                <br />
                {err.hint}
              </>
            )}
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn--sm" type="button" onClick={() => setReload((r) => r + 1)}>
              Retry
            </button>
          </div>
          {proxyMode ? (
            <p className="weather-key-status">
              Server key hint: <code>AQ.Ab8RN6••••••••</code> · full key stays in Vercel, not in this page.
            </p>
          ) : keyField}
        </>
      )}

      {phase === "live" && data && current && (
        <>
          <div className="wx-now">
            {conditionIcon(current.weatherCondition) && (
              <img
                className="wx-icon"
                src={conditionIcon(current.weatherCondition) ?? ""}
                alt=""
                width={40}
                height={40}
                onError={hideBrokenIcon}
              />
            )}
            <span className="wx-temp">{tempC(current.temperature) ?? "--"}°</span>
            <span className="wx-cond">
              <b>{conditionLabel(current.weatherCondition) ?? "Unknown conditions"}</b>
              <span>
                feels {tempC(current.feelsLikeTemperature) ?? "--"}° ·{" "}
                {windKph(current.wind) ?? "--"} km/h
                {windCardinal(current.wind) ? ` from ${windCardinal(current.wind)}` : ""}
              </span>
            </span>
          </div>

          <dl className="kv">
            <dt>Rain chance now</dt>
            <dd>{current.precipitation?.probability?.percent ?? "unknown"}%</dd>
            <dt>Humidity</dt>
            <dd>{current.relativeHumidity ?? "unknown"}%</dd>
            <dt>Pressure</dt>
            <dd>
              {current.airPressure?.meanSeaLevelMillibars !== undefined
                ? `${Math.round(current.airPressure.meanSeaLevelMillibars)} hPa`
                : "unknown"}
            </dd>
            <dt>Cloud cover</dt>
            <dd>{current.cloudCover ?? "unknown"}%</dd>
            <dt>UV index</dt>
            <dd>{current.uvIndex ?? "unknown"}</dd>
          </dl>

          {data.hours.length > 0 && (
            <>
              <div className="section-label">Next 12 hours</div>
              <div className="wx-hours">
                {data.hours.map((h) => (
                  <HourChip key={h.interval?.startTime ?? ""} hour={h} tz={tz} />
                ))}
              </div>
            </>
          )}

          <div className="section-label">Public weather alerts</div>
          {data.alerts.length === 0 ? (
            <p className="note">
              No active public weather alerts returned for this point right now. Absence of an
              alert is not an “all clear” — check IMD/RSMC bulletins for official warnings.
            </p>
          ) : (
            data.alerts.map((a, i) => (
              <div
                key={a.alertId ?? `${a.startTime ?? "alert"}-${i}`}
                className={`wx-alert ${SEVERITY_CLASS[a.severity ?? ""] ?? ""}`}
              >
                <div className="wx-alert-head">
                  <span
                    className={`chip ${a.severity === "EXTREME" || a.severity === "SEVERE" ? "chip--red" : "chip--yellow"}`}
                  >
                    {(a.severity ?? "unknown").toLowerCase()}
                  </span>
                  <b>{a.alertTitle?.text ?? a.eventType ?? "Alert"}</b>
                </div>
                <p>
                  {a.areaName && <span className="wx-alert-area">{a.areaName} · </span>}
                  {a.description ?? "No description provided."}
                </p>
                {a.instruction && a.instruction.length > 0 && (
                  <p className="wx-alert-instr">{a.instruction[0]}</p>
                )}
                {a.dataSource?.name && (
                  <span className="wx-alert-src">source: {a.dataSource.name}</span>
                )}
              </div>
            ))
          )}

          <p className="wx-src">
            Google Maps Platform Weather API · current + 12 h forecast + publicAlerts ·
            retrieved {fmtIST(data.retrievedAt)}
            {tz ? ` · point time zone ${tz}` : ""} ·{" "}
            {proxyMode ? (
              <>
                server key <code>AQ.Ab8RN6••••••••</code> · held server-side (<b>not exposed to visitors</b>) ·{" "}
              </>
            ) : (
              <>
                key held in this browser ·{" "}
              </>
            )}
            <b>live now — separate from the scenario timeline above</b>.
            <button
              className="btn btn--sm btn--ghost"
              type="button"
              onClick={() => setReload((r) => r + 1)}
            >
              Refresh
            </button>
          </p>
        </>
      )}
    </section>
  );
}
