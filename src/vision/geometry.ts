import type { Landmark } from "./handTypes";

export function distance(a: Landmark, b: Landmark): number {
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(a.x - b.x, a.y - b.y, dz);
}

export function getHandCenter(landmarks: Landmark[]): Landmark {
  if (landmarks.length === 0) {
    return { x: 0.5, y: 0.5, z: 0 };
  }

  const sum = landmarks.reduce<{ x: number; y: number; z: number }>(
    (acc, landmark) => ({
      x: acc.x + landmark.x,
      y: acc.y + landmark.y,
      z: acc.z + (landmark.z ?? 0),
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: sum.x / landmarks.length,
    y: sum.y / landmarks.length,
    z: sum.z / landmarks.length,
  };
}

export function getHandScale(landmarks: Landmark[]): number {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  if (!wrist || !middleMcp) {
    return 0.08;
  }

  return Math.max(distance(wrist, middleMcp), 0.04);
}

export function getPinchDistance(landmarks: Landmark[]): number {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  if (!thumbTip || !indexTip) {
    return Number.POSITIVE_INFINITY;
  }

  return distance(thumbTip, indexTip) / getHandScale(landmarks);
}

export function getHandOpenness(landmarks: Landmark[]): number {
  const wrist = landmarks[0];
  if (!wrist) {
    return 0;
  }

  const tipIndices = [4, 8, 12, 16, 20];
  const scale = getHandScale(landmarks);
  const spread =
    tipIndices.reduce((total, index) => {
      const tip = landmarks[index];
      return tip ? total + distance(wrist, tip) / scale : total;
    }, 0) / tipIndices.length;

  return Math.min(Math.max((spread - 1.1) / 1.6, 0), 1);
}

export function mirrorLandmarks(landmarks: Landmark[]): Landmark[] {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  }));
}
