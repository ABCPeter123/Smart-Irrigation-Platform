import { prisma } from "../lib/prisma";

export type PublicPipelineRecord = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  areaHa: number;
  cropType: string;
  soilType: string;
  irrigationMethod: string;
  forecastDate: string | null;
  updatedAt: string | null;
  urgency: string | null;
  actionLabel: string | null;
  recommendedMm: number | null;
  estimatedLitres: number | null;
  dataCompletenessPct: number | null;
  waterDeficitMm: number | null;
  modelVersion: string | null;
  reasons: unknown;
};

type RawRow = Omit<PublicPipelineRecord, "forecastDate" | "updatedAt"> & {
  forecastDate: Date | null;
  updatedAt: Date | null;
};

/** One small SQL read for the public demo-site projection. Never return private sites. */
export async function loadNeonPublicRecords(): Promise<PublicPipelineRecord[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      s.id, s.name, s.latitude, s.longitude,
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
      SELECT * FROM irrigation_recommendations r
      WHERE r.site_id = s.id
      ORDER BY r.recommendation_date DESC, r.generated_at DESC
      LIMIT 1
    ) r ON TRUE
    WHERE s.id LIKE 'demo-%'
    ORDER BY s.name
    LIMIT 20
  `;
  return rows.map(row => ({
    ...row,
    forecastDate: row.forecastDate instanceof Date ?
      row.forecastDate.toISOString().slice(0, 10) : null,
    updatedAt: row.updatedAt instanceof Date ?
      row.updatedAt.toISOString() : null,
  }));
}
