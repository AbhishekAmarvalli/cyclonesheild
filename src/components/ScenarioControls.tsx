import type { ReactNode } from "react";
import type { District, Scenario } from "../types";
import type { AnalysisRun } from "../lib/analysis";
import { fmtIST, fmtUTC } from "../lib/format";

interface Props {
  districts: District[];
  district: District;
  onDistrict: (id: string) => void;
  scenarios: Scenario[];
  scenario: Scenario;
  onScenario: (id: string) => void;
  stepIndex: number;
  onStep: (i: number) => void;
  layers: { wind: boolean; surge: boolean; rainfall: boolean };
  onToggleLayer: (k: "wind" | "surge" | "rainfall") => void;
  layerCounts: { wind: number; surge: number; rainfall: number };
  run: AnalysisRun;
  /** Extra cards appended to the left column (live weather, …). */
  children?: ReactNode;
}

const relLabel = (scenario: Scenario, stepIndex: number): string => {
  const t = Date.parse(scenario.track[stepIndex].time);
  const lf = Date.parse(scenario.landfall.time);
  const h = Math.round((t - lf) / 3_600_000);
  if (h === 0) return "at landfall";
  return h < 0 ? `${Math.abs(h)} h before landfall` : `${h} h after landfall`;
};

export default function ScenarioControls({
  districts,
  district,
  onDistrict,
  scenarios,
  scenario,
  onScenario,
  stepIndex,
  onStep,
  layers,
  onToggleLayer,
  layerCounts,
  run,
  children,
}: Props) {
  const tp = scenario.track[stepIndex];
  const pct = (stepIndex / (scenario.track.length - 1)) * 100;
  const lfIndex = scenario.track.findIndex((t) => t.label === "Landfall");

  return (
    <div className="stack area-controls">
      {/* ── district + scenario ─────────────────────────────────────────── */}
      <section className="card card--blue">
        <div className="card-head">
          <h2>Scenario controls</h2>
          <span className="sub">{scenario.code}</span>
        </div>

        <label className="field">
          <span className="label">District</span>
          <select
            className="select"
            value={district.id}
            onChange={(e) => onDistrict(e.target.value)}
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.state}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="label">Cyclone scenario</span>
          {scenarios.map((s) => {
            const active = s.id === scenario.id;
            return (
              <div
                key={s.id}
                className="option-card"
                style={{
                  cursor: "pointer",
                  background: active ? "var(--g-blue-tint)" : "var(--surface-2)",
                  borderColor: active ? "var(--g-blue)" : "var(--line)",
                }}
                onClick={() => onScenario(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onScenario(s.id);
                }}
              >
                <h4>
                  {s.name}
                  <span className={`chip ${s.kind === "recorded" ? "chip--green" : "chip--red"}`}>
                    {s.kind === "recorded" ? "recorded" : "synthetic"}
                  </span>
                </h4>
                <p>{s.classification}</p>
                <dl className="kv">
                  <dt>Landfall</dt>
                  <dd>{fmtIST(s.landfall.time)}</dd>
                  <dt>Place</dt>
                  <dd>{s.landfall.place}</dd>
                  <dt>Peak surge</dt>
                  <dd>{s.peakSurgeM} m</dd>
                  <dt>24 h rain</dt>
                  <dd>{s.peakRainMm24h} mm</dd>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── forecast time ───────────────────────────────────────────────── */}
      <section className="card card--red">
        <div className="card-head">
          <h2>Forecast / valid time</h2>
          <span className="sub">step {stepIndex + 1}/{scenario.track.length}</span>
        </div>

        <div className="option-card" style={{ background: "var(--g-red-tint)" }}>
          <h4>
            {fmtIST(tp.time)}{" "}
            <span className="chip chip--red">{relLabel(scenario, stepIndex)}</span>
          </h4>
          <p>
            Valid time of the storm-centre position used to build every hazard footprint on this
            screen.
          </p>
          <dl className="kv">
            <dt>Centre</dt>
            <dd>
              {tp.lat.toFixed(2)}°N {tp.lon.toFixed(2)}°E
            </dd>
            <dt>Sustained wind</dt>
            <dd>{tp.windKt} kt</dd>
            <dt>Central pressure</dt>
            <dd>{tp.pressureHpa} hPa</dd>
            <dt>Gale radius</dt>
            <dd>{tp.galeRadiusKm} km</dd>
            <dt>UTC</dt>
            <dd>{fmtUTC(tp.time)}</dd>
          </dl>
        </div>

        <input
          className="slider"
          type="range"
          min={0}
          max={scenario.track.length - 1}
          step={1}
          value={stepIndex}
          style={{ ["--pct" as string]: `${pct}%` }}
          onChange={(e) => onStep(Number(e.target.value))}
          aria-label="Forecast valid time step"
        />
        <div className="tick-row">
          <span>{scenario.track[0].time.slice(5, 10).replace("-", "/")}</span>
          {lfIndex > 0 && (
            <span style={{ color: "var(--g-red)", fontWeight: 700 }}>landfall</span>
          )}
          <span>
            {scenario.track[scenario.track.length - 1].time.slice(5, 10).replace("-", "/")}
          </span>
        </div>

        <div className="note note--info" style={{ marginTop: 10 }}>
          <b>Inundation reach now: {run.surgeReachKm.toFixed(1)} km inland.</b> It is derived from
          the distance between this storm-centre position and the coast ({Math.round(run.surgeProximity * 100)}%
          of full surge strength), so moving the slider genuinely changes the footprint.
        </div>
      </section>

      {/* ── layers ──────────────────────────────────────────────────────── */}
      <section className="card card--green">
        <div className="card-head">
          <h2>Map layers</h2>
          <span className="sub">display only</span>
        </div>

        {(
          [
            ["wind", "Wind swath", "#f9ab00", layerCounts.wind],
            ["surge", "Coastal inundation", "#1a73e8", layerCounts.surge],
            ["rainfall", "Rainfall warning cells", "#9334e6", layerCounts.rainfall],
          ] as const
        ).map(([key, label, color, count]) => (
          <div
            key={key}
            className={`toggle-row${layers[key] ? " on" : ""}`}
            onClick={() => onToggleLayer(key)}
            role="switch"
            aria-checked={layers[key]}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onToggleLayer(key);
            }}
          >
            <span className="swatch" style={{ background: color }} />
            <span className="name">{label}</span>
            <span className="count">{count}</span>
            <span className="switch" />
          </div>
        ))}

        <p className="note" style={{ marginTop: 10 }}>
          Layer switches affect the map only — the priority calculation always runs over all three
          hazard types so hiding a layer never changes a score.
        </p>
      </section>

      {/* ── terrain + provenance ────────────────────────────────────────── */}
      <section className="card card--yellow">
        <div className="card-head">
          <h2>Terrain &amp; sources</h2>
        </div>
        <dl className="kv" style={{ marginTop: 0 }}>
          <dt>Elevation min / mean / max</dt>
          <dd>
            {district.terrain.minM} / {district.terrain.meanM} / {district.terrain.maxM} m
          </dd>
          <dt>Below 10 m AMSL</dt>
          <dd>{district.terrain.lowlandSharePct}% of district</dd>
          <dt>Elevation source</dt>
          <dd>SRTM 30 m via Earth Engine</dd>
          <dt>Track source</dt>
          <dd>{scenario.kind === "recorded" ? "IMD RSMC archive (rounded)" : "synthetic input"}</dd>
          <dt>Hazard layers</dt>
          <dd>prepared / simulated</dd>
          <dt>Asset register</dt>
          <dd>hand-compiled sample</dd>
        </dl>
        <p className="note" style={{ marginTop: 10 }}>
          {district.notes}
        </p>
      </section>

      {children}
    </div>
  );
}
