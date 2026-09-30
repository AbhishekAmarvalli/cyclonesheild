import type { Point, Scenario, TrackPoint } from "../types";
import { kmBetween } from "./geo";

export interface TrendPrediction {
  input: TrackPoint;
  predictedPoint: Point;
  observedNext: TrackPoint;
  predictedWindKt: number;
  predictedWindKmh: number;
  observedWindKmh: number;
  inputWindKmh: number;
  leadHours: number;
  locationErrorKm: number;
}

/** Simple linear one-step baseline. Uses only the selected and preceding points. */
export function predictNextStep(
  scenario: Scenario,
  inputIndex: number,
): TrendPrediction | null {
  if (inputIndex < 1 || inputIndex >= scenario.track.length - 1) return null;

  const previous = scenario.track[inputIndex - 1];
  const input = scenario.track[inputIndex];
  const observedNext = scenario.track[inputIndex + 1];
  const historyHours = (Date.parse(input.time) - Date.parse(previous.time)) / 3_600_000;
  const leadHours = (Date.parse(observedNext.time) - Date.parse(input.time)) / 3_600_000;
  if (historyHours <= 0 || leadHours <= 0) return null;

  const scale = leadHours / historyHours;
  const predictedPoint: Point = [
    input.lon + (input.lon - previous.lon) * scale,
    input.lat + (input.lat - previous.lat) * scale,
  ];
  const predictedWindKt = Math.max(
    0,
    input.windKt + (input.windKt - previous.windKt) * scale,
  );

  return {
    input,
    predictedPoint,
    observedNext,
    predictedWindKt,
    predictedWindKmh: Math.round(predictedWindKt * 1.852),
    observedWindKmh: Math.round(observedNext.windKt * 1.852),
    inputWindKmh: Math.round(input.windKt * 1.852),
    leadHours,
    locationErrorKm: kmBetween(predictedPoint, [observedNext.lon, observedNext.lat]),
  };
}