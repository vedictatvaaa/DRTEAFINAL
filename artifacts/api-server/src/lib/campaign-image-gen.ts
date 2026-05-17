import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateImageBuffer, type ImageSize } from "./openaiImage";
import {
  generateGeminiImageBuffer,
  aspectFromSize,
  type SceneKind,
} from "./geminiImage";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const storage = new ObjectStorageService();

/**
 * Local-filesystem fallback for environments where Replit Object Storage
 * isn't configured (e.g. self-hosted VPS deployments). Writes the PNG under
 * `<cwd>/uploads/generated/<sha256>.png` and returns a path served by the
 * static handler mounted at `/api/local-images`.
 *
 * The hash dedupes identical buffers and is stable across reboots, so
 * deterministic seeds produce stable URLs that survive deploys.
 */
const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "generated");
let localDirReady: Promise<void> | null = null;
async function ensureLocalDir(): Promise<void> {
  if (!localDirReady) {
    localDirReady = mkdir(LOCAL_UPLOAD_DIR, { recursive: true }).then(() => undefined);
  }
  return localDirReady;
}
async function storeLocal(buffer: Buffer): Promise<string> {
  await ensureLocalDir();
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
  const filename = `${hash}.png`;
  await writeFile(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  return `/api/local-images/${filename}`;
}
function objectStorageAvailable(): boolean {
  return !!(process.env.PRIVATE_OBJECT_DIR ?? "").trim();
}

/**
 * Persist a PNG buffer to whichever storage is available and return a public
 * URL path. Shared by every server-side image upload path (AI generation,
 * admin product images, admin content drafts) so they all benefit from the
 * same Object-Storage → local-FS fallback.
 */
export async function storeImageBuffer(buffer: Buffer): Promise<string> {
  if (!objectStorageAvailable()) {
    return storeLocal(buffer);
  }
  try {
    const uploadURL = await storage.getObjectEntityUploadURL();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: buffer,
    });
    if (!putRes.ok) {
      throw new Error(`Object storage upload failed: ${putRes.status}`);
    }
    const finalPath = await storage.trySetObjectEntityAclPolicy(uploadURL, {
      owner: "admin",
      visibility: "public",
    });
    return `/api/storage/objects/${finalPath.replace(/^\/objects\//, "")}`;
  } catch (err) {
    logger.warn({ err }, "Object storage write failed, falling back to local FS");
    return storeLocal(buffer);
  }
}

export interface GenerateImageOpts {
  /** Stable per-item seed (e.g. `recipe-42`) to deterministically pick a
   *  unique scene/lighting/palette so two posts never share an identical
   *  visual setup. */
  seed?: string;
  /** Domain hint that selects an appropriate setting library. */
  sceneKind?: SceneKind;
}

/**
 * Generate an image from `prompt`, store it in object storage, and return
 * the public path under /api/storage/objects/...
 *
 * Throws on any failure so callers can wrap in Promise.allSettled and
 * surface per-item errors.
 */
export async function generateAndStoreImage(
  prompt: string,
  size: ImageSize = "1024x1024",
  opts: GenerateImageOpts = {},
): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Image prompt is empty");
  let buffer: Buffer;
  try {
    buffer = await generateGeminiImageBuffer(trimmed, {
      aspect: aspectFromSize(size),
      seed: opts.seed,
      sceneKind: opts.sceneKind,
    });
  } catch (err) {
    logger.warn({ err }, "Gemini image failed, falling back to OpenAI");
    buffer = await generateImageBuffer(trimmed, size);
  }
  return storeImageBuffer(buffer);
}

export type CampaignImageTarget =
  | { kind: "blog" }
  | { kind: "social"; channel: string }
  | { kind: "ad"; index: number };

export interface CampaignImageFailure {
  target: CampaignImageTarget;
  prompt: string;
  error: string;
}

export interface CampaignImageJob {
  target: CampaignImageTarget;
  prompt: string;
  size?: ImageSize;
  seed?: string;
  sceneKind?: SceneKind;
}

export interface CampaignImageResult {
  target: CampaignImageTarget;
  prompt: string;
  url: string | null;
  error: string | null;
}

/**
 * Run a batch of image generation jobs in parallel (best-effort). Each job
 * succeeds or fails independently — failures are returned alongside successes
 * so the operator can see exactly what to retry. Empty prompts are skipped
 * silently (returned as `{ url: null, error: null }`) since the AI sometimes
 * omits prompts for a channel.
 */
export async function generateCampaignImages(
  jobs: CampaignImageJob[],
): Promise<CampaignImageResult[]> {
  const settled = await Promise.allSettled(
    jobs.map(async (j) => {
      if (!j.prompt.trim()) {
        return { target: j.target, prompt: j.prompt, url: null, error: null };
      }
      try {
        const url = await generateAndStoreImage(j.prompt, j.size, {
          seed: j.seed,
          sceneKind: j.sceneKind,
        });
        return { target: j.target, prompt: j.prompt, url, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Image generation failed";
        logger.warn({ err, target: j.target }, "Campaign image generation failed");
        return { target: j.target, prompt: j.prompt, url: null, error: msg };
      }
    }),
  );
  // Preserve the original job metadata in the (defensive) rejection fallback
  // so misattribution can't happen if the inner try/catch is ever bypassed.
  return settled.map((s, idx) => {
    if (s.status === "fulfilled") return s.value;
    const j = jobs[idx]!;
    return {
      target: j.target,
      prompt: j.prompt,
      url: null,
      error: s.reason instanceof Error ? s.reason.message : "Unknown error",
    };
  });
}
