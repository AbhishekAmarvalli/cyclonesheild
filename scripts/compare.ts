import { getDistrict } from "../src/data/districts";
import { getScenario } from "../src/data/scenarios";
import { assetsForDistrict } from "../src/data/assets";
import { runAnalysis } from "../src/lib/analysis";

const hits = (scenarioId: string, step: number) => {
  const s = getScenario(scenarioId);
  const run = runAnalysis(getDistrict(s.districtId), s, assetsForDistrict(s.districtId), step);
  return new Map(
    run.rows.map((r) => [
      r.asset.id,
      `${r.score}/${r.band} ` + r.hits.map((h) => `${h.kind}:${h.severity}`).join("+"),
    ]),
  );
};

const a = hits("hudhud-2014", 5);
const b = hits("arjuna-synthetic", 5);

console.log("asset".padEnd(30), "| hudhud | arjuna");
for (const id of new Set([...a.keys(), ...b.keys()])) {
  const x = a.get(id) ?? "—";
  const y = b.get(id) ?? "—";
  console.log(
    id.padEnd(30),
    "|",
    x.padEnd(36),
    "|",
    y.padEnd(36),
    x === y ? "" : "  ← differs",
  );
}

// exposure across steps
console.log("\nstep-by-step exposed counts:");
for (const id of ["hudhud-2014", "arjuna-synthetic", "titli-2018"]) {
  const s = getScenario(id);
  const assets = assetsForDistrict(s.districtId);
  const d = getDistrict(s.districtId);
  const counts = s.track.map((_, i) => {
    const r = runAnalysis(d, s, assets, i);
    return `${r.rows.length}/${r.hazards.length}`;
  });
  console.log(` ${id.padEnd(18)}`, counts.join("  "));
}
