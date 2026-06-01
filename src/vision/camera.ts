export interface CameraSession {
  stream: MediaStream;
  stop: () => void;
}

export async function createCameraSession(): Promise<CameraSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not expose camera access.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60, min: 30 },
    },
  });

  return {
    stream,
    stop: () => {
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
