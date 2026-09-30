import type {
  Asset,
  District,
  GeoStatus,
  Point,
  Provenance,
  Scenario,
  Vulnerability,
} from "../types";
import {
  circleRing,
  clamp,
  distToLineMin,
  kmBetween,
  offsetCoastRing,
  ringContains,
  sampleLine,
  type Ring,
} from "./geo";

/**
 * Exposure + transparent priority engine.
 *
 * Pipeline (exactly what the brief asks for):
 *   1. build hazard footprints for the selected forecast step
 *   2. find infrastructure that intersects those footprints
 *   3. assign a transparent priority from hazard severity × asset
 *      vulnerability × service importance (unknown stays unknown)
 *   4. hand the structured result to Gemini — never the other way round
 *
 * Everything here is deterministic and pure: same inputs → same numbers.
 */

export type Severity = "severe" | "high" | "moderate" | "low";
export type HazardKind = "wind" | "surge" | "rainfall";

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
};

/* Deliberately leaves headroom to 1.0 for the multi-hazard bonus below, so an
   asset inside surge + wind + rain outranks one inside wind alone. */
const SEVERITY_WEIGHT: Record<Severity, number> = {
  severe: 0.9,
  high: 0.7,
  moderate: 0.45,
  low: 0.25,
};

const SEVERITY_COLOR: Record<Severity, string> = {
  severe: "#c5221f",
  high: "#ea4335",
  moderate: "#f9ab00",
  low: "#1e8e3e",
};

export const severityColor = (s: Severity) => SEVERITY_COLOR[s];

export interface HazardZone {
  id: string;
  kind: HazardKind;
  severity: Severity;
  label: string;
  detail: string;
  ring: Ring;
  provenance: Provenance;
}

export interface AssetHit {
  zoneId: string;
  kind: HazardKind;
  severity: Severity;
  label: string;
  detail: string;
  matched: number;
  sampled: number;
}

export interface Evidence {
  text: string;
  source: string;
  status: GeoStatus;
  observedAt?: string;
}

export type Band = "P1" | "P2" | "P3" | "P4";

export const BAND_LABEL: Record<Band, string> = {
  P1: "Immediate action",
  P2: "Prepare today",
  P3: "Monitor & verify",
  P4: "Awareness",
};

export interface AssetRow {
  asset: Asset;
  hits: AssetHit[];
  severity: Severity;
  hazardScore: number;
  vulnerabilityScore: number | null;
  vulnerability: Vulnerability;
  importanceScore: number;
  score: number;
  band: Band;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  evidence: Evidence[];
  dataGaps: string[];
  exposedFraction: number;
}

export interface AnalysisRun {
  district: District;
  scenario: Scenario;
  stepIndex: number;
  storm: { point: Point; time: string; windKt: number; galeRadiusKm: number; pressureHpa: number };
  hazards: HazardZone[];
  surgeReachKm: number;
  surgeProximity: number;
  rows: AssetRow[];
  unexposed: Asset[];
  bandCounts: Record<Band, number>;
  notes: string[];
  method: { hazard: string; scoring: string[] };
  generatedAt: string;
}

const IMD_BANDS: { minMm: number; severity: Severity; label: string }[] = [
  { minMm: 204.5, severity: "severe", label: "extremely heavy rainfall zone" },
  { minMm: 115.6, severity: "high", label: "very heavy rainfall zone" },
  { minMm: 64.5, severity: "moderate", label: "heavy rainfall zone" },
];

const imdBand = (mm: number) =>
  IMD_BANDS.find((b) => mm >= b.minMm) ?? IMD_BANDS[IMD_BANDS.length - 1];

const windProvenance = (s: Scenario, t: string): Provenance => ({
  source: `${s.bulletin.source} — gale wind radius for the selected step`,
  url: s.bulletin.url,
  status: s.kind === "synthetic" ? "synthetic" : "derived",
  retrievedAt: s.bulletin.retrievedAt,
  observedAt: t,
  note:
    "Concentric wind swaths are drawn from the forecast wind-radius guidance. They describe the wind field around the cyclone centre — not the damage that will actually occur.",
});

const surgeProvenance = (s: Scenario, t: string): Provenance => ({
  source: "Prepared coastal-inundation corridor (simulated) built from IMD surge guidance",
  url: s.bulletin.url,
  status: "simulated",
  retrievedAt: s.bulletin.retrievedAt,
  observedAt: t,
  note: s.surgeBasis,
});

const rainProvenance = (s: Scenario, t: string): Provenance => ({
  source: "Simulated gridded rainfall field from the scenario 24-hour peak",
  url: s.bulletin.url,
  status: "simulated",
  retrievedAt: s.bulletin.retrievedAt,
  observedAt: t,
  note: `${s.rainBasis} Cells are classified with IMD warning thresholds (64.5 / 115.6 / 204.5 mm per 24 h).`,
});

/** Step 1 — hazard footprints for the selected forecast time. */
export function buildHazards(
  district: District,
  scenario: Scenario,
  stepIndex: number,
): {
  hazards: HazardZone[];
  storm: AnalysisRun["storm"];
  surgeReachKm: number;
  surgeProximity: number;
} {
  const track = scenario.track;
  const i = clamp(stepIndex, 0, track.length - 1);
  const tp = track[i];
  const storm: Point = [tp.lon, tp.lat];
  const hazards: HazardZone[] = [];

  // ── wind field ───────────────────────────────────────────────────────────
  const R = tp.galeRadiusKm;
  const windLayers: { r: number; severity: Severity; label: string; detail: string }[] = [
    {
      r: R * 1.6,
      severity: "low",
      label: "Outer gust field",
      detail: `≈ ${Math.round(R * 1.6)} km from centre, weakening winds`,
    },
    {
      r: R * 0.8,
      severity: "moderate",
      label: "Gale-force wind swath",
      detail: `within ${Math.round(R * 0.8)} km of centre, ≥34 kt winds likely`,
    },
    {
      r: R * 0.45,
      severity: "high",
      label: "Destructive wind band",
      detail: `within ${Math.round(R * 0.45)} km of centre, storm-force gusts`,
    },
    {
      r: R * 0.15,
      severity: "severe",
      label: "Core of damaging winds",
      detail: `within ${Math.round(R * 0.15)} km of centre, eyewall-adjacent winds`,
    },
  ];
  windLayers.forEach((w, idx) => {
    if (w.r < 5) return;
    hazards.push({
      id: `wind-${idx}`,
      kind: "wind",
      severity: w.severity,
      label: w.label,
      detail: `${w.detail} · ${tp.windKt} kt / ${tp.pressureHpa} hPa at this step`,
      ring: circleRing(storm, w.r),
      provenance: windProvenance(scenario, tp.time),
    });
  });

  // ── coastal inundation ───────────────────────────────────────────────────
  const distToCoast = distToLineMin(storm, district.coast);
  const proximity = Math.pow(clamp(1 - distToCoast / 150, 0, 1), 1.5);
  const reach = scenario.maxInundationReachKm * proximity;
  if (reach >= 0.35) {
    const inner = offsetCoastRing(district.coast, reach * 0.4, district.inlandRef);
    const outer = offsetCoastRing(district.coast, reach, district.inlandRef);
    hazards.push({
      id: "surge-outer",
      kind: "surge",
      severity: reach >= 2 ? "high" : "moderate",
      label: "Coastal inundation corridor",
      detail: `reaches ≈ ${reach.toFixed(1)} km inland from this step's position (${Math.round(
        distToCoast,
      )} km offshore)`,
      ring: outer,
      provenance: surgeProvenance(scenario, tp.time),
    });
    hazards.push({
      id: "surge-inner",
      kind: "surge",
      severity: reach >= 2 ? "severe" : "high",
      label: "Inner surge penetration",
      detail: `deepest ≈ ${(reach * 0.4).toFixed(1)} km inland`,
      ring: inner,
      provenance: surgeProvenance(scenario, tp.time),
    });
  }

  // ── rainfall warning cells ───────────────────────────────────────────────
  const rainProv = rainProvenance(scenario, tp.time);
  const stepDeg = 0.09; // ~10 km warning grid — coarse enough to stay readable on the map
  const [[minLon, minLat], [maxLon, maxLat]] = district.bbox;
  for (let lon = minLon; lon < maxLon; lon += stepDeg) {
    for (let lat = minLat; lat < maxLat; lat += stepDeg) {
      const center: Point = [lon + stepDeg / 2, lat + stepDeg / 2];
      const mm = scenario.peakRainMm24h * Math.exp(-kmBetween(storm, center) / 145);
      const band = imdBand(mm);
      if (mm < 64.5) continue;
      hazards.push({
        id: `rain-${lon.toFixed(3)}-${lat.toFixed(3)}`,
        kind: "rainfall",
        severity: band.severity,
        label: band.label,
        detail: `${Math.round(mm)} mm / 24 h (simulated)`,
        ring: [
          [lon, lat],
          [lon + stepDeg, lat],
          [lon + stepDeg, lat + stepDeg],
          [lon, lat + stepDeg],
          [lon, lat],
        ],
        provenance: rainProv,
      });
    }
  }

  return {
    hazards,
    storm: {
      point: storm,
      time: tp.time,
      windKt: tp.windKt,
      galeRadiusKm: tp.galeRadiusKm,
      pressureHpa: tp.pressureHpa,
    },
    surgeReachKm: reach,
    surgeProximity: proximity,
  };
}

const assetSamples = (asset: Asset): Point[] =>
  asset.line && asset.line.length > 1 ? sampleLine(asset.line, 0.6) : [asset.location];

/** Step 2 — which assets sit inside which hazard footprint. */
export function computeHits(asset: Asset, hazards: HazardZone[]): {
  hits: AssetHit[];
  exposedFraction: number;
} {
  const samples = assetSamples(asset);
  const hits: AssetHit[] = [];
  let worstFraction = 0;

  const kinds: HazardKind[] = ["wind", "surge", "rainfall"];
  for (const kind of kinds) {
    const zones = hazards
      .filter((h) => h.kind === kind)
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    if (!zones.length) continue;

    if (kind === "rainfall") {
      const matchedCells = zones.filter((z) => samples.some((p) => ringContains(z.ring, p)));
      if (!matchedCells.length) continue;
      const worst = matchedCells[0]; // already severity-sorted
      hits.push({
        zoneId: worst.id,
        kind,
        severity: worst.severity,
        label: worst.label,
        detail: matchedCells.length > 1
          ? `${matchedCells.length} warning cells under the asset (worst: ${worst.detail})`
          : worst.detail,
        matched: matchedCells.filter((z) => samples.some((p) => ringContains(z.ring, p))).length,
        sampled: samples.length,
      });
      worstFraction = Math.max(worstFraction, matchedCells.length / zones.length);
      continue;
    }

    const zone = zones.find((z) => samples.some((p) => ringContains(z.ring, p)));
    if (!zone) continue;
    const matched = samples.filter((p) => ringContains(zone.ring, p)).length;
    hits.push({
      zoneId: zone.id,
      kind,
      severity: zone.severity,
      label: zone.label,
      detail: zone.detail,
      matched,
      sampled: samples.length,
    });
    worstFraction = Math.max(worstFraction, matched / samples.length);
  }

  hits.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return { hits, exposedFraction: worstFraction };
}

const V_SCORE: Record<Exclude<Vulnerability, "unknown">, number> = {
  high: 0.9,
  moderate: 0.6,
  low: 0.3,
};

const W_H = 0.45;
const W_V = 0.3;
const W_I = 0.25;

const bandFor = (score: number): Band =>
  score >= 85 ? "P1" : score >= 65 ? "P2" : score >= 45 ? "P3" : "P4";

/** Step 3 — transparent priority scoring for one asset. */
export function scoreAsset(
  asset: Asset,
  hits: AssetHit[],
  exposedFraction: number,
  scenario: Scenario,
  surgeReachKm: number,
): AssetRow {
  const severity = hits.length
    ? hits.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a))
        .severity
    : ("low" as Severity);

  // hazard component: worst factor + a small, stated bonus for multiple hazards
  const kindsHit = new Set(hits.map((h) => h.kind));
  const hazardScore = hits.length
    ? Math.min(1, SEVERITY_WEIGHT[severity] + 0.05 * (kindsHit.size - 1))
    : 0;

  const vulnerability: Vulnerability = asset.structure.value;
  const vulnerabilityScore = vulnerability === "unknown" ? null : V_SCORE[vulnerability];
  const importanceScore = (asset.importance - 1) / 4;

  const usedWeight =
    W_H + (vulnerabilityScore !== null ? W_V : 0) + W_I;
  const score = Math.round(
    100 *
      ((W_H * hazardScore +
        (vulnerabilityScore !== null ? W_V * vulnerabilityScore : 0) +
        W_I * importanceScore) /
        usedWeight),
  );

  const band = bandFor(score);
  const unknownAttrs = Object.entries(asset.attributes)
    .filter(([, v]) => v === null || v === "Unknown")
    .map(([k]) => k);

  const dataGaps: string[] = [];
  if (vulnerability === "unknown")
    dataGaps.push("Structural vulnerability UNKNOWN — no survey in the dataset.");
  if (asset.elevationM === null) dataGaps.push("Ground elevation UNKNOWN.");
  unknownAttrs.slice(0, 5).forEach((k) => dataGaps.push(`Attribute unknown: ${k}.`));
  if (unknownAttrs.length > 5)
    dataGaps.push(`+${unknownAttrs.length - 5} further unknown attributes.`);

  const confidence: AssetRow["confidence"] =
    hits.length && vulnerabilityScore !== null && asset.elevationM !== null
      ? "medium"
      : hits.length
        ? "low"
        : "high";

  const reasons: string[] = [];
  const evidence: Evidence[] = [];

  if (hits.length) {
    const primary = hits[0];
    reasons.push(
      asset.line
        ? `${Math.round(exposedFraction * 100)}% of the alignment falls inside ${primary.label.toLowerCase()} (${primary.detail}).`
        : `Asset sits inside ${primary.label.toLowerCase()} — ${primary.detail}.`,
    );
    hits.forEach((h) =>
      evidence.push({
        text: `${h.label} — ${h.detail}`,
        source: scenario.bulletin.source,
        status: scenario.kind === "synthetic" ? "synthetic" : scenario.bulletin.status,
        observedAt: scenario.bulletin.observedAt,
      }),
    );
  } else {
    reasons.push("Outside every mapped hazard footprint at this forecast step.");
  }

  if (vulnerability === "unknown") {
    reasons.push(
      "Structural vulnerability is UNKNOWN, so the score deliberately ignores that factor and redistributes its weight to hazard and importance.",
    );
  } else {
    reasons.push(
      `Structural vulnerability assessed ${vulnerability.toUpperCase()}: ${asset.structure.basis}`,
    );
    evidence.push({
      text: `Structure ${vulnerability} — ${asset.structure.basis}`,
      source: asset.provenance.source,
      status: asset.provenance.status,
      observedAt: asset.structure.inspectedAt,
    });
  }

  reasons.push(
    `Service importance ${asset.importance}/5 — ${asset.importanceRationale}`,
  );

  if (asset.elevationM !== null && surgeReachKm > 0 && hits.some((h) => h.kind === "surge")) {
    const note =
      asset.elevationM <= scenario.peakSurgeM * 1.6
        ? `Ground level ${asset.elevationM} m is within the modelled surge-crest envelope (${scenario.peakSurgeM} m above astronomical tide).`
        : `Ground level ${asset.elevationM} m sits above the modelled surge crest (${scenario.peakSurgeM} m) — inundation is driven by run-up and drainage backwater, not crest height alone.`;
    reasons.push(note);
    evidence.push({
      text: `Terrain: ${asset.elevationM} m AMSL (SRTM 30 m sample)`,
      source: "SRTM 30 m elevation extract via Google Earth Engine",
      status: "sample",
    });
  }

  if (asset.attributes["Historic waterlogging"]) {
    reasons.push(
      `Local history note: historic waterlogging recorded as "${String(
        asset.attributes["Historic waterlogging"],
      )}" (unverified demo attribute).`,
    );
  }

  return {
    asset,
    hits,
    severity,
    hazardScore,
    vulnerabilityScore,
    vulnerability,
    importanceScore,
    score,
    band,
    confidence,
    reasons,
    evidence,
    dataGaps,
    exposedFraction,
  };
}

/** Full pipeline for one district + scenario + forecast step. */
export function runAnalysis(
  district: District,
  scenario: Scenario,
  assets: Asset[],
  stepIndex: number,
): AnalysisRun {
  const { hazards, storm, surgeReachKm, surgeProximity } = buildHazards(
    district,
    scenario,
    stepIndex,
  );

  const rows: AssetRow[] = [];
  const unexposed: Asset[] = [];

  for (const asset of assets) {
    const { hits, exposedFraction } = computeHits(asset, hazards);
    if (!hits.length) {
      unexposed.push(asset);
      continue;
    }
    rows.push(scoreAsset(asset, hits, exposedFraction, scenario, surgeReachKm));
  }

  rows.sort((a, b) => b.score - a.score || a.asset.name.localeCompare(b.asset.name));

  const bandCounts: Record<Band, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  rows.forEach((r) => (bandCounts[r.band] += 1));

  const warnings = Math.round(surgeProximity * 100);

  const notes = [
    `Storm centre at ${storm.time}: ${storm.windKt} kt / ${storm.pressureHpa} hPa, gale radius ${storm.galeRadiusKm} km.`,
    surgeReachKm >= 0.35
      ? `Inundation corridor reaches ${surgeReachKm.toFixed(
          1,
        )} km inland (coast-to-storm distance ${Math.round(
          distToLineMin(storm.point, district.coast),
        )} km → ${warnings}% of full surge strength).`
      : "No coastal inundation footprint at this step — the storm is outside the surge-influence envelope.",
    `${hazards.filter((h) => h.kind === "rainfall").length} rainfall warning cells at IMD thresholds.`,
    "Exposure here means geometric intersection with a mapped footprint. It is not a forecast of damage.",
  ];

  return {
    district,
    scenario,
    stepIndex,
    storm,
    hazards,
    surgeReachKm,
    surgeProximity,
    rows,
    unexposed,
    bandCounts,
    notes,
    method: {
      hazard:
        "Wind swaths from forecast wind radii; inundation corridor from the coastline offset inland by a surge-derived reach; rainfall cells from the scenario 24-h peak decaying with distance to the storm centre.",
      scoring: [
        "Hazard severity (severe 0.90 / high 0.70 / moderate 0.45 / low 0.25, +0.05 per additional hazard type, capped at 1.00) — weight 0.45",
        "Structural vulnerability (high 0.90 / moderate 0.60 / low 0.30 / unknown → excluded, weights renormalised) — weight 0.30",
        "Service importance 1–5 scaled to 0–1 — weight 0.25",
        "Bands: P1 ≥ 85, P2 65–84, P3 45–64, P4 < 45",
      ],
    },
    generatedAt: new Date().toISOString(),
  };
}
