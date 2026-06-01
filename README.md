# Air Theremin

A browser-based theremin controlled with hand tracking. The app uses your webcam to map hand movement to pitch and volume, then plays sound through the Web Audio API.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Then open the local URL shown in the terminal and allow camera access.

## Playing

- Turn on Camera and Audio in the control panel.
- Use your left hand for volume.
- Use your right hand for pitch.
- Drag the vertical divider to adjust the hand zones.
- Open More to change smoothing, sensitivity, waveform, and pitch range.

## Scripts

```bash
pnpm dev          # Start the development server
pnpm build        # Type-check and build the app
pnpm test         # Run tests
pnpm check        # Type-check and run tests
pnpm preview      # Preview the production build
pnpm fetch:model  # Download the MediaPipe hand model
```

## Notes

The app expects the MediaPipe hand model at:

```txt
public/models/hand_landmarker.task
```

If the model is missing, run:

```bash
pnpm run fetch:model
```

Camera access usually requires `localhost` or HTTPS.
