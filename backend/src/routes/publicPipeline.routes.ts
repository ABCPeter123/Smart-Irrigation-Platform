import { Router } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

const router = Router();

type PublicPipelineRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  areaHa: number;
  cropType: string;
  soilType: string;
  irrigationMethod: string;
  forecastDate: Date | null;
  updatedAt: Date | null;
  urgency: string | null;
  actionLabel: string | null;
  recommendedMm: number | null;
  estimatedLitres: number | null;
  dataCompletenessPct: number | null;
  waterDeficitMm: number | null;
  modelVersion: string | null;
  reasons: unknown;
};

// Only return reviewed, non-sensitive demo farms from the Python feature store.
// This endpoint supports reads only and never trusts a caller-supplied SQL value.
router.get("/pipeline", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");

  if (!env.databaseConfigured) {
    res.status(503).json({
      status: "not-configured",
      message: "The database-backed demonstration has not been enabled.",
    });
    return;
  }

  try {
    const rows = await prisma.$queryRaw<PublicPipelineRow[]>`
      SELECT
        s.id,
        s.name,
        s.latitude,
        s.longitude,
        s.area_hectares AS "areaHa",
        s.crop_type AS "cropType",
        s.soil_type AS "soilType",
        s.irrigation_method AS "irrigationMethod",
        r.recommendation_date AS "forecastDate",
        r.generated_at AS "updatedAt",
        r.urgency,
        r.action_label AS "actionLabel",
        r.recommended_mm AS "recommendedMm",
        r.estimated_liters AS "estimatedLitres",
        r.confidence_score AS "dataCompletenessPct",
        r.water_deficit_mm AS "waterDeficitMm",
        r.model_version AS "modelVersion",
        r.reasons
      FROM pipeline_sites s
      LEFT JOIN LATERAL (
        SELECT *
        FROM irrigation_recommendations r
        WHERE r.site_id = s.id
        ORDER BY r.recommendation_date DESC, r.generated_at DESC
        LIMIT 1
      ) r ON TRUE
      WHERE s.id LIKE 'demo-%'
      ORDER BY s.name
      LIMIT 20
    `;

    res.json({
      status: "ready",
      source: "python-feature-store",
      records: rows.map((row) => ({
        ...row,
        // The "confidence" stored by the pipeline is input completeness.
        // Relabel it to avoid implying calibrated predictive accuracy.
        dataCompletenessPct: row.dataCompletenessPct,
        forecastDate: row.forecastDate instanceof Date
          ? row.forecastDate.toISOString().slice(0, 10)
          : null,
        updatedAt: row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : null,
      })),
    });
  } catch (error) {
    // Never expose credentials, queries, SQL or stack traces to callers.
    console.error("Pipeline snapshot unavailable:", error instanceof Error ? error.name : "unknown error");
    res.status(503).json({
      status: "unavailable",
      message: "The database-backed demonstration is temporarily unavailable.",
    });
  }
});

export default router;
