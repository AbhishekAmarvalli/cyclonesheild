import { circle as turfCircle, distance as turfDistance } from "@turf/turf";
import type { Point } from "../types";

/** Minimal, dependency-light geometry helpers for district-scale screening. */

export type Ring = Point[];

const rad = (d: number) => (d * Math.PI) / 180;

export const kmBetween = (a: Point, b: Point): number =>
  turfDistance([a[0], a[1]], [b[0], b[1]], { units: "kilometers" });

/** Closed GeoJSON-style ring (first point repeated at the end). */
export const closeRing = (ring: Point[]): Ring =>
  ring.length > 1 &&
  (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ? [...ring, ring[0]]
    : ring;

/** Ray-casting point-in-ring test (planar; fine at district scale). */
export function ringContains(ring: Point[], p: Point): boolean {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Great-circle radius polygon around a centre, as a ring. */
export function circleRing(center: Point, radiusKm: number, steps = 72): Ring {
  const f = turfCircle([center[0], center[1]], Math.max(radiusKm, 0.05), {
    steps,
    units: "kilometers",
  });
  const coords = f.geometry.coordinates[0] as Point[];
  return coords.map((c) => [c[0], c[1]] as Point);
}

/** Minimum distance (km) from a point to a polyline. */
export function distToLineKm(p: Point, line: Point[]): number {
  if (line.length === 1) return kmBetween(p, line[0]);
  const latRef = p[1];
  const lonScale = Math.max(Math.cos(rad(latRef)), 0.05);
  const toXY = (q: Point): [number, number] => [q[0] * lonScale * 111.32, q[1] * 110.574];
  const [px, py] = toXY(p);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = toXY(line[i - 1]);
    const [bx, by] = toXY(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy) / 111.0;
    if (d < best) best = d;
  }
  return best;
}

export const distToLineMin = (p: Point, line: Point[]): number =>
  Math.min(...line.map((q) => kmBetween(p, q)));

/**
 * Offset a coastline inland by `reachKm` to build an inundation corridor.
 * The inland direction is decided by comparing each offset against `inlandRef`.
 */
export function offsetCoastRing(
  coast: Point[],
  reachKm: number,
  inlandRef: Point,
): Ring {
  const latRef = coast[Math.floor(coast.length / 2)][1];
  const lonScale = Math.max(Math.cos(rad(latRef)), 0.05);
  const toXY = (q: Point): [number, number] => [q[0] * lonScale * 111.32, q[1] * 110.574];
  const fromXY = (xy: [number, number]): Point => [
    xy[0] / (lonScale * 111.32),
    xy[1] / 110.574,
  ];

  const reachDeg = reachKm;
  const offset: Point[] = coast.map((pt, i) => {
    const prev = coast[Math.max(0, i - 1)];
    const next = coast[Math.min(coast.length - 1, i + 1)];
    const [ax, ay] = toXY(prev);
    const [bx, by] = toXY(next);
    let tx = bx - ax;
    let ty = by - ay;
    const mag = Math.hypot(tx, ty) || 1;
    tx /= mag;
    ty /= mag;
    // two candidate normals (metres)
    const n1: [number, number] = [ty, -tx];
    const p0 = toXY(pt);
    const inland = toXY(inlandRef);
    const c1: [number, number] = [p0[0] + n1[0] * reachDeg * 1000, p0[1] + n1[1] * reachDeg * 1000];
    const towardInland =
      (c1[0] - p0[0]) * (inland[0] - p0[0]) + (c1[1] - p0[1]) * (inland[1] - p0[1]);
    const n: [number, number] = towardInland >= 0 ? n1 : [-n1[0], -n1[1]];
    return fromXY([p0[0] + n[0] * reachDeg * 1000, p0[1] + n[1] * reachDeg * 1000]);
  });

  return closeRing([...coast, ...offset.reverse()]);
}

/** Sample points along a polyline at roughly `stepKm` spacing. */
export function sampleLine(line: Point[], stepKm = 0.5): Point[] {
  if (line.length < 2) return [...line];
  const out: Point[] = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = kmBetween(a, b);
    const n = Math.max(1, Math.ceil(len / stepKm));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
