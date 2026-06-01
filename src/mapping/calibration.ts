export interface Calibration {
  pitchMinX: number;
  pitchMaxX: number;
  volumeMinY: number;
  volumeMaxY: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  pitchMinX: 0.16,
  pitchMaxX: 0.86,
  volumeMinY: 0.86,
  volumeMaxY: 0.2,
};

const STORAGE_KEY = "vision-theremin-calibration-v1";

export type CalibrationStep =
  | "pitch-low"
  | "pitch-high"
  | "volume-quiet"
  | "volume-loud";

export const CALIBRATION_STEPS: CalibrationStep[] = [
  "pitch-low",
  "pitch-high",
  "volume-quiet",
  "volume-loud",
];

export const CALIBRATION_STEP_LABELS: Record<CalibrationStep, string> = {
  "pitch-low": "Pitch hand: lowest note",
  "pitch-high": "Pitch hand: highest note",
  "volume-quiet": "Volume hand: quiet position",
  "volume-loud": "Volume hand: loud position",
};

export function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CALIBRATION;
    }

    return sanitizeCalibration(JSON.parse(raw));
  } catch {
    return DEFAULT_CALIBRATION;
  }
}

export function saveCalibration(calibration: Calibration): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeCalibration(calibration)));
}

export function sanitizeCalibration(value: Partial<Calibration>): Calibration {
  const pitchMinX = numberOr(value.pitchMinX, DEFAULT_CALIBRATION.pitchMinX);
  const pitchMaxX = numberOr(value.pitchMaxX, DEFAULT_CALIBRATION.pitchMaxX);
  const volumeMinY = numberOr(value.volumeMinY, DEFAULT_CALIBRATION.volumeMinY);
  const volumeMaxY = numberOr(value.volumeMaxY, DEFAULT_CALIBRATION.volumeMaxY);

  return {
    pitchMinX: Math.min(pitchMinX, pitchMaxX - 0.08),
    pitchMaxX: Math.max(pitchMaxX, pitchMinX + 0.08),
    volumeMinY: Math.max(volumeMinY, volumeMaxY + 0.08),
    volumeMaxY: Math.min(volumeMaxY, volumeMinY - 0.08),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
