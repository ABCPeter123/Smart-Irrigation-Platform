import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { refreshDemoForecasts } from "../services/weatherPipeline.service";

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
    res.status(result.failed > 0 ? 207 : 200).json({ status: result.failed > 0 ? "partial" : "ok", ...result });
  } catch (error) {
    console.error("Scheduled weather refresh failed", error instanceof Error ? error.name : "unknown");
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
