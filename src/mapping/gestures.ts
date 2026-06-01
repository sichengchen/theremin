import type { TrackedHand } from "../vision/handTypes";

export interface GestureState {
  pinching: boolean;
  open: boolean;
}

export function getGestureState(hand: TrackedHand | null): GestureState {
  if (!hand) {
    return {
      pinching: false,
      open: false,
    };
  }

  return {
    pinching: hand.pinchDistance < 0.42,
    open: hand.openness > 0.58,
  };
}
