import { useEffect, useMemo, useState } from "react";
import MapPanel from "./components/MapPanel";
import ScenarioControls from "./components/ScenarioControls";
import WeatherPanel from "./components/WeatherPanel";
import PriorityList from "./components/PriorityList";
import AssetDetails from "./components/AssetDetails";
import AdvisoryPanel from "./components/AdvisoryPanel";
import ComparisonPanel from "./components/ComparisonPanel";
import TrustPanel from "./components/TrustPanel";
import ResponseReadiness from "./components/ResponseReadiness";
import FaniImpactMap from "./components/FaniImpactMap";
import { DISTRICTS, getDistrict } from "./data/districts";
import { getScenario, scenariosForDistrict } from "./data/scenarios";
import { assetsForDistrict } from "./data/assets";
import { runAnalysis } from "./lib/analysis";
import { fmtIST } from "./lib/format";
import type { Scenario } from "./types";

const landfallIndex = (s: Scenario): number => {
  const i = s.track.findIndex((t) => t.label === "Landfall");
  return i < 0 ? Math.floor(s.track.length / 2) : i;
};

const startStep = (s: Scenario): number =>
  s.id === "fani-2019" ? Math.max(1, landfallIndex(s) - 1) : landfallIndex(s);

export default function App() {
  const [districtId, setDistrictId] = useState("puri");
  const [scenarioId, setScenarioId] = useState("fani-2019");
  const [stepIndex, setStepIndex] = useState(startStep(getScenario("fani-2019")));
  const [layers, setLayers] = useState({ wind: true, surge: true, rainfall: true });
  const [selectedId, setSelectedId] = useState<string | null>("viz-kgh");

  const district = getDistrict(districtId);
  const scenarios = scenariosForDistrict(districtId);
  const scenario = getScenario(scenarioId);
  const assets = useMemo(() => assetsForDistrict(districtId), [districtId]);

  const run = useMemo(
    () => runAnalysis(district, scenario, assets, stepIndex),
    [district, scenario, assets, stepIndex],
  );

  // keep a sensible selection when the scenario/district changes
  useEffect(() => {
    setSelectedId(run.rows[0]?.asset.id ?? run.unexposed[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtId, scenarioId]);

  const handleDistrict = (id: string) => {
    const next = scenariosForDistrict(id)[0];
    setDistrictId(id);
    setScenarioId(next.id);
    setStepIndex(startStep(next));
  };

  const handleScenario = (id: string) => {
    const next = getScenario(id);
    setScenarioId(id);
    setStepIndex(startStep(next));
  };

  const layerCounts = useMemo(() => {
    const c = { wind: 0, surge: 0, rainfall: 0 };
    run.hazards.forEach((h) => (c[h.kind] += 1));
    return c;
  }, [run]);

  const visibleHazards = useMemo(
    () => run.hazards.filter((h) => layers[h.kind]),
    [run, layers],
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.2" fill="#1a73e8" stroke="#202124" strokeWidth="1.6" />
              <path
                d="M12 2.6c5.2 0 9.4 4.2 9.4 9.4"
                stroke="#ea4335"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M12 21.4c-5.2 0-9.4-4.2-9.4-9.4"
                stroke="#f9ab00"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M19.6 6.6c1.6 3.4.6 7.6-2.4 10.1"
                stroke="#34a853"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1>CycloneSheild</h1>
            <p>CYCLONE RISK &amp; RESPONSE · {district.name.toUpperCase()}, {district.state.toUpperCase()}</p>
          </div>
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-meta">
          <span className="chip chip--yellow">{scenario.name}</span>
          <span className="chip">Prototype · not a live warning</span>
        </div>
      </header>

      <main className="main-content" id="main" tabIndex={-1}>
        {scenario.id !== "fani-2019" && (
          <section className="selected-scenario-banner">
            <div>
              <p className="eyebrow">Selected model run · {district.name}</p>
              <h2>{scenario.name}</h2>
              <p>{scenario.summary}</p>
            </div>
            <button className="btn btn--primary" onClick={() => handleDistrict("puri")}>
              Return to Fani comparison
            </button>
          </section>
        )}

        <section className="map-priority-row" aria-label="Model map and assets to review">
          <MapPanel
            district={district}
            hazards={visibleHazards}
            rows={run.rows}
            unexposed={run.unexposed}
            scenario={scenario}
            stormPoint={run.storm.point}
            stepIndex={stepIndex}
            selectedId={selectedId}
            onSelect={setSelectedId}
            layerCounts={layerCounts}
          />
          <div className="overview-priority">
            <PriorityList run={run} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </section>

        {scenario.id === "fani-2019" && (
          <section className="historical-map-section">
            <FaniImpactMap />
          </section>
        )}

        {scenario.id === "fani-2019" && (
          <ComparisonPanel scenario={scenario} run={run} onStep={setStepIndex} />
        )}

        {scenario.id === "fani-2019" && <ResponseReadiness />}

        <TrustPanel />

        <AdvisoryPanel run={run} />

        <details className="advanced-workspace">
          <summary>
            <span>Explore the full model workspace</span>
            <small>Scenario timeline, map layers, asset evidence and live weather</small>
          </summary>
          <div className="grid workspace-grid">
            <ScenarioControls
              districts={DISTRICTS}
              district={district}
              onDistrict={handleDistrict}
              scenarios={scenarios}
              scenario={scenario}
              onScenario={handleScenario}
              stepIndex={stepIndex}
              onStep={(i) =>
                setStepIndex(
                  scenario.id === "fani-2019"
                    ? Math.min(i, landfallIndex(scenario) - 1)
                    : i,
                )
              }
              layers={layers}
              onToggleLayer={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              layerCounts={layerCounts}
              run={run}
            >
              <WeatherPanel district={district} />
            </ScenarioControls>

            <div className="detail-column area-detail">
              <AssetDetails run={run} selectedId={selectedId} />
            </div>

          </div>
        </details>
      </main>

      <details className="method-disclosure">
        <summary>Sources, method and prototype limitations</summary>
        <footer className="footnote">
          <b>Method.</b> {run.method.hazard} <b>Priority.</b> {run.method.scoring.join(" · ")}
          <br />
          <b>Important.</b> The hazard footprints are prepared or simulated for this prototype.
          Infrastructure intersecting a footprint is an exposure screen, not a validated damage,
          rainfall, wind-impact or storm-surge forecast. The Fani replay uses rounded historical
          track inputs, so matching its reported wind is not evidence of forecast skill.
          <br />
          <b>Data.</b> The Puri study-area boundary, terrain context and all Puri assets are
          illustrative. Existing Andhra district outlines are simplified; tracks are rounded
          reconstructions of archived guidance; hazard footprints are simulated. Terrain and
          satellite layers use Google Earth Engine when configured; live weather uses Google Maps
          Platform when a key is configured; basemap © OpenStreetMap contributors. {run.notes.join(" ")}
          <br />
          <b>Run generated</b> {fmtIST(run.generatedAt)} · deterministic local engine · Gemini
          advisory uses the evidence packet only · dispatches are simulated.
        </footer>
      </details>
    </div>
  );
}
