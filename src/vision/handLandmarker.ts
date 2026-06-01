import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  getHandCenter,
  getHandOpenness,
  getPinchDistance,
  mirrorLandmarks,
} from "./geometry";
import type { Handedness, Landmark, TrackedHand, VisionFrame } from "./handTypes";

export interface HandVisionOptions {
  modelAssetPath?: string;
  wasmRoot?: string;
  maxHands?: number;
  mirror?: boolean;
}

const DEFAULT_MODEL_PATH = "/models/hand_landmarker.task";
const DEFAULT_WASM_ROOT = "/vendor/mediapipe/tasks-vision/wasm";

interface CategoryLike {
  categoryName?: string;
  displayName?: string;
  score?: number;
}

function normalizeHandedness(category: CategoryLike | undefined): Handedness {
  const value = category?.categoryName ?? category?.displayName;
  if (value === "Left" || value === "Right") {
    return value;
  }

  return "Unknown";
}

function getHandednessCategories(result: HandLandmarkerResult, index: number): CategoryLike[] {
  const maybeResult = result as HandLandmarkerResult & {
    handednesses?: CategoryLike[][];
    handedness?: CategoryLike[][];
  };
  return maybeResult.handednesses?.[index] ?? maybeResult.handedness?.[index] ?? [];
}

function toLandmarks(landmarks: Landmark[], mirror: boolean): Landmark[] {
  return mirror ? mirrorLandmarks(landmarks) : landmarks;
}

export class BrowserHandLandmarker {
  private landmarker: HandLandmarker | null = null;
  private readonly options: Required<HandVisionOptions>;

  constructor(options: HandVisionOptions = {}) {
    this.options = {
      modelAssetPath: options.modelAssetPath ?? DEFAULT_MODEL_PATH,
      wasmRoot: options.wasmRoot ?? DEFAULT_WASM_ROOT,
      maxHands: options.maxHands ?? 2,
      mirror: options.mirror ?? true,
    };
  }

  async load(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(this.options.wasmRoot);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.options.modelAssetPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: this.options.maxHands,
      minHandDetectionConfidence: 0.62,
      minHandPresenceConfidence: 0.62,
      minTrackingConfidence: 0.6,
    });
  }

  detect(video: HTMLVideoElement, timestamp: number): VisionFrame {
    if (!this.landmarker) {
      throw new Error("Hand landmarker has not loaded.");
    }

    const result = this.landmarker.detectForVideo(video, timestamp);
    const hands: TrackedHand[] = result.landmarks.map((rawLandmarks, index) => {
      const landmarks = toLandmarks(rawLandmarks, this.options.mirror);
      const worldLandmarks = result.worldLandmarks?.[index] ?? [];
      const handedness = getHandednessCategories(result, index)[0];
      const center = getHandCenter(landmarks);

      return {
        id: `${normalizeHandedness(handedness)}-${index}`,
        handedness: normalizeHandedness(handedness),
        handednessScore: handedness?.score ?? 0,
        landmarks,
        worldLandmarks,
        center,
        pinchDistance: getPinchDistance(landmarks),
        openness: getHandOpenness(landmarks),
        timestamp,
      };
    });

    return {
      hands,
      timestamp,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    };
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
