import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import https from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/models/hand_landmarker.task");
const temp = `${target}.download`;

async function fetchFile(url, destination) {
  await mkdir(dirname(destination), { recursive: true });

  await new Promise((resolvePromise, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        fetchFile(response.headers.location, destination)
          .then(resolvePromise)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Model download failed with HTTP ${response.statusCode}`));
        return;
      }

      const file = createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolvePromise);
      });
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

try {
  await rm(temp, { force: true });
  await fetchFile(MODEL_URL, temp);
  const info = await stat(temp);
  if (info.size < 1_000_000) {
    throw new Error(`Downloaded model is unexpectedly small: ${info.size} bytes`);
  }
  await rename(temp, target);
  console.log(`Saved MediaPipe hand model to ${target}`);
} catch (error) {
  await rm(temp, { force: true });
  throw error;
}
