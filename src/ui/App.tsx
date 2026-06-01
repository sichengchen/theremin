import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThereminSynth, type Waveform } from "../audio/ThereminSynth";
import {
  CALIBRATION_STEPS,
  DEFAULT_CALIBRATION,
  loadCalibration,
  saveCalibration,
  sanitizeCalibration,
  type Calibration,
  type CalibrationStep,
} from "../mapping/calibration";
import {
  DEFAULT_MAPPING_SETTINGS,
  mapHandsToControls,
  type ControlState,
  type MappingSettings,
} from "../mapping/controlMapping";
import { createCameraSession, type CameraSession } from "../vision/camera";
import { BrowserHandLandmarker } from "../vision/handLandmarker";
import type { VisionFrame } from "../vision/handTypes";
import { CalibrationPanel } from "./CalibrationPanel";
import { ControlPanel } from "./ControlPanel";
import { renderOverlay } from "./OverlayCanvas";
import { TooltipProvider } from "@/components/ui/tooltip";

interface LiveMetrics {
  handCount: number;
  frequency: number;
  gain: number;
  confidence: number;
}

const INITIAL_METRICS: LiveMetrics = {
  handCount: 0,
  frequency: DEFAULT_MAPPING_SETTINGS.minFrequency,
  gain: 0,
  confidence: 0,
};

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const visionRef = useRef<BrowserHandLandmarker | null>(null);
  const synthRef = useRef<ThereminSynth | null>(null);
  const frameRef = useRef<VisionFrame | null>(null);
  const controlRef = useRef<ControlState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastMetricPaintRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [visionReady, setVisionReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL_METRICS);
  const [settings, setSettings] = useState<MappingSettings>(DEFAULT_MAPPING_SETTINGS);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [calibration, setCalibration] = useState<Calibration>(() => loadCalibration());
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState<CalibrationStep>("pitch-low");
  const [calibrationError, setCalibrationError] = useState<string | null>(null);

  const canCaptureCalibration = useMemo(() => {
    const control = controlRef.current;
    return Boolean(control?.pitchHand || control?.volumeHand);
  }, [metrics.handCount]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (!visionRef.current) {
        const landmarker = new BrowserHandLandmarker();
        visionRef.current = landmarker;
        await landmarker.load();
        setVisionReady(true);
      }

      if (!cameraRef.current) {
        const session = await createCameraSession();
        cameraRef.current = session;
        if (videoRef.current) {
          videoRef.current.srcObject = session.stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      }
    } catch (caught) {
      setError(toUserError(caught));
    }
  }, []);

  const startAudio = useCallback(async () => {
    setError(null);
    try {
      if (!synthRef.current) {
        synthRef.current = new ThereminSynth();
      }
      await synthRef.current.start();
      synthRef.current.setTone({ waveform });
      synthRef.current.applySettings(settings);
      setAudioReady(true);
    } catch (caught) {
      setError(toUserError(caught));
    }
  }, [settings, waveform]);

  const updateSettings = useCallback((next: MappingSettings) => {
    setSettings(next);
    synthRef.current?.applySettings(next);
  }, []);

  const updateWaveform = useCallback((next: Waveform) => {
    setWaveform(next);
    synthRef.current?.setTone({ waveform: next });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      synthRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const resetInstrument = useCallback(() => {
    setSettings(DEFAULT_MAPPING_SETTINGS);
    setWaveform("sine");
    setMuted(false);
    controlRef.current = null;
    synthRef.current?.setMuted(false);
    synthRef.current?.setTone({ waveform: "sine", filterCutoff: 4200 });
    synthRef.current?.applySettings(DEFAULT_MAPPING_SETTINGS);
  }, []);

  const resetCalibration = useCallback(() => {
    setCalibration(DEFAULT_CALIBRATION);
    saveCalibration(DEFAULT_CALIBRATION);
    setCalibrationStep("pitch-low");
    setCalibrationError(null);
  }, []);

  const captureCalibration = useCallback(() => {
    const control = controlRef.current;
    if (!control) {
      setCalibrationError("No hand is being tracked.");
      return;
    }

    const next = { ...calibration };

    if (calibrationStep === "pitch-low" || calibrationStep === "pitch-high") {
      const x = control.pitchHand?.landmarks[8]?.x ?? control.pitchHand?.center.x;
      if (typeof x !== "number") {
        setCalibrationError("Pitch hand is not visible.");
        return;
      }
      if (calibrationStep === "pitch-low") {
        next.pitchMinX = x;
      } else {
        next.pitchMaxX = x;
      }
    } else {
      const y = control.volumeHand?.landmarks[9]?.y ?? control.volumeHand?.center.y;
      if (typeof y !== "number") {
        setCalibrationError("Volume hand is not visible.");
        return;
      }
      if (calibrationStep === "volume-quiet") {
        next.volumeMinY = y;
      } else {
        next.volumeMaxY = y;
      }
    }

    const sanitized = sanitizeCalibration(next);
    setCalibration(sanitized);
    saveCalibration(sanitized);
    setCalibrationError(null);

    const stepIndex = CALIBRATION_STEPS.indexOf(calibrationStep);
    if (stepIndex === CALIBRATION_STEPS.length - 1) {
      setCalibrationOpen(false);
      setCalibrationStep("pitch-low");
    } else {
      setCalibrationStep(CALIBRATION_STEPS[stepIndex + 1]);
    }
  }, [calibration, calibrationStep]);

  useEffect(() => {
    let mounted = true;

    const tick = (timestamp: number) => {
      if (!mounted) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = visionRef.current;

      if (video && canvas && landmarker && cameraReady && visionReady && video.readyState >= 2) {
        try {
          const frame = landmarker.detect(video, timestamp);
          const control = mapHandsToControls(frame.hands, settings, calibration, controlRef.current ?? undefined);

          frameRef.current = frame;
          controlRef.current = control;
          synthRef.current?.update(control);
          renderOverlay(canvas, frame, control, calibration);

          if (timestamp - lastMetricPaintRef.current > 90) {
            lastMetricPaintRef.current = timestamp;
            setMetrics({
              handCount: frame.hands.length,
              frequency: control.frequency,
              gain: control.gain,
              confidence: control.confidence,
            });
          }
        } catch (caught) {
          setError(toUserError(caught));
        }
      } else if (canvas) {
        renderOverlay(canvas, frameRef.current, controlRef.current, calibration);
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [calibration, cameraReady, settings, visionReady]);

  useEffect(() => {
    return () => {
      cameraRef.current?.stop();
      visionRef.current?.close();
      void synthRef.current?.shutdown();
    };
  }, []);

  return (
    <TooltipProvider>
      <main className="app-shell">
        <section className="stage" aria-label="Vision theremin performance surface">
          <video ref={videoRef} className="camera-feed" playsInline muted />
          <canvas ref={canvasRef} className="overlay-canvas" />
          <div className="brand-lockup">
            <span>Vision Theremin</span>
            <strong>{visionReady ? "MediaPipe Hand Landmarker" : "Ready"}</strong>
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
        </section>

        <ControlPanel
          cameraReady={cameraReady}
          audioReady={audioReady}
          muted={muted}
          settings={settings}
          waveform={waveform}
          handCount={metrics.handCount}
          frequency={metrics.frequency}
          gain={metrics.gain}
          confidence={metrics.confidence}
          onStartCamera={startCamera}
          onStartAudio={startAudio}
          onToggleMute={toggleMute}
          onWaveformChange={updateWaveform}
          onSettingsChange={updateSettings}
          onOpenCalibration={() => {
            setCalibrationOpen(true);
            setCalibrationError(null);
          }}
          onReset={resetInstrument}
        />

        <CalibrationPanel
          open={calibrationOpen}
          step={calibrationStep}
          calibration={calibration}
          canCapture={canCaptureCalibration}
          error={calibrationError}
          onCapture={captureCalibration}
          onClose={() => setCalibrationOpen(false)}
          onReset={resetCalibration}
        />
      </main>
    </TooltipProvider>
  );
}

function toUserError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("hand_landmarker.task") || message.includes("Model")) {
    return "MediaPipe model is missing. Run pnpm run fetch:model, then restart the dev server.";
  }
  if (message.includes("camera") || message.includes("Permission") || message.includes("NotAllowed")) {
    return "Camera access was blocked. Allow camera access and use localhost or HTTPS.";
  }

  return message;
}
