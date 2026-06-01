import { useCallback, useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
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
import { ControlPanel } from "./ControlPanel";
import { renderOverlay } from "./OverlayCanvas";

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

const SPLIT_STORAGE_KEY = "vision-theremin-split-x-v1";

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

  const updateSplit = useCallback((next: number | readonly number[]) => {
    const raw = Array.isArray(next) ? next[0] : next;
    const value = Math.min(Math.max((raw ?? DEFAULT_SPLIT_X * 100) / 100, 0.18), 0.82);
    setSplitX(value);
    localStorage.setItem(SPLIT_STORAGE_KEY, String(value));
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
          renderOverlay(canvas, frame, control, splitX);

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
        renderOverlay(canvas, frameRef.current, controlRef.current, splitX);
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
      <section className="stage" aria-label="Vision theremin performance surface">
        <video ref={videoRef} className="camera-feed" playsInline muted />
        <canvas ref={canvasRef} className="overlay-canvas" />
        <SplitLine value={splitX} onChange={updateSplit} />
        <ControlPanel
          cameraReady={cameraReady}
          audioReady={audioReady}
          settings={settings}
          waveform={waveform}
          handCount={metrics.handCount}
          frequency={metrics.frequency}
          gain={metrics.gain}
          confidence={metrics.confidence}
          onCameraChange={setCameraEnabled}
          onAudioChange={setAudioEnabled}
          onWaveformChange={updateWaveform}
          onSettingsChange={updateSettings}
          onReset={resetInstrument}
        />
        {error ? <div className="error-banner">{error}</div> : null}
      </section>
    </main>
  );
}

function SplitLine({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number | readonly number[]) => void;
}) {
  return (
    <Slider
      aria-label="Split line"
      className="split-slider"
      min={18}
      max={82}
      step={1}
      value={[value * 100]}
      onValueChange={onChange}
    />
  );
}

function loadSplitX(): number {
  const parsed = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0.18), 0.82) : DEFAULT_SPLIT_X;
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
