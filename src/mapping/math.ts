export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

export function inverseLerp(min: number, max: number, value: number): number {
  if (Math.abs(max - min) < Number.EPSILON) {
    return 0;
  }

  return (value - min) / (max - min);
}

export function lerp(min: number, max: number, value: number): number {
  return min + (max - min) * value;
}

export function logarithmicFrequency(minHz: number, maxHz: number, value: number): number {
  const safeMin = Math.max(minHz, 20);
  const safeMax = Math.max(maxHz, safeMin + 1);
  return safeMin * Math.pow(safeMax / safeMin, clamp(value));
}

export function expSmooth(previous: number, next: number, amount: number): number {
  const alpha = clamp(1 - amount, 0.02, 1);
  return previous + (next - previous) * alpha;
}
