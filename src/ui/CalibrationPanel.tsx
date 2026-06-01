import { Check, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
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
  const stepIndex = CALIBRATION_STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / CALIBRATION_STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="calibration-dialog" showCloseButton>
        <DialogHeader>
          <DialogDescription>Calibration</DialogDescription>
          <DialogTitle className="text-2xl font-semibold tracking-normal">
            {CALIBRATION_STEP_LABELS[step]}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {CALIBRATION_STEPS.map((candidate, index) => (
            <div className={index <= stepIndex ? "step-dot active" : "step-dot"} key={candidate}>
              {index < stepIndex ? <Check className="size-3.5" /> : index + 1}
            </div>
          ))}
        </div>

        <Progress value={progress} />

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

        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={onCapture} disabled={!canCapture}>
            <Target />
            Capture
          </Button>
          <Button variant="outline" size="lg" onClick={onReset}>
            Reset defaults
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
