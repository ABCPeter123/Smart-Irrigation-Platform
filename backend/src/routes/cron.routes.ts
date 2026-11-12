import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { refreshDemoForecasts } from "../services/weatherPipeline.service";
import { loadNeonPublicRecords } from "../services/pipelineSnapshot.service";
import { r2WriteEnabled, writeDailyR2Snapshot } from "../services/r2Storage.service";

const router = Router();

// Vercel Cron sends Authorization: Bearer CRON_SECRET.
// No other public route can mutate the demo model tables.
router.get("/refresh", async (req, res) => {
  const token = process.env.CRON_SECRET;
  if (!token || token.length < 32) {
    res.status(503).json({ status: "disabled" });
    return;
  }
  const supplied = req.get("authorization") ?? "";
  const expected = "Bearer " + token;
  const candidate = Buffer.from(supplied);
  const trusted = Buffer.from(expected);
  if (candidate.length !== trusted.length || !timingSafeEqual(candidate, trusted)) {
    res.status(401).json({ status: "unauthorized" });
    return;
  }
  try {
    res.set("Cache-Control", "no-store");
    const result = await refreshDemoForecasts();
    let r2Sync: "disabled" | "skipped" | "verified" | "failed" = "disabled";
    // Only the protected daily cron can write. No user request triggers an R2 PUT.
    if (r2WriteEnabled()) {
      if (result.failed === 0 && result.updated > 0) {
        try {
          const records = await loadNeonPublicRecords();
          await writeDailyR2Snapshot(records);
          r2Sync = "verified";
        } catch (error) {
          r2Sync = "failed";
          // Neon succeeded. Do not roll back already-computed recommendations.
          console.error("Daily R2 shadow sync failed",
            error instanceof Error ? error.name : "unknown");
        }
      } else {
        r2Sync = "skipped";
      }
    }
    const incomplete = result.failed > 0 || r2Sync === "failed";
    res.status(incomplete ? 207 : 200).json({
      status: incomplete ? "partial" : "ok", ...result, r2Sync,
    });
  } catch (error) {
    console.error("Scheduled weather refresh failed", error instanceof Error ? error.name : "unknown");
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
