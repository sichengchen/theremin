import { Check, Target, X } from "lucide-react";
import {
  CALIBRATION_STEP_LABELS,
  CALIBRATION_STEPS,
  type Calibration,
  type CalibrationStep,
} from "../mapping/calibration";

export interface CalibrationPanelProps {
  open: boolean;
  step: CalibrationStep;
  calibration: Calibration;
  canCapture: boolean;
  error: string | null;
  onCapture: () => void;
  onClose: () => void;
  onReset: () => void;
}

export function CalibrationPanel({
  open,
  step,
  calibration,
  canCapture,
  error,
  onCapture,
  onClose,
  onReset,
}: CalibrationPanelProps) {
  if (!open) {
    return null;
  }

  const stepIndex = CALIBRATION_STEPS.indexOf(step);

  return (
    <div className="calibration-panel" role="dialog" aria-modal="true" aria-label="Calibration">
      <div className="calibration-header">
        <div>
          <span className="eyebrow">Calibration</span>
          <h2>{CALIBRATION_STEP_LABELS[step]}</h2>
        </div>
        <button className="icon-button" onClick={onClose} title="Close calibration">
          <X size={18} />
        </button>
      </div>

      <div className="step-list">
        {CALIBRATION_STEPS.map((candidate, index) => (
          <div className={index <= stepIndex ? "step-dot active" : "step-dot"} key={candidate}>
            {index < stepIndex ? <Check size={14} /> : index + 1}
          </div>
        ))}
      </div>

      <div className="calibration-readout">
        <span>Pitch range</span>
        <strong>
          {calibration.pitchMinX.toFixed(2)} - {calibration.pitchMaxX.toFixed(2)}
        </strong>
        <span>Volume range</span>
        <strong>
          {calibration.volumeMaxY.toFixed(2)} - {calibration.volumeMinY.toFixed(2)}
        </strong>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="calibration-actions">
        <button className="action-button accent" onClick={onCapture} disabled={!canCapture}>
          <Target size={18} />
          <span>Capture</span>
        </button>
        <button onClick={onReset}>Reset defaults</button>
      </div>
    </div>
  );
}
