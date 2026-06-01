import type { TrackedHand } from "../vision/handTypes";
import type { Calibration } from "./calibration";
import { DEFAULT_CALIBRATION } from "./calibration";
import { clamp, expSmooth, inverseLerp, logarithmicFrequency } from "./math";
import { getGestureState } from "./gestures";

export type PitchSide = "left" | "right";

export interface MappingSettings {
  pitchSide: PitchSide;
  minFrequency: number;
  maxFrequency: number;
  maxGain: number;
  smoothing: number;
  sensitivity: number;
  vibratoDepth: number;
  vibratoRate: number;
}

export interface ControlState {
  frequency: number;
  gain: number;
  pitch01: number;
  volume01: number;
  confidence: number;
  gate: boolean;
  mutedByGesture: boolean;
  vibratoDepth: number;
  vibratoRate: number;
  pitchHand: TrackedHand | null;
  volumeHand: TrackedHand | null;
}

export const DEFAULT_MAPPING_SETTINGS: MappingSettings = {
  pitchSide: "right",
  minFrequency: 110,
  maxFrequency: 1760,
  maxGain: 0.82,
  smoothing: 0.72,
  sensitivity: 1,
  vibratoDepth: 8,
  vibratoRate: 5.4,
};

export function assignControlHands(
  hands: TrackedHand[],
  pitchSide: PitchSide,
): Pick<ControlState, "pitchHand" | "volumeHand"> {
  if (hands.length === 0) {
    return { pitchHand: null, volumeHand: null };
  }

  const sorted = [...hands].sort((a, b) => a.center.x - b.center.x);
  const pitchHand = pitchSide === "right" ? sorted[sorted.length - 1] : sorted[0];
  const volumeHand =
    sorted.find((hand) => hand !== pitchHand) ?? (hands.length === 1 ? null : sorted[0]);

  return {
    pitchHand,
    volumeHand,
  };
}

export function mapHandsToControls(
  hands: TrackedHand[],
  settings: MappingSettings = DEFAULT_MAPPING_SETTINGS,
  calibration: Calibration = DEFAULT_CALIBRATION,
  previous?: ControlState,
): ControlState {
  const { pitchHand, volumeHand } = assignControlHands(hands, settings.pitchSide);
  const rawPitch = pitchHand
    ? clamp(inverseLerp(calibration.pitchMinX, calibration.pitchMaxX, pitchHand.landmarks[8]?.x ?? pitchHand.center.x))
    : previous?.pitch01 ?? 0;
  const shapedPitch = shapeAroundCenter(rawPitch, settings.sensitivity);
  const rawVolume = volumeHand
    ? clamp(inverseLerp(calibration.volumeMinY, calibration.volumeMaxY, volumeHand.landmarks[9]?.y ?? volumeHand.center.y))
    : 0;

  const pitch01 = previous ? expSmooth(previous.pitch01, shapedPitch, settings.smoothing) : shapedPitch;
  const volume01 = previous ? expSmooth(previous.volume01, rawVolume, settings.smoothing) : rawVolume;
  const confidence = Math.min(
    pitchHand ? Math.max(pitchHand.handednessScore, 0.7) : 0,
    volumeHand ? Math.max(volumeHand.handednessScore, 0.7) : hands.length === 1 ? 0.45 : 0,
  );
  const pitchGesture = getGestureState(pitchHand);
  const volumeGesture = getGestureState(volumeHand);
  const mutedByGesture = pitchGesture.pinching || volumeGesture.pinching;
  const gate = Boolean(pitchHand && volumeHand && confidence >= 0.42 && !mutedByGesture);

  return {
    frequency: logarithmicFrequency(settings.minFrequency, settings.maxFrequency, pitch01),
    gain: gate ? Math.pow(volume01, 1.35) * settings.maxGain : 0,
    pitch01,
    volume01,
    confidence,
    gate,
    mutedByGesture,
    vibratoDepth: volumeGesture.open ? settings.vibratoDepth : settings.vibratoDepth * 0.35,
    vibratoRate: settings.vibratoRate,
    pitchHand,
    volumeHand,
  };
}

function shapeAroundCenter(value: number, sensitivity: number): number {
  const amount = clamp(sensitivity, 0.45, 1.8);
  const centered = value - 0.5;
  return clamp(0.5 + Math.sign(centered) * Math.pow(Math.abs(centered) * 2, 1 / amount) * 0.5);
}
