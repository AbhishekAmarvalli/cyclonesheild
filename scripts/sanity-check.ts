import { getDistrict } from "../src/data/districts";
import { getScenario } from "../src/data/scenarios";
import { assetsForDistrict } from "../src/data/assets";
import { runAnalysis } from "../src/lib/analysis";
import { predictNextStep } from "../src/lib/prediction";

const show = (scenarioId: string, steps: number[], verbose = false) => {
  const s = getScenario(scenarioId);
  const d = getDistrict(s.districtId);
  const assets = assetsForDistrict(s.districtId);
  console.log(`\n=== ${s.name} (${s.kind}) · ${assets.length} assets ===`);
  for (const step of steps) {
    const run = runAnalysis(d, s, assets, step);
    const t = run.scenario.track[step];
    const hist = { P1: 0, P2: 0, P3: 0, P4: 0 };
    run.rows.forEach((r) => (hist[r.band] += 1));
    console.log(
      `  step ${step} ${t.time} ${t.windKt}kt | reach ${run.surgeReachKm.toFixed(
        2,
      )}km | zones ${run.hazards.length} | exposed ${run.rows.length} | P1 ${hist.P1} P2 ${
        hist.P2
      } P3 ${hist.P3} P4 ${hist.P4} | scores ${run.rows.map((r) => r.score).join(",")}`,
    );
    if (verbose) {
      run.rows.forEach((r) =>
        console.log(
          `     ${String(r.score).padStart(3)} ${r.band} ${r.severity.padEnd(8)} V=${
            r.vulnerabilityScore ?? "unk"
          } I=${r.importanceScore.toFixed(2)} hits=${r.hits
            .map((h) => `${h.kind}:${h.severity}`)
            .join("+")}  ${r.asset.name}`,
        ),
      );
      run.unexposed.forEach((a) => console.log(`      --  unexposed: ${a.name}`));
    }
  }
};

show("hudhud-2014", [0, 3, 4, 5, 6]);
show("arjuna-synthetic", [4, 5]);
show("titli-2018", [2, 3, 4]);
show("fani-2019", [3, 4], true);

show("hudhud-2014", [5, 6], true);
show("titli-2018", [3], true);

const s = getScenario("hudhud-2014");
const d = getDistrict(s.districtId);
const assets = assetsForDistrict(s.districtId);
const a = runAnalysis(d, s, assets, 5);
const b = runAnalysis(d, s, assets, 5);
console.log(
  "\ndeterministic:",
  JSON.stringify(a.rows.map((r) => [r.asset.id, r.score])) ===
    JSON.stringify(b.rows.map((r) => [r.asset.id, r.score])),
);

const fani = getScenario("fani-2019");
const puri = getDistrict(fani.districtId);
const puriAssets = assetsForDistrict(fani.districtId);
const faniRunA = runAnalysis(puri, fani, puriAssets, 4);
const faniRunB = runAnalysis(puri, fani, puriAssets, 4);
console.log(
  "Fani replay deterministic:",
  JSON.stringify(faniRunA.rows.map((r) => [r.asset.id, r.score])) ===
    JSON.stringify(faniRunB.rows.map((r) => [r.asset.id, r.score])),
);

const faniForecast = predictNextStep(fani, 3);
if (!faniForecast || faniForecast.leadHours !== 15 || faniForecast.predictedWindKmh !== 190) {
  throw new Error("Fani 15-hour trend forecast did not match the replay expectation.");
}
console.log(
  `Fani 15-hour trend forecast: ${faniForecast.predictedWindKmh} km/h vs ${faniForecast.observedWindKmh} km/h next-step track; location error ${Math.round(faniForecast.locationErrorKm)} km`,
);

const faniLandfallIndex = fani.track.findIndex((point) => point.label === "Landfall");
const faniLeadSamples = Array.from({ length: faniLandfallIndex - 1 }, (_, index) =>
  predictNextStep(fani, index + 1),
).filter((sample): sample is NonNullable<typeof sample> => sample !== null);
const beforeLandfall = faniLeadSamples.map(
  (sample) => (Date.parse(fani.landfall.time) - Date.parse(sample.input.time)) / 3_600_000,
);
const stepForecastHours = faniLeadSamples.map((sample) => sample.leadHours);
const timing = {
  earliestInputHours: Math.max(...beforeLandfall),
  latestInputHours: Math.min(...beforeLandfall),
  shortestStepHours: Math.min(...stepForecastHours),
  longestStepHours: Math.max(...stepForecastHours),
};
if (
  timing.earliestInputHours !== 63 ||
  timing.latestInputHours !== 15 ||
  timing.shortestStepHours !== 15 ||
  timing.longestStepHours !== 24
) {
  throw new Error(`Unexpected Fani replay timing range: ${JSON.stringify(timing)}`);
}
console.log(
  `Fani prototype timing: input snapshots ${timing.earliestInputHours}–${timing.latestInputHours} h before landfall; next-point horizon ${timing.shortestStepHours}–${timing.longestStepHours} h`,
);
