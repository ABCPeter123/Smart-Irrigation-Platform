import { Router } from "express";
import { env } from "../config/env";
import { loadNeonPublicRecords } from "../services/pipelineSnapshot.service";
import { comparePublicRecords } from "../services/r2Snapshot.service";
import {
  r2Configured, r2ReadMode, readFreshR2Current, readR2Current,
} from "../services/r2Storage.service";

const router = Router();

/**
 * Immutable public response contract throughout migration.
 * - off: Neon only, today's production behavior.
 * - shadow: Neon result, compare R2 silently for validation.
 * - primary: read fresh R2, fall back to Neon if R2 is unavailable or stale.
 */
router.get("/pipeline", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  const mode = r2ReadMode();

  if (mode === "primary" && r2Configured()) {
    try {
      const r2 = await readFreshR2Current();
      res.json({ status: "ready", source: r2.source, records: r2.records });
      return;
    } catch (error) {
      console.error("R2 primary unavailable; using Neon fallback",
        error instanceof Error ? error.name : "unknown");
    }
  }

  if (!env.databaseConfigured) {
    res.status(503).json({
      status: "not-configured",
      message: "The database-backed demonstration has not been enabled.",
    });
    return;
  }

  try {
    const records = await loadNeonPublicRecords();

    if (mode === "shadow" && r2Configured()) {
      try {
        const shadow = await readR2Current();
        const parity = comparePublicRecords(records, shadow.records);
        // Log only summary and mismatched DEMO IDs. No private fields or secrets.
        console.info("R2 shadow parity", {
          matched: parity.matched,
          neonCount: parity.neonCount,
          r2Count: parity.r2Count,
          mismatchedSites: parity.mismatchedSites,
        });
      } catch (error) {
        console.error("R2 shadow comparison unavailable",
          error instanceof Error ? error.name : "unknown");
      }
    }

    res.json({ status: "ready", source: "stored-weather-models", records });
  } catch (error) {
    console.error("Pipeline snapshot unavailable:", error instanceof Error ? error.name : "unknown");
    res.status(503).json({
      status: "unavailable",
      message: "The database-backed demonstration is temporarily unavailable.",
    });
  }
});

export default router;
