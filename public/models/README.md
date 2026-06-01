# MediaPipe model assets

The app expects the production hand model here:

```txt
public/models/hand_landmarker.task
```

Fetch it with:

```bash
pnpm run fetch:model
```

The model URL is pinned in `scripts/fetch-mediapipe-model.mjs`.

MediaPipe WASM runtime files are copied from `@mediapipe/tasks-vision` into
`public/vendor` during `pnpm install`. They are generated from the package and
are intentionally not committed.
