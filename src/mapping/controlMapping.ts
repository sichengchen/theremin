import type { TrackedHand } from "../vision/handTypes";
import { clamp, expSmooth, inverseLerp, logarithmicFrequency } from "./math";
import { getGestureState } from "./gestures";

export interface MappingSettings {
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
  minFrequency: 110,
  maxFrequency: 1760,
  maxGain: 0.82,
  smoothing: 0.72,
  sensitivity: 1,
  vibratoDepth: 8,
  vibratoRate: 5.4,
};

export const DEFAULT_SPLIT_X = 1 / 3;

export function assignControlHands(
  hands: TrackedHand[],
  splitX = DEFAULT_SPLIT_X,
): Pick<ControlState, "pitchHand" | "volumeHand"> {
  if (hands.length === 0) {
    return { pitchHand: null, volumeHand: null };
  }

  const split = clamp(splitX, 0.18, 0.82);
  const leftHands = hands.filter((hand) => hand.center.x < split);
  const rightHands = hands.filter((hand) => hand.center.x >= split);
  const volumeHand = pickMostStable(leftHands);
  const pitchHand = pickMostStable(rightHands);

  return {
    pitchHand,
    volumeHand,
  };
}

export function mapHandsToControls(
  hands: TrackedHand[],
  settings: MappingSettings = DEFAULT_MAPPING_SETTINGS,
  splitX = DEFAULT_SPLIT_X,
  previous?: ControlState,
): ControlState {
  const split = clamp(splitX, 0.18, 0.82);
  const { pitchHand, volumeHand } = assignControlHands(hands, split);
  const rawPitch = pitchHand
    ? clamp(inverseLerp(split, 0.98, pitchHand.landmarks[8]?.x ?? pitchHand.center.x))
    : previous?.pitch01 ?? 0;
  const shapedPitch = shapeAroundCenter(rawPitch, settings.sensitivity);
  const rawVolume = volumeHand
    ? clamp(1 - (volumeHand.landmarks[9]?.y ?? volumeHand.center.y))
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

function pickMostStable(hands: TrackedHand[]): TrackedHand | null {
  if (hands.length === 0) {
    return null;
  }

  return [...hands].sort((a, b) => b.handednessScore - a.handednessScore)[0];
}
