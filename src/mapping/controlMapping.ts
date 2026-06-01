import type { Handedness, TrackedHand } from "../vision/handTypes";
import { clamp, expSmooth, inverseLerp, logarithmicFrequency } from "./math";
import { getGestureState } from "./gestures";

export type InstrumentHand = Exclude<Handedness, "Unknown">;

export interface MappingSettings {
  minFrequency: number;
  maxFrequency: number;
  maxGain: number;
  smoothing: number;
  sensitivity: number;
  vibratoDepth: number;
  vibratoRate: number;
  volumeHand: InstrumentHand;
  pitchHand: InstrumentHand;
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
  volumeHand: "Left",
  pitchHand: "Right",
};

export const DEFAULT_SPLIT_X = 1 / 3;

export function assignControlHands(
  hands: TrackedHand[],
  splitX = DEFAULT_SPLIT_X,
  settings: Pick<MappingSettings, "volumeHand" | "pitchHand"> = DEFAULT_MAPPING_SETTINGS,
): Pick<ControlState, "pitchHand" | "volumeHand"> {
  if (hands.length === 0) {
    return { pitchHand: null, volumeHand: null };
  }

  const split = clamp(splitX, 0.18, 0.82);
  const volumeFallback = hands.filter((hand) => hand.handedness === "Unknown" && hand.center.x < split);
  const pitchFallback = hands.filter((hand) => hand.handedness === "Unknown" && hand.center.x >= split);
  const volumeHand = pickAssignedHand(hands, settings.volumeHand, volumeFallback);
  const pitchHand = pickAssignedHand(hands, settings.pitchHand, pitchFallback, volumeHand);

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
  const { pitchHand, volumeHand } = assignControlHands(hands, split, settings);
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

function pickAssignedHand(
  hands: TrackedHand[],
  preferred: InstrumentHand,
  fallback: TrackedHand[],
  excluded: TrackedHand | null = null,
): TrackedHand | null {
  const available = hands.filter((hand) => hand !== excluded);
  return (
    pickMostStable(available.filter((hand) => hand.handedness === preferred)) ??
    pickMostStable(fallback.filter((hand) => available.includes(hand)))
  );
}
