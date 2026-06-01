import type { ControlState } from "../mapping/controlMapping";
import type { Calibration } from "../mapping/calibration";
import type { VisionFrame } from "../vision/handTypes";

const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
] as const;

export function renderOverlay(
  canvas: HTMLCanvasElement,
  frame: VisionFrame | null,
  control: ControlState | null,
  calibration: Calibration,
): void {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width * window.devicePixelRatio), 1);
  const height = Math.max(Math.round(rect.height * window.devicePixelRatio), 1);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  if (!frame) {
    drawCenteredText(context, rect.width, rect.height, "Start camera to play");
    return;
  }

  drawZones(context, rect.width, rect.height, calibration, control);

  for (const hand of frame.hands) {
    const isPitch = control?.pitchHand === hand;
    const isVolume = control?.volumeHand === hand;
    const color = isPitch ? "#77e1ff" : isVolume ? "#f3c969" : "#f2f4f8";

    context.strokeStyle = color;
    context.lineWidth = 2;
    context.lineCap = "round";
    for (const [from, to] of HAND_CONNECTIONS) {
      const a = hand.landmarks[from];
      const b = hand.landmarks[to];
      if (!a || !b) {
        continue;
      }
      context.beginPath();
      context.moveTo(a.x * rect.width, a.y * rect.height);
      context.lineTo(b.x * rect.width, b.y * rect.height);
      context.stroke();
    }

    for (const landmark of hand.landmarks) {
      context.beginPath();
      context.fillStyle = color;
      context.arc(landmark.x * rect.width, landmark.y * rect.height, 3.5, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "rgba(7, 10, 14, 0.72)";
    context.fillRect(hand.center.x * rect.width + 10, hand.center.y * rect.height - 18, 96, 28);
    context.fillStyle = "#ffffff";
    context.font = "12px Inter, system-ui, sans-serif";
    context.fillText(
      isPitch ? "Pitch" : isVolume ? "Volume" : hand.handedness,
      hand.center.x * rect.width + 18,
      hand.center.y * rect.height,
    );
  }
}

function drawZones(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  calibration: Calibration,
  control: ControlState | null,
): void {
  const pitchMin = calibration.pitchMinX * width;
  const pitchMax = calibration.pitchMaxX * width;
  const volumeMin = calibration.volumeMinY * height;
  const volumeMax = calibration.volumeMaxY * height;

  context.save();
  context.globalAlpha = 0.9;
  context.strokeStyle = "rgba(119, 225, 255, 0.62)";
  context.lineWidth = 2;
  context.setLineDash([7, 7]);
  context.beginPath();
  context.moveTo(pitchMin, 0);
  context.lineTo(pitchMin, height);
  context.moveTo(pitchMax, 0);
  context.lineTo(pitchMax, height);
  context.stroke();

  context.strokeStyle = "rgba(243, 201, 105, 0.7)";
  context.beginPath();
  context.moveTo(0, volumeMin);
  context.lineTo(width, volumeMin);
  context.moveTo(0, volumeMax);
  context.lineTo(width, volumeMax);
  context.stroke();
  context.setLineDash([]);

  if (control) {
    context.fillStyle = "rgba(119, 225, 255, 0.18)";
    context.fillRect(pitchMin, 0, Math.max(pitchMax - pitchMin, 1), height);
    context.fillStyle = "rgba(243, 201, 105, 0.14)";
    context.fillRect(0, volumeMax, width, Math.max(volumeMin - volumeMax, 1));
  }

  context.restore();
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
): void {
  context.fillStyle = "rgba(255, 255, 255, 0.86)";
  context.font = "600 18px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(text, width / 2, height / 2);
  context.textAlign = "start";
}
