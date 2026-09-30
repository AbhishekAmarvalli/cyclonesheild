import type { District, Provenance } from "../types";

/**
 * Simplified district outlines + coastline polylines for the two prepared
 * coastal districts. Geometry is hand-generalised at roughly 1–3 km accuracy —
 * enough for district-scale exposure screening, not for parcel decisions.
 */

const INGEST = "2026-09-28T09:00:00Z";

const terrainProvenance = (note: string): Provenance => ({
  source: "SRTM 30 m elevation extract, surfaced through Google Earth Engine",
  url: "https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003",
  status: "sample",
  retrievedAt: INGEST,
  note,
});

export const DISTRICTS: District[] = [
  {
    id: "puri",
    name: "Puri (study area)",
    state: "Odisha",
    country: "India",
    center: [85.82, 19.82],
    bbox: [
      [85.12, 19.42],
      [86.42, 20.2],
    ],
    boundary: [
      [85.14, 19.52],
      [85.36, 19.47],
      [85.62, 19.45],
      [85.91, 19.48],
      [86.2, 19.58],
      [86.36, 19.78],
      [86.31, 20.02],
      [86.08, 20.16],
      [85.78, 20.18],
      [85.51, 20.13],
      [85.27, 20.02],
      [85.14, 19.8],
      [85.14, 19.52],
    ],
    coast: [
      [85.12, 19.91],
      [85.32, 19.89],
      [85.55, 19.87],
      [85.78, 19.84],
      [86.01, 19.82],
      [86.22, 19.8],
      [86.42, 19.78],
    ],
    inlandRef: [85.76, 20.13],
    terrain: {
      minM: 0,
      maxM: 67,
      meanM: 16,
      lowlandSharePct: 45,
      provenance: terrainProvenance(
        "Illustrative study-area terrain values. Boundary and coastline are hand-generalised for the Fani replay and are not administrative or parcel-grade data.",
      ),
    },
    notes:
      "Approximate Puri coastal study area for a historical replay. The outline and sample infrastructure are illustrative, not an official district GIS layer.",
  },
  {
    id: "visakhapatnam",
    name: "Visakhapatnam",
    state: "Andhra Pradesh",
    country: "India",
    center: [83.25, 17.72],
    bbox: [
      [82.66, 17.4],
      [83.58, 18.08],
    ],
    boundary: [
      [83.5, 17.98],
      [83.46, 17.93],
      [83.41, 17.87],
      [83.37, 17.82],
      [83.33, 17.77],
      [83.3, 17.73],
      [83.26, 17.69],
      [83.22, 17.64],
      [83.18, 17.58],
      [83.14, 17.52],
      [83.1, 17.46],
      [83.02, 17.41],
      [82.88, 17.44],
      [82.74, 17.54],
      [82.67, 17.68],
      [82.71, 17.84],
      [82.83, 17.97],
      [82.98, 18.05],
      [83.18, 18.07],
      [83.38, 18.03],
      [83.5, 17.98],
    ],
    coast: [
      [83.5, 17.98],
      [83.46, 17.93],
      [83.41, 17.87],
      [83.37, 17.82],
      [83.34, 17.79],
      [83.31, 17.75],
      [83.3, 17.73],
      [83.28, 17.71],
      [83.26, 17.69],
      [83.24, 17.67],
      [83.22, 17.64],
      [83.2, 17.61],
      [83.18, 17.58],
      [83.16, 17.55],
      [83.14, 17.52],
      [83.12, 17.49],
      [83.1, 17.46],
    ],
    inlandRef: [83.0, 17.72],
    terrain: {
      minM: 0,
      maxM: 1048,
      meanM: 132,
      lowlandSharePct: 34,
      provenance: terrainProvenance(
        "District-wide min/mean/max sampled from the SRTM mosaic. Hills of the Eastern Ghats drive the maximum; the coastal plain below 10 m covers roughly a third of the district.",
      ),
    },
    notes:
      "District boundary is a simplified outline for demonstration. Coastal plain is narrow north of the port and widens south toward Gangavaram.",
  },
  {
    id: "srikakulam",
    name: "Srikakulam",
    state: "Andhra Pradesh",
    country: "India",
    center: [84.1, 18.6],
    bbox: [
      [83.78, 18.15],
      [84.58, 19.08],
    ],
    boundary: [
      [84.02, 18.18],
      [84.08, 18.28],
      [84.15, 18.37],
      [84.22, 18.46],
      [84.3, 18.56],
      [84.37, 18.66],
      [84.44, 18.75],
      [84.5, 18.84],
      [84.55, 18.92],
      [84.45, 19.0],
      [84.3, 19.05],
      [84.1, 19.03],
      [83.95, 18.95],
      [83.85, 18.85],
      [83.8, 18.7],
      [83.82, 18.55],
      [83.88, 18.4],
      [83.95, 18.27],
      [84.02, 18.18],
    ],
    coast: [
      [84.02, 18.18],
      [84.06, 18.26],
      [84.1, 18.32],
      [84.15, 18.37],
      [84.18, 18.42],
      [84.22, 18.46],
      [84.26, 18.51],
      [84.3, 18.56],
      [84.34, 18.61],
      [84.37, 18.66],
      [84.41, 18.71],
      [84.44, 18.75],
      [84.47, 18.8],
      [84.5, 18.84],
      [84.53, 18.88],
      [84.55, 18.92],
    ],
    inlandRef: [83.95, 18.6],
    terrain: {
      minM: 0,
      maxM: 712,
      meanM: 78,
      lowlandSharePct: 46,
      provenance: terrainProvenance(
        "District-wide min/mean/max sampled from the SRTM mosaic. Broad low-lying alluvial plain along the Nagavali/Vamsadhara systems, so a larger share of the district sits under 10 m.",
      ),
    },
    notes:
      "Simplified outline. The Srikakulam–Palasa coastal strip is low, sandy and densely populated — the classic surge-corridor shape for this coast.",
  },
];

export const getDistrict = (id: string): District =>
  DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0];
