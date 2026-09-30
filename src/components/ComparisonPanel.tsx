import { useState } from "react";
import type { Scenario } from "../types";
import type { AnalysisRun } from "../lib/analysis";
import { FANI_INCIDENT } from "../data/incidents";
import { fmtIST } from "../lib/format";
import { predictNextStep } from "../lib/prediction";

interface Props {
  scenario: Scenario;
  run: AnalysisRun;
  onStep: (index: number) => void;
}

export default function ComparisonPanel({ scenario, run, onStep }: Props) {
  const [saved, setSaved] = useState(false);
  const prediction = predictNextStep(scenario, run.stepIndex);
  const p1p2 = run.bandCounts.P1 + run.bandCounts.P2;
  const landfallIndex = scenario.track.findIndex((point) => point.label === "Landfall");
  const maxInputIndex = Math.max(1, landfallIndex - 1);
  const reportWind = FANI_INCIDENT.sustainedWindKmh;
  const leadSamples = scenario.track
    .slice(1, maxInputIndex + 1)
    .map((_, index) => predictNextStep(scenario, index + 1))
    .filter((value) => value !== null);
  const hoursBeforeLandfall = (inputTime: string) =>
    (Date.parse(scenario.landfall.time) - Date.parse(inputTime)) / 3_600_000;
  const landfallLeadHours = leadSamples.map((sample) => hoursBeforeLandfall(sample.input.time));
  const stepLeadHours = leadSamples.map((sample) => sample.leadHours);
  const maxReplayLead = Math.max(...landfallLeadHours);
  const minReplayLead = Math.min(...landfallLeadHours);
  const maxStepLead = Math.max(...stepLeadHours);
  const minStepLead = Math.min(...stepLeadHours);
  const days = (hours: number) => `${(hours / 24).toFixed(1)} days`;
  const comparisonWind = prediction?.observedNext.label === "Landfall"
    ? reportWind
    : prediction
      ? [prediction.observedWindKmh, prediction.observedWindKmh]
      : reportWind;
  const deltaLow = prediction ? prediction.predictedWindKmh - comparisonWind[1] : 0;
  const deltaHigh = prediction ? prediction.predictedWindKmh - comparisonWind[0] : 0;
  const deltaMagnitude = (low: number, high: number) =>
    low === high ? `${low} km/h` : `${low}–${high} km/h`;

  const downloadRecord = () => {
    if (!prediction) return;
    const record = {
      product: "CycloneSheild",
      schema: "cyclonesheild-replay-record/v1",
      recordedAt: new Date().toISOString(),
      caseStudy: {
        scenario: scenario.name,
        code: scenario.code,
        inputTime: prediction.input.time,
        leadHours: prediction.leadHours,
        method: "One-step linear extrapolation from the two prior track observations; prototype baseline only.",
      },
      prediction: {
        estimatedWindKmh: prediction.predictedWindKmh,
        estimatedNextPosition: prediction.predictedPoint,
        priorityCounts: run.bandCounts,
        exposedAssets: run.rows.map((row) => ({
          id: row.asset.id,
          name: row.asset.name,
          priority: row.band,
          score: row.score,
          provenance: row.asset.provenance.status,
        })),
      },
      observed: {
        reportedLandfall: FANI_INCIDENT.landfallLabel,
        location: FANI_INCIDENT.locationLabel,
        sustainedWindKmh: reportWind,
        gustKmh: FANI_INCIDENT.maxGustKmh,
        impacts: FANI_INCIDENT.impacts,
        nextTrackPoint: prediction.observedNext,
      },
      sources: [FANI_INCIDENT.url, scenario.bulletin.url],
      limitations: [
        "Illustrative Puri study-area geometry and synthetic asset register.",
        "Trend extrapolation is not a trained or validated operational forecast model.",
        "Hazard footprints are prepared/simulated; priority is an exposure screen, not damage prediction.",
      ],
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cyclonesheild-fani-${prediction.input.time.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="comparison-heading">
        <div>
          <p className="eyebrow">Historical replay · 3 May 2019 · Puri, Odisha</p>
          <h2 id="comparison-title">Cyclone Fani: forecast vs real incident</h2>
          <p className="comparison-intro">
            Rewind to the data available before landfall, then compare the prototype forecast with the event record.
          </p>
        </div>
        <span className="chip chip--yellow">Retrospective · not a live warning</span>
      </div>

      {prediction && (
        <>
          <div className="replay-control">
            <label htmlFor="replay-input-step">Forecast input time</label>
            <input
              id="replay-input-step"
              type="range"
              min={1}
              max={maxInputIndex}
              step={1}
              value={run.stepIndex}
              onChange={(event) => {
                setSaved(false);
                onStep(Number(event.target.value));
              }}
              aria-label="Historical data cutoff for forecast"
            />
            <output htmlFor="replay-input-step">
              {fmtIST(prediction.input.time)} · {prediction.leadHours} h to next track point
            </output>
          </div>
          <section className="prototype-lead" aria-label="Prototype forecast timing range">
            <div className="prototype-lead-heading">
              <span className="google-glyph" aria-hidden="true">G</span>
              <div>
                <h3>Prototype timing range</h3>
                <p>Measured on this historical Fani replay only</p>
              </div>
            </div>
            <div className="prototype-lead-stat">
              <span>Replay inputs before landfall</span>
              <strong>{days(maxReplayLead)} to {days(minReplayLead)}</strong>
              <small>earliest to latest tested snapshot</small>
            </div>
            <div className="prototype-lead-stat">
              <span>Forecast horizon per step</span>
              <strong>{minStepLead}–{maxStepLead} h</strong>
              <small>{days(minStepLead)}–{days(maxStepLead)} ahead to the next track point</small>
            </div>
            <p className="prototype-lead-note">
              <b>Prototype only:</b> historical inputs span about {days(minReplayLead)} to {days(maxReplayLead)} before actual landfall, but each estimate predicts only the next 15–24 hour track step. This is not a guaranteed warning lead time or an operational forecast.
            </p>
          </section>
        </>
      )}

      <div className="comparison-columns">
        <article className="comparison-side comparison-side--observed">
          <div className="comparison-side-head">
            <span className="comparison-index">01</span>
            <div>
              <h3>What happened</h3>
              <p>Post-event assessment</p>
            </div>
            <span className="chip chip--green">Reported</span>
          </div>
          <div className="comparison-stat-grid">
            <div className="comparison-stat">
              <span>Landfall</span>
              <strong>{FANI_INCIDENT.landfallLabel.split(" · ")[0]}</strong>
              <small>{FANI_INCIDENT.locationLabel}</small>
            </div>
            <div className="comparison-stat">
              <span>Observed wind</span>
              <strong>{reportWind[0]}–{reportWind[1]} km/h</strong>
              <small>Reported gusts reached {FANI_INCIDENT.maxGustKmh} km/h</small>
            </div>
          </div>
          <p className="comparison-impact">
            {FANI_INCIDENT.impacts.join(" ")}
          </p>
        </article>

        <article className="comparison-side comparison-side--model">
          <div className="comparison-side-head">
            <span className="comparison-index">02</span>
            <div>
              <h3>What the prototype predicted</h3>
              <p>Trend baseline · {prediction ? `${prediction.leadHours} h lead time` : "input unavailable"}</p>
            </div>
            <span className="chip chip--blue">Prototype run</span>
          </div>
          <div className="comparison-stat-grid">
            {prediction ? (
              <>
                <div className="comparison-stat">
                  <span>Estimated next-step wind</span>
                  <strong>{prediction.predictedWindKmh} km/h</strong>
                  <small>Observed next step: {prediction.observedWindKmh} km/h</small>
                </div>
                <div className="comparison-stat">
                  <span>Track position error</span>
                  <strong>{Math.round(prediction.locationErrorKm)} km</strong>
                  <small>Against rounded next-step track point</small>
                </div>
                <div className="comparison-stat">
                  <span>Assets flagged at input time</span>
                  <strong>{run.rows.length} <small>of {run.rows.length + run.unexposed.length}</small></strong>
                  <small>{p1p2} P1/P2 · {run.bandCounts.P3} P3 · {run.bandCounts.P4} P4</small>
                </div>
              </>
            ) : (
              <p className="comparison-impact">Choose an input time with a previous and next track point to run the forecast.</p>
            )}
          </div>
          <p className="comparison-impact">
            The asset flags are a separate exposure screen using illustrative facilities and roads. A priority is not a prediction of damage.
          </p>
        </article>
      </div>

      <div className="comparison-readout" role="note">
        <span className="readout-mark" aria-hidden="true">!</span>
        {prediction ? (
          <p>
            <strong>
              Difference: the trend baseline estimated {prediction.predictedWindKmh} km/h, {deltaLow > 0 ? (
                <>about {deltaMagnitude(deltaLow, deltaHigh)} above the {prediction.observedNext.label === "Landfall" ? `reported ${reportWind[0]}–${reportWind[1]} km/h landfall range` : `${prediction.observedWindKmh} km/h next-step observation`}.</>
              ) : deltaHigh < 0 ? (
                <>about {deltaMagnitude(Math.abs(deltaHigh), Math.abs(deltaLow))} below the {prediction.observedWindKmh} km/h next-step observation.</>
              ) : (
                <>within the observed next-step wind range.</>
              )}
            </strong>{" "}
            At this input time, {p1p2} assets reached P1/P2; the post-event assessment reports severe impacts. Sample assets and simulated hazard layers limit this comparison.
          </p>
        ) : (
          <p><strong>Forecast unavailable for this input time.</strong> Select an earlier time with enough history to estimate the next step.</p>
        )}
      </div>

      <div className="replay-method-row">
        <p><strong>How the forecast works:</strong> straight-line extrapolation from the two previous track points. This is a simple demo baseline, not a trained AI forecast. Gemini is used for advisory drafting.</p>
        <button className="btn btn--ghost" type="button" onClick={downloadRecord} disabled={!prediction}>
          Download replay record
        </button>
        <span className="sr-only" aria-live="polite">{saved ? "Replay record downloaded." : ""}</span>
      </div>

      <div className="comparison-sources">
        <span>Sources</span>
        <a
          href="https://recovery.preventionweb.net/publication/documents-and-publications/cyclone-fani-damage-loss-and-needs-assessment"
          target="_blank"
          rel="noreferrer"
        >
          Odisha Government / UN / World Bank / ADB post-disaster assessment
        </a>
        <a
          href={scenario.bulletin.url}
          target="_blank"
          rel="noreferrer"
        >
          IMD preliminary report
        </a>
      </div>
    </section>
  );
}