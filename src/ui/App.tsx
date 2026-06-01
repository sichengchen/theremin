import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { ThereminSynth, type Waveform } from "../audio/ThereminSynth";
import {
  DEFAULT_MAPPING_SETTINGS,
  DEFAULT_SPLIT_X,
  mapHandsToControls,
  type ControlState,
  type MappingSettings,
} from "../mapping/controlMapping";
import { createCameraSession, type CameraSession } from "../vision/camera";
import { BrowserHandLandmarker } from "../vision/handLandmarker";
import type { VisionFrame } from "../vision/handTypes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ControlPanel } from "./ControlPanel";
import { renderOverlay } from "./OverlayCanvas";

interface LiveMetrics {
  frequency: number;
  volume: number;
  confidence: number;
}

const INITIAL_METRICS: LiveMetrics = {
  frequency: DEFAULT_MAPPING_SETTINGS.minFrequency,
  volume: 0,
  confidence: 0,
};

const SPLIT_STORAGE_KEY = "vision-theremin-split-x-v3";
const ONBOARDING_STORAGE_KEY = "vision-theremin-onboarding-seen-v1";

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
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL_METRICS);
  const [settings, setSettings] = useState<MappingSettings>(DEFAULT_MAPPING_SETTINGS);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [splitX, setSplitX] = useState(loadSplitX);
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);

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

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    frameRef.current = null;
    controlRef.current = null;
    setCameraReady(false);
    setMetrics(INITIAL_METRICS);
  }, []);

  const setCameraEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        void startCamera();
      } else {
        stopCamera();
      }
    },
    [startCamera, stopCamera],
  );

  const stopAudio = useCallback(() => {
    const synth = synthRef.current;
    synthRef.current = null;
    setAudioReady(false);
    void synth?.shutdown();
  }, []);

  const setAudioEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        void startAudio();
      } else {
        stopAudio();
      }
    },
    [startAudio, stopAudio],
  );

  const updateSettings = useCallback((next: MappingSettings) => {
    setSettings(next);
    synthRef.current?.applySettings(next);
  }, []);

  const updateWaveform = useCallback((next: Waveform) => {
    setWaveform(next);
    synthRef.current?.setTone({ waveform: next });
  }, []);

  const resetInstrument = useCallback(() => {
    setSettings(DEFAULT_MAPPING_SETTINGS);
    setWaveform("sine");
    setSplitX(DEFAULT_SPLIT_X);
    localStorage.setItem(SPLIT_STORAGE_KEY, String(DEFAULT_SPLIT_X));
    controlRef.current = null;
    synthRef.current?.setTone({ waveform: "sine", filterCutoff: 4200 });
    synthRef.current?.applySettings(DEFAULT_MAPPING_SETTINGS);
  }, []);

  const updateSplit = useCallback((next: number) => {
    const value = clampSplit(next);
    setSplitX(value);
    localStorage.setItem(SPLIT_STORAGE_KEY, String(value));
  }, []);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setShowOnboarding(false);
  }, []);

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
          const control = mapHandsToControls(
            frame.hands,
            settings,
            splitX,
            controlRef.current ?? undefined,
          );

          frameRef.current = frame;
          controlRef.current = control;
          synthRef.current?.update(control);
          renderOverlay(canvas, frame, control);

          if (timestamp - lastMetricPaintRef.current > 90) {
            lastMetricPaintRef.current = timestamp;
            setMetrics({
              frequency: control.frequency,
              volume: control.volume01,
              confidence: control.confidence,
            });
          }
        } catch (caught) {
          setError(toUserError(caught));
        }
      } else if (canvas) {
        renderOverlay(canvas, frameRef.current, controlRef.current);
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
  }, [cameraReady, settings, splitX, visionReady]);

  useEffect(() => {
    return () => {
      cameraRef.current?.stop();
      visionRef.current?.close();
      void synthRef.current?.shutdown();
    };
  }, []);

  return (
    <main className="app-shell">
      <section
        className="stage"
        style={{ "--split-x": `${splitX * 100}%` } as CSSProperties}
        aria-label="Vision theremin performance surface"
      >
        <video ref={videoRef} className="camera-feed" playsInline muted />
        <div className="zone-overlay" aria-hidden="true" />
        <canvas ref={canvasRef} className="overlay-canvas" />
        <SplitLine value={splitX} onChange={updateSplit} />
        <ControlPanel
          cameraReady={cameraReady}
          audioReady={audioReady}
          settings={settings}
          waveform={waveform}
          frequency={metrics.frequency}
          volume={metrics.volume}
          confidence={metrics.confidence}
          onCameraChange={setCameraEnabled}
          onAudioChange={setAudioEnabled}
          onWaveformChange={updateWaveform}
          onSettingsChange={updateSettings}
          onReset={resetInstrument}
        />
        <OnboardingDialog
          open={showOnboarding}
          onDismiss={dismissOnboarding}
          onOpenChange={(open) => {
            if (!open) {
              dismissOnboarding();
            }
          }}
        />
        {error ? <div className="error-banner">{error}</div> : null}
      </section>
    </main>
  );
}

function OnboardingDialog({
  open,
  onDismiss,
  onOpenChange,
}: {
  open: boolean;
  onDismiss: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="onboarding-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Get started</DialogTitle>
          <DialogDescription className="onboarding-copy">
            Play sound in the air with two hands.
          </DialogDescription>
        </DialogHeader>
        <ol className="onboarding-steps">
          <li>
            <span className="onboarding-step-number">1</span>
            <span>Turn on Camera and Audio.</span>
          </li>
          <li>
            <span className="onboarding-step-number">2</span>
            <span>Use the left hand for loudness: raise it to get louder, lower it to fade out.</span>
          </li>
          <li>
            <span className="onboarding-step-number">3</span>
            <span>Use the right hand for pitch. Drag the divider if you want more room.</span>
          </li>
        </ol>
        <DialogFooter>
          <Button className="onboarding-action" onClick={onDismiss}>
            <Play />
            Start playing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SplitLine({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const stage = ref.current?.parentElement;
      if (!stage) {
        return;
      }

      const rect = stage.getBoundingClientRect();
      onChange(clampSplit((clientX - rect.left) / rect.width));
    },
    [onChange],
  );

  const nudge = useCallback(
    (amount: number) => {
      onChange(clampSplit(value + amount));
    },
    [onChange, value],
  );

  const beginDrag = useCallback(
    (clientX: number) => {
      draggingRef.current = true;
      updateFromClientX(clientX);
    },
    [updateFromClientX],
  );

  useEffect(() => {
    const move = (event: PointerEvent | MouseEvent) => {
      if (draggingRef.current) {
        event.preventDefault();
        updateFromClientX(event.clientX);
      }
    };

    const stop = () => {
      draggingRef.current = false;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, [updateFromClientX]);

  return (
    <div
      ref={ref}
      aria-label="Split line"
      aria-orientation="horizontal"
      aria-valuemax={82}
      aria-valuemin={18}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}%`}
      className="split-control"
      role="slider"
      style={{ left: `${value * 100}%` }}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          nudge(-0.01);
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          nudge(0.01);
        } else if (event.key === "PageDown") {
          event.preventDefault();
          nudge(-0.05);
        } else if (event.key === "PageUp") {
          event.preventDefault();
          nudge(0.05);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(0.18);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(0.82);
        }
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        beginDrag(event.clientX);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Browser automation and older input paths may not expose pointer capture.
        }
        beginDrag(event.clientX);
      }}
    >
      <span className="split-control-line" />
      <span className="split-control-grip" />
    </div>
  );
}

function loadSplitX(): number {
  const stored = localStorage.getItem(SPLIT_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_SPLIT_X;
  }

  const parsed = Number(stored);
  return Number.isFinite(parsed) ? clampSplit(parsed) : DEFAULT_SPLIT_X;
}

function shouldShowOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
}

function clampSplit(value: number): number {
  return Math.min(Math.max(value, 0.18), 0.82);
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
