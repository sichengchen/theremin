export type Handedness = "Left" | "Right" | "Unknown";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface TrackedHand {
  id: string;
  handedness: Handedness;
  handednessScore: number;
  landmarks: Landmark[];
  worldLandmarks: Landmark[];
  center: Landmark;
  pinchDistance: number;
  openness: number;
  timestamp: number;
}

export interface VisionFrame {
  hands: TrackedHand[];
  timestamp: number;
  videoWidth: number;
  videoHeight: number;
}
