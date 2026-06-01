import { describe, expect, it } from "vite-plus/test";
import { getGestureState } from "./gestures";
import type { TrackedHand } from "../vision/handTypes";

describe("gestures", () => {
  it("detects a pinch from normalized thumb and index distance", () => {
    expect(getGestureState(makeHand(0.2, 0.7)).pinching).toBe(true);
    expect(getGestureState(makeHand(0.8, 0.7)).pinching).toBe(false);
  });

  it("detects an open hand from openness", () => {
    expect(getGestureState(makeHand(0.8, 0.8)).open).toBe(true);
    expect(getGestureState(makeHand(0.8, 0.2)).open).toBe(false);
  });
});

function makeHand(pinchDistance: number, openness: number): TrackedHand {
  return {
    id: "test",
    handedness: "Right",
    handednessScore: 1,
    landmarks: [],
    worldLandmarks: [],
    center: { x: 0.5, y: 0.5 },
    pinchDistance,
    openness,
    timestamp: 0,
  };
}
