import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_MAPPING_SETTINGS,
  DEFAULT_SPLIT_X,
  assignControlHands,
  mapHandsToControls,
} from "./controlMapping";
import type { Landmark, TrackedHand } from "../vision/handTypes";

describe("control mapping", () => {
  it("defaults the volume region to one third of the stage", () => {
    expect(DEFAULT_SPLIT_X).toBe(1 / 3);
  });

  it("assigns pitch and volume by split region", () => {
    const left = handAt(0.2, 0.5, "Left");
    const right = handAt(0.8, 0.5, "Right");

    expect(assignControlHands([left, right], 0.5).pitchHand).toBe(right);
    expect(assignControlHands([left, right], 0.5).volumeHand).toBe(left);
  });

  it("assigns controls by region instead of handedness", () => {
    const rightHandOnLeft = handAt(0.2, 0.5, "Right");
    const leftHandOnRight = handAt(0.8, 0.5, "Left");

    expect(assignControlHands([rightHandOnLeft, leftHandOnRight], 0.5).volumeHand).toBe(rightHandOnLeft);
    expect(assignControlHands([rightHandOnLeft, leftHandOnRight], 0.5).pitchHand).toBe(leftHandOnRight);
  });

  it("maps pitch logarithmically across the pitch region", () => {
    const pitch = handAt(0.98, 0.5, "Right");
    const volume = handAt(0.2, 0.05, "Left");
    const control = mapHandsToControls([pitch, volume], DEFAULT_MAPPING_SETTINGS, 0.5);

    expect(control.frequency).toBeGreaterThan(DEFAULT_MAPPING_SETTINGS.maxFrequency * 0.95);
    expect(control.gain).toBeGreaterThan(0.7);
    expect(control.gate).toBe(true);
  });

  it("gates audio when both hands are not available", () => {
    const control = mapHandsToControls([handAt(0.8, 0.5, "Right")]);

    expect(control.gate).toBe(false);
    expect(control.gain).toBe(0);
  });

  it("still tracks the volume hand when pitch is missing", () => {
    const quiet = mapHandsToControls([handAt(0.2, 0.85, "Left")]);
    const loud = mapHandsToControls([handAt(0.2, 0.05, "Left")]);

    expect(quiet.gate).toBe(false);
    expect(quiet.gain).toBe(0);
    expect(loud.gate).toBe(false);
    expect(loud.gain).toBe(0);
    expect(loud.volume01).toBeGreaterThan(quiet.volume01);
  });

  it("smooths transitions from a previous control state", () => {
    const low = handAt(0.52, 0.5, "Right");
    const volume = handAt(0.2, 0.05, "Left");
    const previous = mapHandsToControls([low, volume]);
    const high = handAt(0.98, 0.5, "Right");
    const next = mapHandsToControls([high, volume], DEFAULT_MAPPING_SETTINGS, 0.5, previous);

    expect(next.pitch01).toBeGreaterThan(previous.pitch01);
    expect(next.pitch01).toBeLessThan(1);
  });
});

function handAt(x: number, y: number, handedness: "Left" | "Right"): TrackedHand {
  const landmarks = Array.from({ length: 21 }, (_, index): Landmark => {
    const spread = index / 20;
    return {
      x: x + (spread - 0.5) * 0.04,
      y: y + (spread - 0.5) * 0.04,
      z: 0,
    };
  });
  landmarks[0] = { x, y: y + 0.08, z: 0 };
  landmarks[4] = { x: x - 0.035, y: y - 0.04, z: 0 };
  landmarks[8] = { x, y: y - 0.1, z: 0 };
  landmarks[9] = { x, y, z: 0 };
  landmarks[12] = { x: x + 0.02, y: y - 0.12, z: 0 };
  landmarks[16] = { x: x + 0.04, y: y - 0.1, z: 0 };
  landmarks[20] = { x: x + 0.06, y: y - 0.08, z: 0 };

  return {
    id: handedness,
    handedness,
    handednessScore: 0.92,
    landmarks,
    worldLandmarks: [],
    center: { x, y, z: 0 },
    pinchDistance: 1.2,
    openness: 0.8,
    timestamp: 0,
  };
}
