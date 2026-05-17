import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import seoPublicRouter from "./routes/seo-public";
import feedsRouter from "./routes/feeds";
import { logger } from "./lib/logger";

const app: Express = express();

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production");
}
if (!sessionSecret) {
  logger.warn(
    "SESSION_SECRET is not set; using an ephemeral dev secret. Admin sessions will not survive restarts.",
  );
}
const effectiveSecret =
  sessionSecret ?? `dev-${Math.random().toString(36).slice(2)}`;
app.use(cookieParser(effectiveSecret));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Same-origin in this monorepo (api at /api, storefront at /); for split-origin
// deployments, set ADMIN_ALLOWED_ORIGINS (comma-separated) to enable
// credentialed CORS so the signed admin cookie flows.
const allowedOrigins = (process.env.ADMIN_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors(
    allowedOrigins.length
      ? { origin: allowedOrigins, credentials: true }
      : undefined,
  ),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
// In production, the api-server artifact also owns /sitemap.xml,
// /sitemap-images.xml, and /robots.txt at the storefront root (see
// artifact.toml). Mount the same handlers at the app root so search
// engines hit valid responses without an extra proxy hop.
app.use(seoPublicRouter);
// Merchant feeds at root (canonical paths Google/Meta fetchers expect).
app.use(feedsRouter);

export default app;
