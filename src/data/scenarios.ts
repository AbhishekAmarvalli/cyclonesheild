import type { Provenance, Scenario } from "../types";

/**
 * Prepared cyclone scenarios.
 *
 * Tracks are *approximate reconstructions* of archived IMD/RSMC guidance
 * (positions rounded, times normalised to UTC) — enough to drive a
 * district-scale demonstration, not a substitute for the official best-track
 * archive. The synthetic scenario is clearly flagged and exists so the demo
 * can show the dashboard recomputing from a different set of inputs.
 */

const INGEST = "2026-09-28T09:00:00Z";

const recorded = (
  source: string,
  url: string,
  observedAt: string,
  note: string,
): Provenance => ({
  source,
  url,
  status: "recorded",
  retrievedAt: INGEST,
  observedAt,
  note,
});

export const SCENARIOS: Scenario[] = [
  {
    id: "fani-2019",
    districtId: "puri",
    name: "Cyclone Fani",
    code: "IMD-BOB-02/2019",
    year: 2019,
    kind: "recorded",
    classification: "Extremely severe cyclonic storm",
    summary:
      "Fani crossed the Odisha coast near Satapada and Puri on 3 May 2019. This replay uses rounded, source-derived track points to screen illustrative local infrastructure.",
    bulletin: recorded(
      "India Meteorological Department — Preliminary Report on ESCS FANI",
      "https://rsmcnewdelhi.imd.gov.in/uploads/report/26/26_7122ae_Preliminary%20Report%20on%20ESCS%20FANI_15082020.pdf",
      "2019-05-03T03:00:00Z",
      "Historical track and intensity are rounded for this retrospective replay; this is not a reforecast or a validated impact model.",
    ),
    bulletinSummary:
      "Paraphrased post-event assessment: landfall near Satapada and Puri around 08:30 IST on 3 May 2019, with sustained surface winds of 175–180 km/h and gusts up to 205 km/h. Puri was the worst-hit district.",
    landfall: {
      time: "2019-05-03T03:00:00Z",
      lat: 19.82,
      lon: 85.82,
      place: "between Satapada and Puri, Odisha",
    },
    peakSurgeM: 1.8,
    surgeBasis:
      "Illustrative replay forcing only. The prototype has no verified post-event surge measurement for comparison.",
    maxInundationReachKm: 4.8,
    peakRainMm24h: 195,
    rainBasis:
      "Illustrative simulated rainfall forcing. The post-event source describes copious rain but this prototype has no matched gauge observation.",
    track: [
      { time: "2019-04-29T00:00:00Z", lat: 13.2, lon: 88.0, windKt: 35, pressureHpa: 990, galeRadiusKm: 75 },
      { time: "2019-04-30T12:00:00Z", lat: 14.5, lon: 86.9, windKt: 50, pressureHpa: 978, galeRadiusKm: 95 },
      { time: "2019-05-01T12:00:00Z", lat: 16.1, lon: 86.0, windKt: 70, pressureHpa: 962, galeRadiusKm: 125 },
      { time: "2019-05-02T12:00:00Z", lat: 18.1, lon: 85.7, windKt: 90, pressureHpa: 944, galeRadiusKm: 155 },
      {
        time: "2019-05-03T03:00:00Z",
        lat: 19.82,
        lon: 85.82,
        windKt: 95,
        pressureHpa: 930,
        galeRadiusKm: 175,
        label: "Landfall",
      },
      { time: "2019-05-03T12:00:00Z", lat: 20.7, lon: 85.2, windKt: 75, pressureHpa: 952, galeRadiusKm: 140 },
      { time: "2019-05-04T00:00:00Z", lat: 22.0, lon: 84.4, windKt: 40, pressureHpa: 986, galeRadiusKm: 90 },
    ],
  },
  {
    id: "hudhud-2014",
    districtId: "visakhapatnam",
    name: "Cyclone Hudhud",
    code: "IMD-BOB-04/2014",
    year: 2014,
    kind: "recorded",
    classification: "Very severe cyclonic storm (≈ Category 4 equivalent)",
    summary:
      "Crossed the coast near Visakhapatnam on 12 October 2014 with estimated winds of 95 kt and a central pressure near 947 hPa.",
    bulletin: recorded(
      "IMD RSMC New Delhi — Cyclone Warning Centre archive (Hudhud best-track summary)",
      "https://rsmcnewdelhi.imd.gov.in/",
      "2014-10-12T05:00:00Z",
      "Track points rounded to 0.1° and 6-hourly steps. Landfall time/location approximate.",
    ),
    bulletinSummary:
      "Paraphrased guidance: very severe cyclonic storm moving west-northwestwards, landfall near Visakhapatnam with storm surge of about 2–3 m above astronomical tide in low-lying areas, heavy to very heavy rainfall over coastal Andhra Pradesh and adjoining Odisha, gale winds 130–150 km/h at landfall.",
    landfall: {
      time: "2014-10-12T05:00:00Z",
      lat: 17.65,
      lon: 83.3,
      place: "near Visakhapatnam, Andhra Pradesh",
    },
    peakSurgeM: 2.4,
    surgeBasis:
      "IMD guidance of 2–3 m above astronomical tide in low-lying areas; 2.4 m used as the central estimate.",
    maxInundationReachKm: 4.6,
    peakRainMm24h: 195,
    rainBasis:
      "Heavy-to-very-heavy rainfall warning band for coastal Andhra Pradesh; 195 mm/24 h used as the peak grid-cell value.",
    track: [
      { time: "2014-10-10T00:00:00Z", lat: 12.4, lon: 92.5, windKt: 30, pressureHpa: 996, galeRadiusKm: 55 },
      { time: "2014-10-10T12:00:00Z", lat: 13.2, lon: 90.6, windKt: 45, pressureHpa: 986, galeRadiusKm: 70 },
      { time: "2014-10-11T00:00:00Z", lat: 14.3, lon: 88.6, windKt: 60, pressureHpa: 974, galeRadiusKm: 90 },
      { time: "2014-10-11T12:00:00Z", lat: 15.5, lon: 86.6, windKt: 75, pressureHpa: 962, galeRadiusKm: 115 },
      { time: "2014-10-12T00:00:00Z", lat: 16.7, lon: 84.8, windKt: 90, pressureHpa: 950, galeRadiusKm: 140 },
      {
        time: "2014-10-12T05:00:00Z",
        lat: 17.65,
        lon: 83.3,
        windKt: 95,
        pressureHpa: 947,
        galeRadiusKm: 155,
        label: "Landfall",
      },
      { time: "2014-10-12T12:00:00Z", lat: 18.6, lon: 82.2, windKt: 55, pressureHpa: 975, galeRadiusKm: 110 },
      { time: "2014-10-12T18:00:00Z", lat: 19.6, lon: 81.4, windKt: 35, pressureHpa: 986, galeRadiusKm: 75 },
    ],
  },
  {
    id: "arjuna-synthetic",
    districtId: "visakhapatnam",
    name: "Scenario X — Arjuna (synthetic)",
    code: "SIM-BOB-99/2026",
    year: 2026,
    kind: "synthetic",
    classification: "Extremely severe cyclonic storm (≈ Category 4 equivalent), 60 km offshore track",
    summary:
      "Fictional scenario built for this prototype: a stronger storm hugging the coast before landfall south of Visakhapatnam, producing a wider surge corridor and a longer duration of gale winds.",
    bulletin: {
      source: "Synthetic scenario authored for this prototype",
      status: "synthetic",
      retrievedAt: INGEST,
      note:
        "Not an official forecast. Positions, pressures and wind radii are invented inputs used to test how the dashboard recomputes exposure.",
    },
    bulletinSummary:
      "Simulated guidance: extremely severe cyclonic storm, moving west-northwestwards close to the coast, landfall south of Visakhapatnam, storm surge 3–4 m above astronomical tide, extremely heavy rainfall over coastal districts.",
    landfall: {
      time: "2026-10-18T06:00:00Z",
      lat: 17.45,
      lon: 83.35,
      place: "south of Visakhapatnam (fictional)",
    },
    peakSurgeM: 3.6,
    surgeBasis:
      "Synthetic input: 3.6 m surge crest used to widen the modelled inundation corridor.",
    maxInundationReachKm: 7.2,
    peakRainMm24h: 310,
    rainBasis: "Synthetic input: 310 mm/24 h peak grid value.",
    track: [
      { time: "2026-10-16T00:00:00Z", lat: 13.8, lon: 88.9, windKt: 45, pressureHpa: 984, galeRadiusKm: 70 },
      { time: "2026-10-16T12:00:00Z", lat: 14.6, lon: 87.6, windKt: 65, pressureHpa: 970, galeRadiusKm: 95 },
      { time: "2026-10-17T00:00:00Z", lat: 15.5, lon: 86.3, windKt: 85, pressureHpa: 954, galeRadiusKm: 130 },
      { time: "2026-10-17T12:00:00Z", lat: 16.4, lon: 84.9, windKt: 105, pressureHpa: 941, galeRadiusKm: 170 },
      { time: "2026-10-18T00:00:00Z", lat: 17.05, lon: 84.0, windKt: 115, pressureHpa: 932, galeRadiusKm: 195 },
      {
        time: "2026-10-18T06:00:00Z",
        lat: 17.45,
        lon: 83.35,
        windKt: 110,
        pressureHpa: 936,
        galeRadiusKm: 205,
        label: "Landfall",
      },
      { time: "2026-10-18T12:00:00Z", lat: 17.9, lon: 82.5, windKt: 60, pressureHpa: 968, galeRadiusKm: 120 },
    ],
  },
  {
    id: "titli-2018",
    districtId: "srikakulam",
    name: "Cyclone Titli",
    code: "IMD-BOB-05/2018",
    year: 2018,
    kind: "recorded",
    classification: "Severe cyclonic storm (≈ Category 1 equivalent)",
    summary:
      "Crossed the coast near Palasa, Srikakulam district, late on 10 October 2018 with winds near 80 kt, then tracked west-northwest inland over Odisha.",
    bulletin: recorded(
      "IMD RSMC New Delhi — Cyclone Warning Centre archive (Titli best-track summary)",
      "https://rsmcnewdelhi.imd.gov.in/",
      "2014-10-10T22:30:00Z",
      "Track points rounded to 0.1° and 6-hourly steps; landfall time/location approximate.",
    ),
    bulletinSummary:
      "Paraphrased guidance: severe cyclonic storm crossing near Palasa with storm surge 1–2 m above astronomical tide, extremely heavy rainfall over Srikakulam and Vizianagaram, gale winds 130–140 km/h at landfall, heavy damage to thatched houses and standing crops.",
    landfall: {
      time: "2018-10-10T22:30:00Z",
      lat: 18.75,
      lon: 84.4,
      place: "near Palasa, Srikakulam district",
    },
    peakSurgeM: 1.8,
    surgeBasis:
      "IMD guidance of 1–2 m above astronomical tide; 1.8 m used as the central estimate.",
    maxInundationReachKm: 3.8,
    peakRainMm24h: 240,
    rainBasis:
      "Extremely-heavy rainfall warning band for coastal Andhra Pradesh; 240 mm/24 h used as the peak grid-cell value.",
    track: [
      { time: "2018-10-09T12:00:00Z", lat: 15.6, lon: 87.6, windKt: 40, pressureHpa: 990, galeRadiusKm: 60 },
      { time: "2018-10-10T00:00:00Z", lat: 16.6, lon: 86.4, windKt: 55, pressureHpa: 980, galeRadiusKm: 85 },
      { time: "2018-10-10T12:00:00Z", lat: 17.7, lon: 85.3, windKt: 70, pressureHpa: 974, galeRadiusKm: 115 },
      {
        time: "2018-10-10T22:30:00Z",
        lat: 18.75,
        lon: 84.4,
        windKt: 80,
        pressureHpa: 972,
        galeRadiusKm: 130,
        label: "Landfall",
      },
      { time: "2018-10-11T06:00:00Z", lat: 19.4, lon: 83.5, windKt: 45, pressureHpa: 984, galeRadiusKm: 85 },
      { time: "2018-10-11T18:00:00Z", lat: 19.8, lon: 82.4, windKt: 25, pressureHpa: 994, galeRadiusKm: 55 },
    ],
  },
];

export const scenariosForDistrict = (districtId: string): Scenario[] =>
  SCENARIOS.filter((s) => s.districtId === districtId);

export const getScenario = (id: string): Scenario =>
  SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

/** Minutes offset from UTC for display (IST). */
export const IST_OFFSET_MIN = 330;
