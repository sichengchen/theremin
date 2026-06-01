import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const target = resolve(root, "public/vendor/mediapipe/tasks-vision/wasm");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (await exists(source)) {
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  await writeFile(
    resolve(target, "asset-source.json"),
    JSON.stringify(
      {
        source: "@mediapipe/tasks-vision/wasm",
      },
      null,
      2,
    ),
  );
  console.log(`Copied MediaPipe WASM assets to ${target}`);
} else {
  console.warn("MediaPipe WASM assets were not found; run pnpm install first.");
}
