import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  FinalizeUploadBody,
  FinalizeUploadResponse as FinalizeUploadResponseSchema,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";
import { requireAdmin, isAuthed } from "../middlewares/admin-auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAdmin, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const rawPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    // Public read URL the storefront will use directly after finalize.
    const objectPath = `/api/storage/objects/${rawPath.replace(/^\/objects\//, "")}`;

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/uploads/finalize
 *
 * Called by the admin client after the PUT to the presigned URL succeeds.
 * Sets the object's ACL to public so the storefront can render it.
 */
router.post("/storage/uploads/finalize", requireAdmin, async (req: Request, res: Response) => {
  const parsed = FinalizeUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }
  try {
    const incoming = parsed.data.objectPath;
    const internalPath = incoming.startsWith("/api/storage/objects/")
      ? `/objects/${incoming.slice("/api/storage/objects/".length)}`
      : incoming;
    const finalPath = await objectStorageService.trySetObjectEntityAclPolicy(
      internalPath,
      { owner: "admin", visibility: "public" },
    );
    const objectPath = `/api/storage/objects/${finalPath.replace(/^\/objects\//, "")}`;
    res.json(FinalizeUploadResponseSchema.parse({ objectPath }));
  } catch (error) {
    req.log.error({ err: error }, "Error finalizing upload");
    res.status(500).json({ error: "Failed to finalize upload" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // ACL gate: public objects are always readable; private objects require
    // an authenticated admin. Anything without an ACL policy is treated as
    // private and rejected.
    const policy = await getObjectAclPolicy(objectFile);
    const isPublic = policy?.visibility === "public";
    if (!isPublic && !isAuthed(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
