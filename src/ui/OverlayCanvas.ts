import type { ControlState } from "../mapping/controlMapping";
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
    drawCenteredText(context, rect.width, rect.height, "Camera off");
    return;
  }

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
  }
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
): void {
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = "600 18px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(text, width / 2, height / 2);
  context.textAlign = "start";
}
