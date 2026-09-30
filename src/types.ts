/**
 * Shared domain types for the CycloneSheild risk and response prototype.
 *
 * Every piece of data carries a `Provenance` record so the UI can always answer
 * "where did this number come from and how fresh is it?".
 */

/** How a record entered the platform. */
export type GeoStatus =
  | "recorded" // real observation / official bulletin archive
  | "derived" // computed by this app from recorded inputs
  | "simulated" // prepared hazard model output for the demo
  | "synthetic" // fictional scenario or fictional asset, invented for the demo
  | "sample"; // small hand-compiled dataset standing in for a full catalogue

export interface Provenance {
  source: string;
  url?: string;
  status: GeoStatus;
  /** When the record was loaded into this platform (ISO). */
  retrievedAt: string;
  /** Valid time of the underlying observation / forecast (ISO). */
  observedAt?: string;
  note?: string;
}

/** [lon, lat] */
export type Point = [number, number];

export interface District {
  id: string;
  name: string;
  state: string;
  country: string;
  center: Point;
  /** [[minLon, minLat], [maxLon, maxLat]] */
  bbox: [Point, Point];
  /** Simplified administrative outline (closed ring of [lon, lat]). */
  boundary: Point[];
  /** Coastline polyline used to build coastal-inundation footprints. */
  coast: Point[];
  /** Any point that is definitely inland — used to orient offset geometry. */
  inlandRef: Point;
  terrain: {
    minM: number;
    maxM: number;
    meanM: number;
    /** Share of the district below 10 m AMSL (broad terrain context). */
    lowlandSharePct: number;
    provenance: Provenance;
  };
  notes: string;
}

export type AssetKind =
  | "hospital"
  | "shelter"
  | "power"
  | "road"
  | "port"
  | "airport";

export type Vulnerability = "low" | "moderate" | "high" | "unknown";

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  districtId: string;
  /** Representative point (always present; centroid for linear assets). */
  location: Point;
  /** Vertex list for linear assets (roads, transmission corridors). */
  line?: Point[];
  /** Service importance 1 (local) .. 5 (life-safety / regional). */
  importance: 1 | 2 | 3 | 4 | 5;
  importanceRationale: string;
  /**
   * Flat attribute bag. `null` means the attribute is UNKNOWN and must be
   * rendered as unknown — never guessed.
   */
  attributes: Record<string, string | number | boolean | null>;
  /** Structural vulnerability of the *building/asset*, not its importance. */
  structure: {
    value: Vulnerability;
    basis: string;
    inspectedAt?: string;
  };
  /** Sampled terrain height, metres above mean sea level. */
  elevationM: number | null;
  provenance: Provenance;
}

export interface TrackPoint {
  time: string;
  lat: number;
  lon: number;
  /** 3-min sustained wind, knots (IMD convention). */
  windKt: number;
  pressureHpa: number;
  /** Approximate radius of gale-force (>=34 kt) winds, km. */
  galeRadiusKm: number;
  label?: string;
}

export interface Scenario {
  id: string;
  districtId: string;
  name: string;
  code: string;
  year: number;
  kind: "recorded" | "synthetic";
  classification: string;
  summary: string;
  bulletin: Provenance;
  /** Paraphrased guidance text (never a verbatim reproduction). */
  bulletinSummary: string;
  landfall: { time: string; lat: number; lon: number; place: string };
  /** Peak storm surge above astronomical tide, metres. */
  peakSurgeM: number;
  surgeBasis: string;
  /** Farthest inland extent of modelled inundation at full strength, km. */
  maxInundationReachKm: number;
  /** Peak 24-hour rainfall guidance, mm. */
  peakRainMm24h: number;
  rainBasis: string;
  track: TrackPoint[];
}
