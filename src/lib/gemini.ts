import { GoogleGenAI } from "@google/genai";
import type { AnalysisRun, AssetRow } from "./analysis";
import { fmtIST, fmtUTC } from "./format";

/**
 * Gemini advisory drafting.
 *
 * The model only ever sees facts that our engine computed (plus their
 * provenance). It is explicitly instructed not to invent rainfall amounts,
 * flood depths, wind speeds or damage percentages, and to repeat "unknown"
 * where the source data is unknown.
 */

export interface EvidencePacket {
  generatedAt: string;
  district: string;
  scenario: {
    name: string;
    code: string;
    kind: string;
    classification: string;
    landfall: string;
    bulletinSource: string;
    bulletinStatus: string;
    bulletinObservedAt: string | null;
    guidance: string;
  };
  forecastStep: {
    index: number;
    validTimeUTC: string;
    validTimeIST: string;
    stormCentreLat: number;
    stormCentreLon: number;
    sustainedWindKt: number;
    centralPressureHpa: number;
    galeRadiusKm: number;
  };
  hazardLayers: {
    type: string;
    severity: string;
    description: string;
    dataSource: string;
    dataStatus: string;
    observedAt: string | null;
  }[];
  exposedAssets: {
    rank: number;
    id: string;
    name: string;
    type: string;
    priority: string;
    priorityLabel: string;
    score: number;
    worstHazard: string;
    why: string[];
    knownVulnerability: string;
    serviceImportance: string;
    unknowns: string[];
  }[];
  summary: {
    assetsAnalysed: number;
    exposed: number;
    notExposed: number;
    p1: number;
    p2: number;
    p3: number;
    p4: number;
    surgeReachKm: number;
  };
  method: { hazard: string; scoring: string[] };
}

export interface AdvisoryDraft {
  headline: string;
  situation: string;
  impacts: string[];
  actions: string[];
  dataGaps: string[];
  citations: string[];
  body: string;
  mode: "gemini" | "offline";
  model: string;
  generatedAt: string;
  raw?: string;
}

const shortType = (kind: string): string =>
  ({
    hospital: "Hospital",
    shelter: "Shelter",
    power: "Power",
    road: "Road",
    port: "Port",
    airport: "Airport",
  })[kind] ?? kind;

export function buildEvidencePacket(run: AnalysisRun): EvidencePacket {
  const s = run.scenario;
  const t = run.storm;
  return {
    generatedAt: run.generatedAt,
    district: `${run.district.name} district, ${run.district.state}`,
    scenario: {
      name: s.name,
      code: s.code,
      kind: s.kind === "recorded" ? "recorded historical storm" : "synthetic test scenario",
      classification: s.classification,
      landfall: `${fmtIST(s.landfall.time)} at ${s.landfall.place} (${s.landfall.lat}N, ${s.landfall.lon}E)`,
      bulletinSource: s.bulletin.source,
      bulletinStatus: s.bulletin.status,
      bulletinObservedAt: s.bulletin.observedAt ?? null,
      guidance: s.bulletinSummary,
    },
    forecastStep: {
      index: run.stepIndex,
      validTimeUTC: fmtUTC(t.time),
      validTimeIST: fmtIST(t.time),
      stormCentreLat: Number(t.point[1].toFixed(2)),
      stormCentreLon: Number(t.point[0].toFixed(2)),
      sustainedWindKt: t.windKt,
      centralPressureHpa: t.pressureHpa,
      galeRadiusKm: t.galeRadiusKm,
    },
    hazardLayers: run.hazards.slice(0, 8).map((h) => ({
      type: h.kind,
      severity: h.severity,
      description: `${h.label} — ${h.detail}`,
      dataSource: h.provenance.source,
      dataStatus: h.provenance.status,
      observedAt: h.provenance.observedAt ?? null,
    })),
    exposedAssets: run.rows.slice(0, 12).map((r, i) => ({
      rank: i + 1,
      id: r.asset.id,
      name: r.asset.name,
      type: shortType(r.asset.kind),
      priority: r.band,
      priorityLabel: BAND_TEXT[r.band],
      score: r.score,
      worstHazard: r.hits[0] ? `${r.hits[0].label} (${r.hits[0].severity})` : "none",
      why: r.reasons,
      knownVulnerability:
        r.vulnerability === "unknown"
          ? "unknown — no structural survey available"
          : `${r.vulnerability} — ${r.asset.structure.basis}`,
      serviceImportance: `${r.asset.importance}/5 — ${r.asset.importanceRationale}`,
      unknowns: r.dataGaps,
    })),
    summary: {
      assetsAnalysed: run.rows.length + run.unexposed.length,
      exposed: run.rows.length,
      notExposed: run.unexposed.length,
      p1: run.bandCounts.P1,
      p2: run.bandCounts.P2,
      p3: run.bandCounts.P3,
      p4: run.bandCounts.P4,
      surgeReachKm: Number(run.surgeReachKm.toFixed(2)),
    },
    method: run.method,
  };
}

const BAND_TEXT: Record<string, string> = {
  P1: "Immediate action",
  P2: "Prepare today",
  P3: "Monitor & verify",
  P4: "Awareness",
};

const SYSTEM_RULES = `You are the drafting assistant inside a cyclone early-warning console used by a district disaster-management officer.

STRICT RULES
1. Use ONLY the facts in the JSON evidence packet. Do not invent rainfall amounts, flood depths, wind speeds, storm-surge heights, damage percentages, casualty numbers, population figures or travel times.
2. If the packet says an attribute is unknown, write "unknown" — never estimate it.
3. Overlaying assets on mapped footprints is an exposure screening. Do NOT describe it as a validated storm-surge forecast or a damage prediction.
4. Attribute every material claim to a fact from the packet (asset name, hazard layer, or scenario field).
5. Keep language plain and imperative: an officer must be able to act on it in under 60 seconds.
6. Never say "all clear" for assets that are exposed; never soften a P1 item.

Return STRICT JSON only, matching:
{
  "headline": string,          // <= 140 chars, states district + storm + main threat
  "situation": string,         // 3-5 sentences: storm state, valid time, what the screening found
  "impacts": string[],         // 3-6 bullets, each naming a specific exposed asset and why
  "actions": string[],         // 4-7 bullets, ordered by priority, each naming an owner/action
  "dataGaps": string[],        // 2-4 bullets, the unknowns that most affect confidence
  "citations": string[]        // 3-5 short source labels used, e.g. "IMD RSMC archive (recorded), observed 2014-10-12T05:00:00Z"
}`;

const buildPrompt = (packet: EvidencePacket, officerNote: string): string =>
  `${officerNote.trim() ? `OFFICER INSTRUCTION: ${officerNote.trim()}\n\n` : ""}EVIDENCE PACKET (JSON):\n${JSON.stringify(
    packet,
    null,
    2,
  )}`;

interface JsonDraft {
  headline?: string;
  situation?: string;
  impacts?: string[];
  actions?: string[];
  dataGaps?: string[];
  citations?: string[];
}

const extractJson = (text: string): JsonDraft | null => {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? (parsed as JsonDraft) : null;
  } catch {
    return null;
  }
};

const bodyFrom = (d: {
  headline: string;
  situation: string;
  impacts: string[];
  actions: string[];
  dataGaps: string[];
  citations: string[];
}): string =>
  [
    `# ${d.headline}`,
    "",
    d.situation,
    "",
    "## Expected impacts (from the exposure screening)",
    ...d.impacts.map((i) => `- ${i}`),
    "",
    "## Recommended actions",
    ...d.actions.map((a, i) => `${i + 1}. ${a}`),
    "",
    "## Data gaps / confidence limits",
    ...d.dataGaps.map((g) => `- ${g}`),
    "",
    "## Evidence sources",
    ...d.citations.map((c) => `- ${c}`),
  ].join("\n");

/** Deterministic evidence-bound drafter used when no API key is configured. */
export function offlineDraft(packet: EvidencePacket): AdvisoryDraft {
  const top = packet.exposedAssets;
  const immediate = top.filter((a) => a.priority === "P1" || a.priority === "P2");
  const first = top[0];
  const generateAt = new Date().toISOString();

  const headline = first
    ? `${packet.district}: ${top.filter((a) => a.priority === "P1").length} asset(s) at immediate priority as ${packet.scenario.name} centres ${packet.forecastStep.stormCentreLat}N ${packet.forecastStep.stormCentreLon}E`
    : `${packet.district}: no mapped exposure at this forecast step`;

  const situation = [
    `${packet.scenario.name} (${packet.scenario.code}, ${packet.scenario.kind}) — ${packet.scenario.classification}. Guidance: ${packet.scenario.guidance}`,
    `Storm centre at ${packet.forecastStep.validTimeIST} (${packet.forecastStep.validTimeUTC}): ${packet.forecastStep.sustainedWindKt} kt sustained, ${packet.forecastStep.centralPressureHpa} hPa, gale-force radius ${packet.forecastStep.galeRadiusKm} km.`,
    `Exposure screening over ${packet.district}: ${packet.summary.exposed} of ${packet.summary.assetsAnalysed} mapped assets intersect at least one hazard footprint (P1 ${packet.summary.p1}, P2 ${packet.summary.p2}, P3 ${packet.summary.p3}, P4 ${packet.summary.p4}); ${packet.summary.notExposed} sit outside all mapped footprints at this step.`,
    `Modelled coastal inundation reaches ${packet.summary.surgeReachKm} km inland at this step. This is a prepared corridor derived from surge guidance, not a validated surge model.`,
  ].join(" ");

  const impacts = (first ? top.slice(0, 6) : []).map((a) => {
    const gap = a.knownVulnerability.startsWith("unknown")
      ? "Structural vulnerability unknown — confidence reduced."
      : `Structure assessed ${a.knownVulnerability}.`;
    return `${a.rank}. ${a.name} (${a.type}) — ${a.priority} ${a.priorityLabel}, score ${a.score}/100. ${a.worstHazard}. ${gap}`;
  });
  if (!impacts.length)
    impacts.push(
      "No mapped asset intersects a hazard footprint at this forecast step; keep monitoring the next step.",
    );

  const actions = [
    immediate.length
      ? `District Disaster Management Authority: issue P1/P2 stand-down-and-prepare instructions for ${immediate
          .slice(0, 3)
          .map((a) => a.name)
          .join(", ")}.`
      : "District Disaster Management Authority: keep the next forecast step under review; no asset currently at immediate priority.",
    "Executive Magistrate / Section 144 desk: confirm evacuation readiness for coastal hamlets inside the inundation corridor.",
    "Energy desk: ask the distribution company to confirm bund height and DG fuel at the substations flagged P1/P2 — those attributes are unknown in this dataset.",
    "Health desk: verify bed availability and structural status of hospitals whose survey status is unknown.",
    "Transport desk: pre-position a detour plan for arterial segments inside the wind swath before gale onset.",
    "IMD liaison: re-check the bulletin at each advisory cycle and re-run this screening — the footprint moves with the storm centre.",
  ];

  const dataGaps = [
    ...packet.exposedAssets
      .flatMap((a) => a.unknowns.slice(0, 1))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3),
    "Hazard footprints are prepared/simulated inputs for this prototype; they are not output from an operational surge or wind-damage model.",
  ];

  const citations = [
    `${packet.scenario.bulletinSource} (${packet.scenario.bulletinStatus}), observed ${packet.scenario.bulletinObservedAt ?? "n/a"}`,
    ...packet.hazardLayers.slice(0, 2).map((h) => `${h.dataSource} (${h.dataStatus})`),
    "Hand-compiled sample asset register (sample)",
    "SRTM 30 m elevation extract via Google Earth Engine (sample)",
  ];

  const d = { headline, situation, impacts, actions, dataGaps, citations };
  return {
    ...d,
    body: bodyFrom(d),
    mode: "offline",
    model: "offline deterministic drafter (no API key configured)",
    generatedAt: generateAt,
  };
}

export async function draftAdvisory(
  packet: EvidencePacket,
  opts: { apiKey: string; model: string; officerNote: string },
): Promise<AdvisoryDraft> {
  if (!opts.apiKey.trim()) return offlineDraft(packet);

  const ai = new GoogleGenAI({ apiKey: opts.apiKey.trim() });
  const request = ai.models.generateContent({
    model: opts.model,
    contents: buildPrompt(packet, opts.officerNote),
    config: {
      systemInstruction: SYSTEM_RULES,
      temperature: 0.25,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  // never let a hung request block the officer's console
  const guard = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("request timed out after 20 s")), 20_000),
  );
  const response = await Promise.race([request, guard]);

  const text = response.text ?? "";
  const parsed = extractJson(text);

  if (!parsed) {
    const d = offlineDraft(packet);
    return { ...d, body: text || d.body, raw: text };
  }

  const d = {
    headline: parsed.headline?.trim() || offlineDraft(packet).headline,
    situation: parsed.situation?.trim() || "",
    impacts: (parsed.impacts ?? []).filter(Boolean),
    actions: (parsed.actions ?? []).filter(Boolean),
    dataGaps: (parsed.dataGaps ?? []).filter(Boolean),
    citations: (parsed.citations ?? []).filter(Boolean),
  };

  return {
    ...d,
    body: bodyFrom(d),
    mode: "gemini",
    model: opts.model,
    generatedAt: new Date().toISOString(),
    raw: text,
  };
}

export { shortType };

/** Unused-import guard for the analysis types used in JSDoc-only positions. */
export type { AssetRow };
