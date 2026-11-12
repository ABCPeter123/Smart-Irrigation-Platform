import { Router } from "express";
import { env } from "../config/env";
import { r2Configured, r2ReadMode, r2WriteEnabled } from "../services/r2Storage.service";

const router = Router();

router.get("/", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    status: "ok",
    service: "northern-irrigation-backend",
    mode: env.publicReadOnly ? "public-read-only" : "local-development",
    pipelineDatabase: env.databaseConfigured ? "configured" : "not-configured",
    r2: { configured: r2Configured(), readMode: r2ReadMode(), syncEnabled: r2WriteEnabled() },
    timestamp: new Date().toISOString(),
  });
});

export default router;
